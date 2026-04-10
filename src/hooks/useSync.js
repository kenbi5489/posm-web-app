import React, { useState, useEffect, useCallback } from 'react';
import { fetchPOSMData, fetchAcceptanceData } from '../services/api';
import { db } from '../services/db';
import { useAuth } from '../context/AuthContext';
import { getCustomWeekNumber } from '../utils/weekUtils';

let syncInProgress = false;
const SYNC_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

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

      const normalizeStr = (str) => str ? str.toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "") : "";
      const stripAccents = (s) => (s || '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

      const cleanKey = (str) => {
        if (!str) return '';
        // Allow underscores to preserve prefixes like NEW_
        return str.toString().replace(/[^a-zA-Z0-9_]/g, '').toUpperCase().trim();
      };

      const getHeaderMap = (row) => {
        const map = new Map();
        Object.keys(row).forEach(k => {
          const originalKey = k;
          const trimmedKey = k.toString().trim();
          map.set(normalizeStr(trimmedKey).toLowerCase(), originalKey);
          map.set(stripAccents(trimmedKey), originalKey);
        });
        return map;
      };

      const headerMapDataRaw = rawData.length > 0 ? getHeaderMap(rawData[0]) : new Map();

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
              // Handle DD/MM/YYYY
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
              // Approximate fallback
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

      // 2. DATA PREPARATION (No .slice(0, 5) - Full History)
      const data = rawData;
      const rawAcceptance = rawAcc;

      console.log('ACCEPTANCE SAMPLE ROW:', rawAcceptance[0]);
      const debugNew = rawAcceptance.filter(r => {
        const val = (r['Mã CH'] || r['Mã cv'] || r['job_code'] || '').toString().toUpperCase();
        return val.includes('NEW_');
      });
      console.log('RAW ACCEPTANCE NEW_ ROWS:', debugNew);

      const headerMapData = data.length > 0 ? getHeaderMap(data[0]) : new Map();
      const headerMapAcc = rawAcc.length > 0 ? getHeaderMap(rawAcc[0]) : new Map();

      const normStatus = (s) => {
        if (!s) return 'On-going';
        const clean = s.toString().toLowerCase().trim();
        if (['done', 'hoàn thành', 'hoan thanh', 'đã xong', 'da xong', 'ok', 'đạt', 'dat', 'xong'].includes(clean)) return 'Done';
        return 'On-going';
      };

      const assignmentsMap = new Map();
      const jobCodeToIndex = new Map();

      const users = await db.users.toArray();
      const nameToId = new Map();
      users.forEach(u => { if (u.ho_ten) nameToId.set(stripAccents(u.ho_ten).toLowerCase().trim(), u.user_id); });

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
            reported_by: picName
          });
        } else if (targetKey) {
          const existing = assignmentsMap.get(targetKey);
          assignmentsMap.set(targetKey, {
            ...existing,
            status: 'Done',
            week: reportWeekString || existing.week,
            completion_date: getValFast(row, ['Timestamp', 'Thời gian', 'Ngày báo cáo'], headerMapAcc) || '',
            posm_status: getValFast(row, ['POSM_Status', 'POSM Status', 'Tình trạng POSM'], headerMapAcc) || '',
            image1: getValFast(row, ['Link 1', 'Ảnh 1', 'Hình 1'], headerMapAcc),
            image2: getValFast(row, ['Link 2', 'Ảnh 2', 'Hình 2'], headerMapAcc),
            acceptance_note: getValFast(row, ['Ghi chú', 'Ghi chu', 'Note'], headerMapAcc),
            reported_by: picName
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
      const transformed = Array.from(assignmentsMap.values());
      await db.transaction('rw', [db.posmData, db.adhocPoints], async () => {
        await db.posmData.clear();
        await db.posmData.bulkPut(transformed);
        
        // Garbage Collection: Smarter local ad-hoc cleanup
        if (db.adhocPoints) {
          const allAdhocs = await db.adhocPoints.toArray();
          const now = Date.now();
          const syncJobCodes = new Set(transformed.map(i => i.job_code));

          const toDelete = allAdhocs.filter(a => {
            // Case 1: If it's already on the Sheet, clear the local draft immediately
            if (syncJobCodes.has(a.job_code)) return true;

            // Case 2: If it's NOT on the sheet, only keep it for 2 minutes (Safety window for Google GAS delay)
            // After 5 seconds, if it's still not on the sheet, assume it was deleted by Admin.
            const submittedAt = a.submitted_at ? new Date(a.submitted_at).getTime() : 0;
            return (now - submittedAt) > 5 * 1000; // 5 seconds
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

  // Auto-sync when user logs in and every 15 minutes
  useEffect(() => {
    if (!user) return;
    pullData();
    const interval = setInterval(pullData, SYNC_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [user?.user_id, pullData]);

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

  return { syncing, pullData, clearAndResync };
};
