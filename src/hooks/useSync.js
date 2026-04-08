import React, { useState, useEffect, useCallback } from 'react';
import { fetchPOSMData, fetchAcceptanceData } from '../services/api';
import { db } from '../services/db';
import { useAuth } from '../context/AuthContext';

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
        return str.toString().replace(/[^a-zA-Z0-9]/g, '').toUpperCase().trim();
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
          const num = parseInt(weekNumVal.toString().replace(/\D/g, '')) || 0;
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

      const headerMapData = data.length > 0 ? getHeaderMap(data[0]) : new Map();
      const headerMapAcc = rawAcc.length > 0 ? getHeaderMap(rawAcc[0]) : new Map();

      const getWeekNumber = (date) => {
        const d = new Date(date);
        if (isNaN(d.getTime())) return 0;
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() + 4 - (d.getDay() || 7));
        const yearStart = new Date(d.getFullYear(), 0, 1);
        return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
      };

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
      users.forEach(u => { if (u.ho_ten) nameToId.set(stripAccents(u.ho_ten), u.user_id); });

      // Step 1: Build Missions (Master Data)
      data.forEach((row, index) => {
        const jobCodeRaw = getValFast(row, ['Mã cv', 'job_code', 'Ma cv', 'jobCode', 'Mã CV'], headerMapData);
        if (!jobCodeRaw || jobCodeRaw.length < 2) return;
        const jobCode = cleanKey(jobCodeRaw);

        const weekNumVal = getValFast(row, ['WEEKnum', 'WEEK_num', 'WEEK num', 'weeknum'], headerMapData);
        let weekNum = parseInt(weekNumVal.toString().replace(/\D/g, '')) || 0;

        if (!weekNum) {
          const fallbackWeek = getValFast(row, ['Week triển khai', 'Week', 'Tuần', 'Tuan'], headerMapData);
          weekNum = parseInt(fallbackWeek.toString().replace(/\D/g, '')) || 0;
        }

        const week = getWeekLabel(weekNum);
        const brand = getValFast(row, ['Brand', 'Nhãn hàng', 'Nhan hang'], headerMapData) || 'N/A';
        const compositeKey = `${jobCode}_${week}_${brand}_${index}`;

        const parseCoord = (s) => {
          if (!s) return null;
          const val = parseFloat(s.toString().replace(',', '.'));
          return isNaN(val) || val === 0 ? null : val;
        };

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
          'Cú pháp check In', 'Mã CH', 'Ma CH', 'Mã cv',
          'Mã cv (theo mã trong file chia. VD: QC1)',
          'job_code', 'jobCode'
        ], headerMapAcc);
        const jobCode = cleanKey(jobCodeRaw);
        // Extract report week from WEEKnum column (AJ)
        if (!jobCode || !jobCode.toUpperCase().includes('QC')) return;
        
        const weekNumVal = getValFast(row, ['WEEKnum', 'WEEK_num', 'Week', 'Tuần', 'Tuan'], headerMapAcc);
        let reportWeekNum = parseInt(weekNumVal.toString().replace(/\D/g, '')) || 0;

        // Date fallback if WEEKnum is missing
        if (!reportWeekNum) {
          const dateStr = getValFast(row, ['Ngày báo cáo', 'Timestamp', 'Thời gian', 'Ngay bao cao'], headerMapAcc);
          if (dateStr) reportWeekNum = getWeekNumber(dateStr.split(' ')[0]);
        }

        const reportWeekString = getWeekLabel(reportWeekNum);

        const picName = (getValFast(row, ['Họ tên nhân sự', 'Tên nhân viên', 'Nhân viên', 'Người báo cáo', 'Nhan vien'], headerMapAcc) || '').toString().trim();
        const picId = nameToId.get(stripAccents(picName)) || '';
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

        if (targetKey) {
          const existing = assignmentsMap.get(targetKey);
          assignmentsMap.set(targetKey, {
            ...existing,
            status: 'Done',
            week: reportWeekString || existing.week, // Override master week with report WEEKnum (AJ)
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
        }
      });

      // Step 3: Compute per-week stats for diagnostic panel
      const weeks = [...new Set(Array.from(assignmentsMap.values()).map(a => a.week))].sort((a,b) => {
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
      await db.transaction('rw', [db.posmData], async () => {
        await db.posmData.clear();
        await db.posmData.bulkAdd(transformed);
      });
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
