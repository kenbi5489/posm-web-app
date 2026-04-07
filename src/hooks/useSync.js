import React, { useState, useEffect } from 'react';
import { fetchPOSMData, fetchAcceptanceData, updatePOSMStatus } from '../services/api';
import { db } from '../services/db';
import { useAuth } from '../context/AuthContext';

let syncInProgress = false;

export const useSync = (user) => {
  const [syncing, setSyncing] = useState(false);
  const { setLastSync, lastSync } = useAuth();

  const pullData = async () => {
    if (!user || syncInProgress) return;
    setSyncing(true);
    syncInProgress = true;
    try {
      const [data, rawAcceptance] = await Promise.all([
        fetchPOSMData(),
        fetchAcceptanceData()
      ]);
      
      const normalizeStr = (str) => str ? str.toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "") : "";
      const stripAccents = (s) => (s || '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
      
      const cleanKey = (str) => {
        if (!str) return '';
        // Remove all non-alphanumeric and force upper (QC-123 -> QC123)
        return str.toString().replace(/[^a-zA-Z0-9]/g, '').toUpperCase().trim();
      };

      // OPTIMIZATION: Index headers once
      const getHeaderMap = (row) => {
        const map = new Map();
        Object.keys(row).forEach(k => {
            map.set(normalizeStr(k).toLowerCase(), k);
            map.set(stripAccents(k), k);
        });
        return map;
      };

      const headerMapData = data.length > 0 ? getHeaderMap(data[0]) : new Map();
      const headerMapAcc = rawAcceptance.length > 0 ? getHeaderMap(rawAcceptance[0]) : new Map();
      
      const getValFast = (row, patterns, hMap) => {
        // 1. Exact map matching first (fastest)
        for (const p of patterns) {
            const normP = normalizeStr(p).toLowerCase();
            const stripP = stripAccents(p);
            const key = hMap.get(normP) || hMap.get(stripP);
            if (key !== undefined) {
               const val = (row[key] ?? '').toString().trim();
               if (val !== '') return val;
            }
        }
        // 2. Substring matching for long Google Form Headers
        for (const p of patterns) {
            const stripP = stripAccents(p);
            if (stripP.length < 4) continue; // Skip very short vague words
            for (const [hKey, originalKey] of hMap.entries()) {
               if (hKey.includes(stripP)) {
                  const val = (row[originalKey] ?? '').toString().trim();
                  if (val !== '') return val;
               }
            }
        }
        return '';
      };

      const assignmentsMap = new Map();
      const jobCodeToIndex = new Map();
      
      // Step 1: Pre-load users
      const users = await db.users.toArray();
      const nameToId = new Map();
      users.forEach(u => { if (u.ho_ten) nameToId.set(stripAccents(u.ho_ten), u.user_id); });

      // Step 2: Initialize assignments
      data.forEach(row => {
        const jobCodeRaw = getValFast(row, ['Mã cv', 'job_code', 'Ma cv', 'jobCode', 'Mã CV'], headerMapData)?.toString().trim();
        if (!jobCodeRaw || jobCodeRaw.length < 2) return;
        const jobCode = cleanKey(jobCodeRaw);

        const rawWeek = (getValFast(row, ['Week triển khai', 'Week', 'Tuần', 'WEEKnum', 'WEEK_num'], headerMapData) || '').toString().trim();
        const weekNum = rawWeek.replace(/[^0-9]/g, '');
        const week = rawWeek.toUpperCase().startsWith('W') ? rawWeek.toUpperCase() : (weekNum ? `W${weekNum}` : 'W??');
        const compositeKey = `${jobCode}_${week}`;

        const parseCoord = (s) => {
          if (!s) return null;
          const val = parseFloat(s.toString().replace(',', '.'));
          return isNaN(val) || val === 0 ? null : val;
        };

        const item = {
          week: week,
          date_assigned: getValFast(row, ['Ngày chia', 'Ngày', 'Date'], headerMapData),
          brand: getValFast(row, ['Brand', 'Nhãn hàng'], headerMapData),
          job_code: jobCode,
          address: getValFast(row, ['Địa chỉ', 'Dia chi', 'Address'], headerMapData),
          ward: getValFast(row, ['Phường', 'Phuong', 'Ward'], headerMapData),
          district: getValFast(row, ['Quận', 'Quan', 'District', 'Huyện'], headerMapData),
          city: getValFast(row, ['Thành Phố', 'Thanh Pho', 'City', 'Tỉnh'], headerMapData),
          pic: getValFast(row, ['PIC', 'Nhân viên', 'Người thực hiện'], headerMapData),
          status: 'On-going',
          completion_date: '',
          portal_id: getValFast(row, ['Tài khoản Portal', 'Portal'], headerMapData),
          posm_status_master: getValFast(row, ['POSM_Status', 'Tình trạng'], headerMapData),
          lat: parseCoord(getValFast(row, ['latitude', 'lat', 'vĩ độ'], headerMapData)),
          lng: parseCoord(getValFast(row, ['longitude', 'lng', 'kinh độ'], headerMapData)),
          pic_id: (getValFast(row, ['pic_id', 'Mã nhân viên', 'Staff ID', 'Emp ID', 'Ma NV'], headerMapData) || '').toString().trim(),
          mall_name: getValFast(row, ['Mall_Name', 'Mall', 'Trung tâm'], headerMapData) || 'N/A',
          location_type: getValFast(row, ['Location_Type', 'Type', 'Loại'], headerMapData) || 'N/A',
          frame: getValFast(row, ['Frame', 'Khung'], headerMapData) || 'N/A'
        };

        assignmentsMap.set(compositeKey, item);
        if (!jobCodeToIndex.has(jobCode)) jobCodeToIndex.set(jobCode, []);
        jobCodeToIndex.get(jobCode).push(compositeKey);
      });

      // Step 3: Fast Overlay reports
      let matchCount = 0;
      const reportSummary = [];
      const unmatchedCodes = [];
      
      rawAcceptance.forEach(row => {
        // Added 'Cú pháp check In' to catch the specific Google Form question format
        const jobCodeRaw = (getValFast(row, ['Cú pháp check In', 'Mã CH', 'Mã cv', 'job_code', 'jobCode', 'Mã CV'], headerMapAcc) || '').toString().trim();
        const jobCode = cleanKey(jobCodeRaw);
        
        // Added 'Họ tên nhân sự nghiệm thu' for correct PIC matching
        const picName = (getValFast(row, ['Họ tên nhân sự', 'Tên nhân viên', 'Nhân viên', 'Người báo cáo'], headerMapAcc) || '').toString().trim();
        const weekVal = getValFast(row, ['Week', 'Tuần', 'WEEKnum', 'Tuần triển khai'], headerMapAcc) || '';
        const weekNum = parseInt(weekVal.toString().replace(/\D/g, '')) || 0;
        const weekRaw = weekVal.toString().toUpperCase().startsWith('W') ? weekVal.toString().toUpperCase() : (weekNum ? `W${weekNum}` : '');
        
        const picId = nameToId.get(stripAccents(picName)) || '';
        let targetKey = null;
        const exactKey = `${jobCode}_${weekRaw}`;
        
        // Match Strategy 1: Exact Key (JobCode + Week)
        if (jobCode && weekRaw && assignmentsMap.has(exactKey)) {
          targetKey = exactKey;
        } 
        // Match Strategy 2: Fallback to inclusive search across PIC's jobs
        else if (jobCode) {
           const possibleKeys = Array.from(assignmentsMap.keys());
           targetKey = possibleKeys.find(k => {
              const item = assignmentsMap.get(k);
              // Must be the same PIC if we have multiple PICs
              if (picId && item.pic_id && item.pic_id !== picId) return false;
              
              const baseMissionCode = cleanKey(item.job_code);
              // Inclusive Match: Does the reported code contain the assigned code? 
              // (e.g. GS25824XADAN contains GS25824)
              if (baseMissionCode.length > 3 && jobCode.includes(baseMissionCode)) {
                return true;
              }
              return false;
           });
        }

        if (targetKey) {
          const existing = assignmentsMap.get(targetKey);
          const reportPosmStatus = getValFast(row, ['POSM_Status', 'POSM Status', 'Tình trạng POSM', 'Tình trạng'], headerMapAcc);
          
          assignmentsMap.set(targetKey, {
            ...existing,
            status: 'Done',
            pic: existing.pic || picName,
            pic_id: existing.pic_id || picId,
            completion_date: getValFast(row, ['Timestamp', 'Thời gian', 'Ngày báo cáo'], headerMapAcc) || '',
            posm_status: reportPosmStatus || existing.posm_status_master || '',
            reported_by: picName
          });
          matchCount++;
          reportSummary.push({ jobCode, matched: targetKey, picName });
        } else if (jobCode) {
          unmatchedCodes.push(jobCodeRaw);
        }
      });

      // Save mismatches for UI Diagnostic panel
      localStorage.setItem('sync_mismatches', JSON.stringify([...new Set(unmatchedCodes)].slice(0, 10)));

      console.group('POSM Sync Overlay Result');
      console.log(`Successfully matched ${matchCount}/${rawAcceptance.length} reports to missions.`);
      if (reportSummary.length > 0) console.table(reportSummary.slice(0, 20));
      console.groupEnd();

      const transformed = Array.from(assignmentsMap.values());
      const transformedAcceptance = rawAcceptance
        .map(row => {
          const rawJob = getValFast(row, ['Cú pháp check In', 'Mã CH', 'Mã cv', 'job_code', 'jobCode'], headerMapAcc) || '';
          return {
            job_code: cleanKey(rawJob),
            image1: getValFast(row, ['Link 1', 'Ảnh 1', 'Ảnh nghiệm thu'], headerMapAcc) || '',
            image2: getValFast(row, ['Link 2', 'Ảnh 2'], headerMapAcc) || '',
            posm_status: getValFast(row, ['POSM_Status', 'POSM Status', 'Tình trạng POSM'], headerMapAcc) || '',
            note: getValFast(row, ['Ghi chú'], headerMapAcc) || ''
          };
        })
        .filter(item => item.job_code && item.job_code.length > 0);

      await db.transaction('rw', [db.posmData, db.acceptanceData], async () => {
        await db.posmData.clear();
        await db.acceptanceData.clear();
        await db.posmData.bulkAdd(transformed);
        await db.acceptanceData.bulkAdd(transformedAcceptance);
      });
      setLastSync(new Date());
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      setSyncing(false);
      syncInProgress = false;
    }
  };

  const syncUpdates = async (scriptUrl) => {
    const queue = await db.syncQueue.toArray();
    if (queue.length === 0) return;
    for (const item of queue) {
      try {
        await updatePOSMStatus(scriptUrl, item.payload);
        await db.syncQueue.delete(item.id);
      } catch (error) { console.error('Failed to sync item:', item.id, error); }
    }
  };

  useEffect(() => {
    if (user) {
      pullData();
      const handleOnline = () => {
        const scriptUrl = localStorage.getItem('apps_script_url');
        if (scriptUrl) syncUpdates(scriptUrl);
      };
      window.addEventListener('online', handleOnline);
      return () => window.removeEventListener('online', handleOnline);
    }
  }, [user?.user_id]);

  return { syncing, lastSync, pullData, syncUpdates };
};
