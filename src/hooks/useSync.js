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
      
      const normalizeStr = (s) => (s || '').normalize('NFC').trim();
      const stripAccents = (s) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
      
      const findKey = (row, pattern) => {
        const keys = Object.keys(row);
        const normPattern = normalizeStr(pattern).toLowerCase();
        const cleanPattern = stripAccents(pattern);
        
        // 1. Exact match (case insensitive, normalized)
        const exact = keys.find(k => normalizeStr(k).toLowerCase() === normPattern);
        if (exact) return exact;
        
        // 2. Includes match (case insensitive, normalized)
        const inclusion = keys.find(k => normalizeStr(k).toLowerCase().includes(normPattern));
        if (inclusion) return inclusion;
        
        // 3. Accents-stripped match (super robust)
        const stripped = keys.find(k => stripAccents(k).includes(cleanPattern));
        return stripped || null;
      };
      
      const getVal = (row, pattern, fallback = '') => {
        const key = findKey(row, pattern);
        return key ? (row[key] ?? fallback) : fallback;
      };

      const assignmentsMap = new Map();
      const jobCodeToIndex = new Map(); // job_code -> array of composite keys
      
      // Step 1: Pre-load users for PIC ID mapping
      const users = await db.users.toArray();
      const nameToId = new Map();
      users.forEach(u => {
        if (u.ho_ten) nameToId.set(stripAccents(u.ho_ten), u.user_id);
      });

      // Step 2: Initialize assignments from GID_DATA
      data.forEach(row => {
        const jobCodeKey = findKey(row, 'Mã cv') || findKey(row, 'job_code') || findKey(row, 'Ma cv');
        const jobCode = jobCodeKey ? row[jobCodeKey]?.toString().trim() : null;
        if (!jobCode || jobCode.length < 2) return;

        const rawWeek = (getVal(row, 'Week triển khai') || getVal(row, 'Week') || getVal(row, 'Tuần') || getVal(row, 'WEEKnum') || '').toString().trim();
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
          date_assigned: getVal(row, 'Ngày chia'),
          brand: getVal(row, 'Brand'),
          job_code: jobCode,
          address: getVal(row, 'Địa chỉ') || getVal(row, 'Dia chi'),
          ward: getVal(row, 'Phường') || getVal(row, 'Phuong'),
          district: getVal(row, 'Quận') || getVal(row, 'Quan') || getVal(row, 'District'),
          city: getVal(row, 'Thành Phố') || getVal(row, 'Thanh Pho') || getVal(row, 'City'),
          pic: getVal(row, 'PIC'),
          status: 'On-going',
          completion_date: '',
          portal_id: getVal(row, 'Tài khoản Portal'),
          posm_status_master: getVal(row, 'POSM_Status'),
          lat: parseCoord(getVal(row, 'latitude') || getVal(row, 'lat') || getVal(row, 'vĩ độ')),
          lng: parseCoord(getVal(row, 'longitude') || getVal(row, 'lng') || getVal(row, 'kinh độ')),
          pic_id: (getVal(row, 'pic_id') || '').toString().trim(),
          mall_name: getVal(row, 'Mall_Name') || getVal(row, 'Mall') || 'N/A',
          location_type: getVal(row, 'Location_Type') || getVal(row, 'Type') || 'N/A',
          frame: getVal(row, 'Frame') || 'N/A'
        };

        assignmentsMap.set(compositeKey, item);
        if (!jobCodeToIndex.has(jobCode)) jobCodeToIndex.set(jobCode, []);
        jobCodeToIndex.get(jobCode).push(compositeKey);
      });

      console.log(`Synced ${assignmentsMap.size} assignments`);

      // Step 3: Fast Overlay reports
      let matchedCount = 0;
      let unmatchedCount = 0;

      rawAcceptance.forEach(row => {
        const jobCode = (getVal(row, 'Mã cv') || getVal(row, 'job_code') || getVal(row, 'jobCode') || getVal(row, 'Mã CV') || '').toString().trim().toUpperCase();
        const picName = (getVal(row, 'Tên nhân viên') || getVal(row, 'Nhân viên') || '').toString().trim();
        const weekVal = getVal(row, 'Week') || getVal(row, 'Tuần') || getVal(row, 'WEEKnum') || '';
        const weekNum = parseInt(weekVal.toString().replace(/\D/g, '')) || 0;
        const weekRaw = weekVal.toString().toUpperCase().startsWith('W') ? weekVal.toString().toUpperCase() : (weekNum ? `W${weekNum}` : '');
        
        const picId = nameToId.get(stripAccents(picName)) || '';
        
        let targetKey = null;
        const exactKey = `${jobCode}_${weekRaw}`;
        
        if (jobCode && weekRaw && assignmentsMap.has(exactKey)) {
          targetKey = exactKey;
        } else if (jobCode && jobCodeToIndex.has(jobCode)) {
          const possibilities = jobCodeToIndex.get(jobCode);
          // Improved Fuzzy PIC Matching: Try exact first, then partial
          targetKey = possibilities.find(k => {
            const item = assignmentsMap.get(k);
            const aPic = stripAccents(item.pic);
            const rPic = stripAccents(picName);
            return !rPic || aPic === rPic || aPic.includes(rPic) || rPic.includes(aPic);
          }) || possibilities[0];
        }

        if (targetKey) {
          const existing = assignmentsMap.get(targetKey);
          const reportPosmStatus = getVal(row, 'POSM_Status') || getVal(row, 'POSM Status') || getVal(row, 'Tình trạng POSM');
          
          matchedCount++;
          assignmentsMap.set(targetKey, {
            ...existing,
            status: 'Done',
            // PRESERVE original PIC ownership if it exists
            pic: existing.pic || picName,
            pic_id: existing.pic_id || picId,
            week: existing.week || weekRaw, 
            completion_date: getVal(row, 'Timestamp') || '',
            posm_status: reportPosmStatus || existing.posm_status_master || '',
            reported_by: picName // Keep track of who reported it separately
          });
        } else if (jobCode) {
          unmatchedCount++;
          // New discovery
          const key = `${jobCode}_${weekRaw || 'Unknown'}`;
          const reportPosmStatus = getVal(row, 'POSM_Status') || getVal(row, 'POSM Status') || getVal(row, 'Tình trạng POSM');
          assignmentsMap.set(key, {
            job_code: jobCode,
            brand: getVal(row, 'Brand') || 'Unknown',
            address: getVal(row, 'Địa chỉ') || getVal(row, 'Dia chi') || 'N/A',
            pic: picName,
            pic_id: picId,
            status: 'Done',
            week: weekRaw || 'Unknown',
            district: getVal(row, 'District') || getVal(row, 'Quận') || getVal(row, 'Quan') || 'N/A',
            city: getVal(row, 'City') || getVal(row, 'Thành Phố') || getVal(row, 'Thanh Pho') || 'N/A',
            completion_date: getVal(row, 'Timestamp') || '',
            posm_status: reportPosmStatus || '',
            reported_by: picName
          });
        }
      });

      console.log(`[Sync Stats] Matched: ${matchedCount}, Unmatched: ${unmatchedCount}`);

      const transformed = Array.from(assignmentsMap.values());
      const transformedAcceptance = rawAcceptance
        .map(row => ({
          job_code: getVal(row, 'Mã cv') || getVal(row, 'job_code') || getVal(row, 'jobCode'),
          image1: getVal(row, 'Link 1') || getVal(row, 'Ảnh 1') || getVal(row, 'Ảnh nghiệm thu') || '',
          image2: getVal(row, 'Link 2') || getVal(row, 'Ảnh 2') || '',
          posm_status: getVal(row, 'POSM_Status') || getVal(row, 'POSM Status') || getVal(row, 'Tình trạng POSM') || '',
          note: getVal(row, 'Ghi chú') || ''
        }))
        .filter(item => item.job_code && item.job_code.length > 0);

      // Final Step: Atomic DB Update
      await db.transaction('rw', [db.posmData, db.acceptanceData], async () => {
        await db.posmData.clear();
        await db.acceptanceData.clear();
        await db.posmData.bulkAdd(transformed);
        await db.acceptanceData.bulkAdd(transformedAcceptance);
      });

      console.log(`Sync complete. Saved ${transformed.length} assignments.`);
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
      } catch (error) {
        console.error('Failed to sync item:', item.id, error);
      }
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
