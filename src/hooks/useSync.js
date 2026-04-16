import React, { useState, useEffect, useCallback } from 'react';
import { fetchPOSMData, fetchAcceptanceData } from '../services/api';
import { db } from '../services/db';
import { useAuth } from '../context/AuthContext';
import { getCustomWeekNumber } from '../utils/weekUtils';

let syncInProgress = false;
const FULL_SYNC_INTERVAL_MS = 20 * 60 * 1000;       // 20 min — mission data rarely changes
const ACCEPTANCE_SYNC_INTERVAL_MS = 3 * 60 * 1000; // 3 min  — catches new reports quickly

// ── Module-level pure helpers (shared by pullData & pullAcceptanceOnly) ─────
const normalizeStr = (str) => str ? str.toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '') : '';
const stripAccents = (s) => (s || '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const cleanKey = (str) => {
  if (!str) return '';
  return str.toString().replace(/[^a-zA-Z0-9_]/g, '').toUpperCase().trim();
};
const getHeaderMap = (row) => {
  const map = new Map();
  Object.keys(row).forEach(k => {
    const trimmedKey = k.toString().trim();
    map.set(normalizeStr(trimmedKey).toLowerCase(), k);
    map.set(stripAccents(trimmedKey), k);
  });
  return map;
};
const getValFast = (row, patterns, hMap) => {
  for (const p of patterns) {
    const normP = normalizeStr(p.trim()).toLowerCase();
    const stripP = stripAccents(p.trim());
    const key = hMap.get(normP) || hMap.get(stripP);
    if (key !== undefined) {
      const val = (row[key] ?? '').toString().trim();
      if (val !== '') return val;
    }
  }
  return '';
};
const normStatus = (s) => {
  if (!s) return 'On-going';
  const clean = s.toString().toLowerCase().trim();
  if (['done', 'ho\u00e0n th\u00e0nh', 'hoan thanh', '\u0111\u00e3 xong', 'da xong', 'ok', '\u0111\u1ea1t', 'dat', 'xong'].includes(clean)) return 'Done';
  return 'On-going';
};
// ─────────────────────────────────────────────────────────────────────────────

export const useSync = (user) => {
  const [syncing, setSyncing] = useState(false);
  const { setLastSync } = useAuth();

  const pullData = useCallback(async (force = false) => {
    if (!user || (syncInProgress && !force)) return;
    setSyncing(true);
    syncInProgress = true;
    try {
      const [posmResponse, accResponse] = await Promise.all([
        fetchPOSMData(),
        fetchAcceptanceData()
      ]);

      const { data: rawData, isMock: isPosmMock } = posmResponse;
      const { data: rawAcc, isMock: isAccMock } = accResponse;

      const headerMapDataRaw = rawData.length > 0 ? getHeaderMap(rawData[0]) : new Map();

      // 1. DETERMINE WEEKS & MONTHS (Full History)
      const weekToMonth = new Map();
      rawData.forEach(row => {
        const weekNumVal = getValFast(row, ['WEEKnum', 'WEEK_num', 'WEEK num', 'weeknum', 'Week triển khai', 'Week', 'Tuần', 'Tuan'], headerMapDataRaw);
        if (weekNumVal) {
          const num = parseInt(weekNumVal.toString().match(/\d+/)?.[0]) || 0;
          if (num > 0 && !weekToMonth.has(num)) {
            const dateStr = getValFast(row, ['Ngày chia', 'Ngay chia', 'Ngày', 'Date'], headerMapDataRaw);
            let monthAccurate = null;
            if (dateStr) {
              const parts = dateStr.includes('/') ? dateStr.split('/') : dateStr.split('-');
              if (parts.length >= 3) {
                const monthRaw = parseInt(parts[1], 10);
                if (monthRaw >= 1 && monthRaw <= 12) {
                  monthAccurate = monthRaw;
                }
              }
            }
            if (monthAccurate) {
              weekToMonth.set(num, monthAccurate);
            } else {
              const approxMonth = Math.min(12, Math.floor((num - 1) / 4.34) + 1);
              weekToMonth.set(num, approxMonth);
            }
          }
        }
      });

      const getWeekLabel = (num) => {
        if (!num) return 'W??';
        const month = weekToMonth.get(num);
        return month ? `W${num} (T.${month})` : `W${num}`;
      };

      const data = rawData;
      const rawAcceptance = rawAcc;

      const headerMapData = data.length > 0 ? getHeaderMap(data[0]) : new Map();
      const headerMapAcc = rawAcc.length > 0 ? getHeaderMap(rawAcc[0]) : new Map();

      const assignmentsMap = new Map();
      const jobCodeToIndex = new Map();

      const users = await db.users.toArray();
      const nameToId = new Map();
      users.forEach(u => { if (u.ho_ten) nameToId.set(stripAccents(u.ho_ten).toLowerCase().trim(), u.user_id); });

      // Load local adhocPoints TRƯỚC khi process acceptance — dùng để fallback project
      // khi GAS chưa ghi Project vào sheet CSV
      const localAdhocProjectMap = new Map();
      const localProjectMap = new Map();
      try {
        if (db.posmData) {
          const localPoints = await db.posmData.toArray();
          localPoints.forEach(p => {
             if (p.job_code && p.project) {
                 localProjectMap.set(String(p.job_code).toUpperCase().trim(), p.project);
             }
          });
          console.log('[pullData] Loaded localProjectMap:', localProjectMap.size, 'entries');
        }
        if (db.adhocPoints) {
          const localAdhocs = await db.adhocPoints.toArray();
          localAdhocs.forEach(a => {
            if (a.job_code && a.project) {
              // Index bằng cả raw key và normalized key để match mọi trường hợp
              localAdhocProjectMap.set(String(a.job_code).toUpperCase().trim(), a.project);
              localAdhocProjectMap.set(String(a.job_code).trim(), a.project);
            }
          });
          console.log('[pullData] Loaded localAdhocProjectMap:', localAdhocProjectMap.size, 'entries');
        }
      } catch (_e) { /* ignore */ }

      // Step 1: Build Missions (Master Data)
      data.forEach((row, index) => {
        const jobCodeRaw = getValFast(row, ['Mã cv', 'job_code', 'Ma cv', 'jobCode', 'Mã CV'], headerMapData);
        if (!jobCodeRaw || jobCodeRaw.length < 2) return;
        const jobCode = cleanKey(jobCodeRaw);

        const weekNumVal = getValFast(row, ['WEEKnum', 'WEEK_num', 'WEEK num', 'weeknum'], headerMapData);
        let weekNum = parseInt(weekNumVal.toString().match(/\d+/)?.[0]) || 0;

        if (!weekNum) {
          const fallbackWeek = getValFast(row, ['Week triển khai', 'Week', 'Tuần', 'Tuan'], headerMapData);
          weekNum = parseInt(fallbackWeek.toString().match(/\d+/)?.[0]) || 0;
        }

        const week = getWeekLabel(weekNum);
        const brand = getValFast(row, ['Brand', 'Nhãn hàng', 'Nhan hang'], headerMapData) || 'N/A';
        const compositeKey = `${jobCode}_${week}_${brand}_${index}`;

        const parseCoord = (s) => {
          if (!s) return null;
          const val = parseFloat(s.toString().replace(',', '.'));
          return isNaN(val) || val === 0 ? null : val;
        };

        // Priority mapping
        const priorityVal = getValFast(row, ['Ưu tiên', 'Uu tien', 'Priority', 'ưu'], headerMapData);
        const isPriority = priorityVal.toString().toUpperCase() === 'TRUE' || priorityVal === '1' || priorityVal.toString().toUpperCase() === 'YES';

        const item = {
          week,
          date_assigned: getValFast(row, ['Ngày chia', 'Ngay chia', 'Ngày', 'Date'], headerMapData),
          brand,
          job_code: jobCode,
          address: getValFast(row, ['Địa chỉ', 'Dia chi', 'Address'], headerMapData),
          district: getValFast(row, ['Quận', 'Quan', 'District', 'Huyện'], headerMapData),
          city: getValFast(row, ['Thành Phố', 'Thanh Pho', 'City', 'Tỉnh'], headerMapData),
          pic: getValFast(row, ['PIC', 'Nhân viên', 'Nhan vien', 'Người thực hiện'], headerMapData),
          status: normStatus(getValFast(row, ['Status', 'Trạng thái', 'Tinh trang'], headerMapData)),
          pic_id: (getValFast(row, ['pic_id', 'Mã nhân viên', 'Staff ID', 'Emp ID', 'Ma NV'], headerMapData) || '').toString().trim(),
          lat: parseCoord(getValFast(row, ['latitude', 'lat', 'vĩ độ'], headerMapData)),
          lng: parseCoord(getValFast(row, ['longitude', 'lng', 'kinh độ'], headerMapData)),
          mall_name: getValFast(row, ['Mall_Name', 'Mall', 'Trung tâm'], headerMapData) || 'N/A',
          note: getValFast(row, ['Note', 'Ghi chú', 'Ghi chu'], headerMapData) || '',
          count_st: getValFast(row, ['Count st', 'Count số lần triển khai'], headerMapData) || '',
          priority: isPriority,
          project: getValFast(row, ['Project', 'project', 'Dự án', 'Du an'], headerMapData) || localProjectMap.get(String(jobCodeRaw).toUpperCase().trim()) || '',
        };

        assignmentsMap.set(compositeKey, item);
        if (!jobCodeToIndex.has(jobCode)) jobCodeToIndex.set(jobCode, []);
        jobCodeToIndex.get(jobCode).push(compositeKey);
      });

      // Step 2: Overlay Acceptance Reports
      let matchCount = 0;
      const unmatchedCodes = [];

      rawAcceptance.forEach(row => {
        const jobCodeRaw = getValFast(row, [
          'Mã cv (theo mã trong file chia. VD: QC1)',
          'Cú pháp check In', 'Mã CH', 'Ma CH', 'Mã cv',
          'job_code', 'jobCode'
        ], headerMapAcc);
        const jobCode = cleanKey(jobCodeRaw);
        // Extract report week from WEEKnum column (AJ)
        const upperJobCode = jobCode.toUpperCase();

        if (upperJobCode.includes('NEW_')) {
          console.log('FOUND NEW_ ROW IN ACCEPTANCE:', { jobCodeRaw, row });
        }

        if (!jobCode || (!upperJobCode.includes('QC') && !upperJobCode.includes('NEW_'))) return;

        const weekNumVal = getValFast(row, ['WEEKnum', 'WEEK_num', 'Week', 'Tuần', 'Tuan'], headerMapAcc);
        let reportWeekNum = parseInt(weekNumVal.toString().match(/\d+/)?.[0]) || 0;

        // Date fallback if WEEKnum is missing
        if (!reportWeekNum) {
          const dateStr = getValFast(row, ['Ngày báo cáo', 'Timestamp', 'Thời gian', 'Ngay bao cao'], headerMapAcc);
          if (dateStr) reportWeekNum = getCustomWeekNumber(dateStr.split(' ')[0]);
        }

        const reportWeekString = getWeekLabel(reportWeekNum);

        const picName = (getValFast(row, ['Tên nhân viên', 'Họ tên nhân sự', 'Nhân viên', 'Người báo cáo', 'Nhan vien'], headerMapAcc) || '').toString().trim();
        const picId = nameToId.get(stripAccents(picName).toLowerCase().trim()) || '';
        const pidNorm = picId.toString().trim().toLowerCase();
        const pNameNorm = stripAccents(picName).toLowerCase().trim();

        const keysAtLoc = jobCodeToIndex.get(jobCode) || [];

        // Sort missions: exact week match first, then pending before done
        const sortedKeys = [...keysAtLoc].sort((a, b) => {
          const mA = assignmentsMap.get(a);
          const mB = assignmentsMap.get(b);
          if (reportWeekString) {
            const aMatch = mA.week === reportWeekString;
            const bMatch = mB.week === reportWeekString;
            if (aMatch && !bMatch) return -1;
            if (!aMatch && bMatch) return 1;
          }
          if (mA.status !== 'Done' && mB.status === 'Done') return -1;
          if (mA.status === 'Done' && mB.status !== 'Done') return 1;
          return 0;
        });

        const targetKey = sortedKeys.find(k => {
          const m = assignmentsMap.get(k);
          const mPId = String(m.pic_id || '').trim().toLowerCase();
          const mPName = stripAccents(m.pic || '').toLowerCase().trim();
          if (pidNorm && mPId && mPId !== pidNorm) return false;
          if (!mPId && mPName !== pNameNorm) return false;
          return true;
        });

        if (upperJobCode.includes('NEW_')) {
          // Explicitly treat NEW_ as first-class Ad-hoc point
          const brand = getValFast(row, ['Brand', 'Nhãn hàng', 'Nhan hang'], headerMapAcc) || 'Khác';
          // Use stable key: jobcode + pic + week to prevent duplicates
          const stableKey = `${jobCodeRaw}__${stripAccents(picName)}__${reportWeekString || 'W??'}`;

          assignmentsMap.set(stableKey, {
            week: reportWeekString || 'W??',
            date_assigned: 'Phát sinh',
            brand: brand,
            job_code: jobCodeRaw,
            address: getValFast(row, ['Địa chỉ', 'dia chi', 'Address'], headerMapAcc) || 'N/A',
            district: getValFast(row, ['Quận', 'Huyện', 'District'], headerMapAcc) || 'Khác',
            city: getValFast(row, ['Thành Phố', 'Tỉnh', 'City'], headerMapAcc) || 'N/A',
            pic: picName,
            status: 'Done',
            pic_id: picId,
            is_virtual: true,
            is_adhoc: true,
            lat: null,
            lng: null,
            mall_name: 'N/A',
            note: 'Điểm phát sinh ngoài tuyến',
            completion_date: getValFast(row, ['Timestamp', 'Thời gian', 'Ngày báo cáo'], headerMapAcc) || '',
            posm_status: getValFast(row, ['POSM_Status', 'POSM Status', 'Tình trạng POSM'], headerMapAcc) || '',
            image1: getValFast(row, ['Link 1', 'Ảnh 1', 'Hình 1'], headerMapAcc),
            image2: getValFast(row, ['Link 2', 'Ảnh 2', 'Hình 2'], headerMapAcc),
            acceptance_note: getValFast(row, ['Ghi chú', 'Ghi chu', 'Note'], headerMapAcc),
            reported_by: picName,
            project: getValFast(row, ['Project', 'project', 'Dự án', 'Du an'], headerMapAcc)
              || localAdhocProjectMap.get(String(jobCodeRaw).toUpperCase().trim())
              || localAdhocProjectMap.get(String(jobCodeRaw).trim())
              || '',
          });
        } else if (targetKey) {
          const existing = assignmentsMap.get(targetKey);
          const accProject = getValFast(row, ['Project', 'project', 'Dự án', 'Du an'], headerMapAcc) || '';
          assignmentsMap.set(targetKey, {
            ...existing,
            status: 'Done',
            week: reportWeekString || existing.week,
            completion_date: getValFast(row, ['Timestamp', 'Thời gian', 'Ngày báo cáo'], headerMapAcc) || '',
            posm_status: getValFast(row, ['POSM_Status', 'POSM Status', 'Tình trạng POSM'], headerMapAcc) || '',
            image1: getValFast(row, ['Link 1', 'Ảnh 1', 'Hình 1'], headerMapAcc),
            image2: getValFast(row, ['Link 2', 'Ảnh 2', 'Hình 2'], headerMapAcc),
            acceptance_note: getValFast(row, ['Ghi chú', 'Ghi chu', 'Note'], headerMapAcc),
            reported_by: picName,
            project: accProject || existing.project || '',
          });
          matchCount++;
        } else {
          unmatchedCodes.push(jobCodeRaw);
          // Standard unmatched points (non-NEW_) stay in unmatchedCodes but don't create virtual points here
          // This keeps the master list clean of accidental "orphaned" reports
        }
      });

      // Step 3: Compute per-week stats for diagnostic panel
      const weeks = [...new Set(Array.from(assignmentsMap.values()).map(a => a.week))].sort((a, b) => {
        const numA = parseInt(String(a).match(/\d+/)?.[0]) || 0;
        const numB = parseInt(String(b).match(/\d+/)?.[0]) || 0;
        return numA - numB;
      });
      const weeklyStats = weeks.map(w => {
        const assigned = Array.from(assignmentsMap.values()).filter(a => a.week === w);
        return { week: w, total: assigned.length, matches: assigned.filter(a => a.status === 'Done').length };
      });

      // Step 4: Persist diagnostics
      localStorage.setItem('sync_diag', JSON.stringify({
        source: isPosmMock ? 'MOCK' : 'LIVE',
        acc_source: isAccMock ? 'MOCK' : 'LIVE',
        last_attempt: new Date().toISOString(),
        rows_mission: data.length,
        rows_reports: rawAcceptance.length,
        matches: matchCount,
        weekly_stats: weeklyStats,
        unmatched: Array.from(new Set(unmatchedCodes)).slice(0, 10),
        headers_mission: Array.from(headerMapData.keys()).slice(0, 15)
      }));

      // Step 5: Write to local DB
      let transformed = Array.from(assignmentsMap.values());

      // ── PERFORMANCE OPTIMIZATION ──────────────────────────────────────────
      // Staff users: only keep the 2 most recent weeks to reduce DB size and
      // improve load times.
      // Uses date_assigned (not week number) to correctly handle year rollovers
      // e.g., W52 (Jan 2025) is OLDER than W15 (Apr 2026)
      // Admin users: keep full history for oversight and analysis.
      if (user.role === 'staff') {
        // Find the max actual date per week label
        const weekMaxDate = new Map();
        transformed.forEach(item => {
          const weekKey = item.week;
          const dateStr = item.date_assigned || '';
          let ts = 0;
          if (dateStr) {
            const parts = dateStr.includes('/') ? dateStr.split('/') : dateStr.split('-');
            if (parts.length >= 3) {
              // DD/MM/YYYY
              const [d, m, y] = [parseInt(parts[0]), parseInt(parts[1]), parseInt(parts[2])];
              if (!isNaN(d) && !isNaN(m) && !isNaN(y) && y > 2000) {
                ts = new Date(y, m - 1, d).getTime();
              }
            }
          }
          if (!weekMaxDate.has(weekKey) || ts > weekMaxDate.get(weekKey)) {
            weekMaxDate.set(weekKey, ts);
          }
        });

        // Sort by actual date descending → pick top 2 truly most recent weeks
        const latestTwoWeeks = new Set(
          [...weekMaxDate.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 2)
            .map(([week]) => week)
        );

        transformed = transformed.filter(i => latestTwoWeeks.has(i.week));

        console.log(`[Sync] Staff mode: keeping ${[...latestTwoWeeks].join(', ')} → ${transformed.length} rows`);
      }
      // ─────────────────────────────────────────────────────────────────────

      await db.transaction('rw', [db.posmData, db.adhocPoints], async () => {
        await db.posmData.clear();
        await db.posmData.bulkPut(transformed);
        
        // Garbage Collection: Smarter local ad-hoc cleanup
        if (db.adhocPoints) {
          const allAdhocs = await db.adhocPoints.toArray();
          const now = Date.now();
          const syncJobCodes = new Set(transformed.map(i => i.job_code));

          // Normalize syncJobCodes to handle cleanKey() stripping vs raw job_code mismatch
          const syncJobCodesNorm = new Set(
            [...syncJobCodes].map(jc => String(jc || '').toUpperCase().trim())
          );

          // Build a map of job_code -> project from transformed to check if project was synced
          const syncedProjectMap = new Map();
          transformed.forEach(i => {
            if (i.job_code) syncedProjectMap.set(String(i.job_code).toUpperCase().trim(), i.project || '');
          });

          const toDelete = allAdhocs.filter(a => {
            const aCodeNorm = String(a.job_code || '').toUpperCase().trim();
            
            // Case 1: synced back AND project is preserved → safe to delete local draft
            if (syncJobCodesNorm.has(aCodeNorm)) {
              const syncedProject = syncedProjectMap.get(aCodeNorm) || '';
              const localProject = a.project || '';
              // Only delete if: no local project OR synced project matches local project
              if (!localProject || syncedProject === localProject) return true;
              // Has local project but synced doesn't have it yet → keep local draft
              console.log('[GC] Keeping local adhoc', a.job_code, 'project not synced yet:', localProject, '≠', syncedProject);
              return false;
            }

            // Case 2: Keep local draft for 30 minutes if not on sheet yet
            const submittedAt = a.submitted_at ? new Date(a.submitted_at).getTime() : 0;
            return (now - submittedAt) > 30 * 60 * 1000; // 30 minutes
          }).map(a => a.id);
          
          if (toDelete.length > 0) {
            await db.adhocPoints.bulkDelete(toDelete);
          }
        }
      });

      // Verification Log: Check how many NEW_ points actually made it into the DB
      const verifyAdhoc = await db.posmData
        .filter(x => String(x.job_code || '').toUpperCase().includes('NEW_'))
        .toArray();
      console.log('--- SYNC VERIFICATION ---');
      console.log('TOTAL MISSION ENTRIES:', transformed.length);
      console.log('SYNCED NEW_ COUNT:', verifyAdhoc.length, verifyAdhoc);

      setLastSync(new Date());

    } catch (error) {
      console.error('POSM Sync Failed:', error);
      localStorage.setItem('sync_error', error.message);
    } finally {
      setSyncing(false);
      syncInProgress = false;
    }
  }, [user, setLastSync]);

  // ── Lightweight acceptance-only sync ─────────────────────────────────────
  // Fetches only the acceptance CSV (~small) and overlays updates onto existing
  // DB records, WITHOUT clearing the DB or re-fetching the 4000+ row mission CSV.
  // Used after report submit (15s delay) and on a 3-minute polling interval.
  const pullAcceptanceOnly = useCallback(async () => {
    if (!user) return;
    try {
      const { data: rawAcc, isMock } = await fetchAcceptanceData();
      if (isMock || !rawAcc || rawAcc.length === 0) return;

      const headerMapAcc = getHeaderMap(rawAcc[0]);

      // Use existing DB records as base — no CSV re-fetch needed
      const existing = await db.posmData.toArray();
      const jobCodeIndex = new Map();
      existing.forEach(r => {
        if (!r.job_code) return;
        if (!jobCodeIndex.has(r.job_code)) jobCodeIndex.set(r.job_code, []);
        jobCodeIndex.get(r.job_code).push(r);
      });

      // Load local adhocPoints to preserve project field when GAS hasn't written it yet
      let localAdhocMap = new Map();
      try {
        if (db.adhocPoints) {
          const localAdhocs = await db.adhocPoints.toArray();
          localAdhocs.forEach(a => { if (a.job_code) localAdhocMap.set(a.job_code, a); });
        }
      } catch (e) { /* ignore */ }

      const updates = [];
      rawAcc.forEach(row => {
        const jobCodeRaw = getValFast(row, [
          'Mã cv (theo mã trong file chia. VD: QC1)',
          'Cú pháp check In', 'Mã CH', 'Ma CH', 'Mã cv', 'job_code', 'jobCode'
        ], headerMapAcc);
        const jobCode = cleanKey(jobCodeRaw);
        if (!jobCode) return;
        
        const upperJobCode = jobCode.toUpperCase();
        if (!upperJobCode.includes('QC') && !upperJobCode.includes('NEW_')) return;

        const picName = (getValFast(row, ['Tên nhân viên', 'Họ tên nhân sự', 'Nhân viên', 'Người báo cáo', 'Nhan vien'], headerMapAcc) || '').toString().trim();
        const newImage1       = getValFast(row, ['Link 1', 'Ảnh 1', 'Hình 1'], headerMapAcc);
        const newImage2       = getValFast(row, ['Link 2', 'Ảnh 2', 'Hình 2'], headerMapAcc);
        const completionDate  = getValFast(row, ['Timestamp', 'Thời gian', 'Ngày báo cáo'], headerMapAcc) || '';
        const posmStatus      = getValFast(row, ['POSM_Status', 'POSM Status', 'Tình trạng POSM'], headerMapAcc) || '';
        const accNote         = getValFast(row, ['Ghi chú', 'Ghi chu', 'Note'], headerMapAcc);
        // Read project from sheet — may be empty if GAS hasn't written it yet
        const sheetProject    = getValFast(row, ['Project', 'project', 'Dự án', 'Du an'], headerMapAcc) || '';

        const records  = jobCodeIndex.get(jobCode) || [];
        const target   = records.find(r => r.status !== 'Done') || records[0];

        // Resolve project from all available sources
        const localAdhoc = localAdhocMap.get(jobCode)
          || localAdhocMap.get(jobCodeRaw)  // try raw key too
          || Array.from(localAdhocMap.values()).find(a =>
              String(a.job_code || '').toUpperCase().trim() === jobCode.toUpperCase().trim()
            );
        const resolvedProject = sheetProject || target?.project || localAdhoc?.project || '';

        if (!target) {
          // NEW_ record not yet in posmData (full sync hasn't run) — create virtual entry
          if (!upperJobCode.includes('NEW_')) return;
          const la = localAdhoc;
          if (!la) return; // no local record either, skip
          updates.push({
            job_code: la.job_code || jobCodeRaw,
            brand: la.brand || '',
            address: la.address || '',
            pic: la.pic || picName,
            pic_id: la.pic_id || '',
            week: la.week || '',
            status: 'Done',
            is_adhoc: true,
            is_virtual: true,
            completion_date: completionDate,
            posm_status: posmStatus || '',
            image1: newImage1,
            image2: newImage2,
            acceptance_note: accNote,
            reported_by: picName,
            project: resolvedProject,
          });
          return;
        }

        // Skip records that haven't changed (avoid unnecessary writes)
        if (target.status === 'Done' && target.image1 === newImage1 && target.image1 && target.project === resolvedProject) return;

        updates.push({
          ...target,
          status: 'Done',
          completion_date: completionDate,
          posm_status: posmStatus || target.posm_status || '',
          image1: newImage1,
          image2: newImage2,
          acceptance_note: accNote,
          reported_by: picName,
          project: resolvedProject,
        });
      });

      if (updates.length > 0) {
        await db.posmData.bulkPut(updates);
        console.log(`[AcceptanceSync] ✅ ${updates.length} records updated`);
        setLastSync(new Date()); // Trigger UI refresh
      } else {
        console.log('[AcceptanceSync] No new changes');
      }
    } catch (err) {
      console.error('[AcceptanceSync] Failed:', err);
    }
  }, [user, setLastSync]);

  const clearAndResync = useCallback(async () => {
    setSyncing(true);
    try {
      await db.posmData.clear();
      await pullData(true);
    } catch (error) {
      console.error('Reset failed:', error);
    } finally {
      setSyncing(false);
    }
  }, [pullData]);

  // Auto-sync: full sync on login (every 20 min), acceptance-only every 3 min
  useEffect(() => {
    if (!user) return;
    pullData();
    const fullInterval = setInterval(pullData, FULL_SYNC_INTERVAL_MS);
    const accInterval  = setInterval(pullAcceptanceOnly, ACCEPTANCE_SYNC_INTERVAL_MS);
    return () => { clearInterval(fullInterval); clearInterval(accInterval); };
  }, [user?.user_id, pullData, pullAcceptanceOnly]);

  return { syncing, pullData, clearAndResync, pullAcceptanceOnly };
};
