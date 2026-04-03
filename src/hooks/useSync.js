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
      
      const findKey = (row, pattern) => {
        const keys = Object.keys(row);
        const lower = pattern.toLowerCase();
        const exact = keys.find(k => k.toLowerCase() === lower);
        if (exact) return exact;
        return keys.find(k => k.toLowerCase().includes(lower)) || null;
      };
      
      const getVal = (row, pattern, fallback = '') => {
        const key = findKey(row, pattern);
        if (!key && pattern.toLowerCase() === 'week') {
           const weekNumKey = Object.keys(row).find(k => k.toLowerCase() === 'weeknum');
           if (weekNumKey) return (row[weekNumKey] ?? fallback);
        }
        return key ? (row[key] ?? fallback) : fallback;
      };

      const assignmentsMap = new Map();
      
      // Step 1: Initialize all assignments from "Data chia hàng tuần" as On-going
      data.forEach(row => {
        const jobCodeKey = findKey(row, 'Mã cv');
        const jobCode = jobCodeKey ? row[jobCodeKey]?.toString().trim() : null;
        if (!jobCode || jobCode === "" || jobCode.length < 2) return;

        const latStr = getVal(row, 'latitude') || getVal(row, 'lat') || getVal(row, 'vĩ độ') || getVal(row, 'vi do') || '';
        const lngStr = getVal(row, 'longitude') || getVal(row, 'lng') || getVal(row, 'kinh độ') || getVal(row, 'kinh do') || '';
        const latRaw = parseFloat(latStr.toString().replace(',', '.'));
        const lngRaw = parseFloat(lngStr.toString().replace(',', '.'));
        
        assignmentsMap.set(jobCode, {
          week: (getVal(row, 'Week triển khai') || getVal(row, 'Week') || getVal(row, 'Tuần') || getVal(row, 'WEEKnum') || '').trim(),
          date_assigned: getVal(row, 'Ngày chia'),
          brand: getVal(row, 'Brand'),
          job_code: jobCode,
          address: getVal(row, 'Địa chỉ') || getVal(row, 'Dia chi'),
          ward: getVal(row, 'Phường') || getVal(row, 'Phuong'),
          district: getVal(row, 'Quận') || getVal(row, 'Quan') || getVal(row, 'District'),
          city: getVal(row, 'Thành Phố') || getVal(row, 'Thanh Pho') || getVal(row, 'City'),
          pic: getVal(row, 'PIC'),
          status: 'On-going', // DEFAULT
          completion_date: '',
          portal_id: getVal(row, 'Tài khoản Portal'),
          posm_status_master: getVal(row, 'POSM_Status'),
          lat: isNaN(latRaw) ? null : latRaw,
          lng: isNaN(lngRaw) ? null : lngRaw,
          pic_id: (getVal(row, 'pic_id') || '').toString().trim(),
          mall_name: getVal(row, 'Mall_Name') || getVal(row, 'Mall') || 'N/A',
          location_type: getVal(row, 'Location_Type') || getVal(row, 'Type') || 'N/A',
          frame: getVal(row, 'Frame') || 'N/A'
        });
      });

      // Step 2: Overlay "Data nghiệm thu" to mark items as Done and update their week
      rawAcceptance.forEach(row => {
        const jobCode = (row['Mã cv (theo mã trong file chia. VD: QC1)'] || row['Mã cv'] || row['jobCode'] || row['Mã CV'] || row['mã cv'])?.toString().trim();
        if (!jobCode) return;

        // User specifically asked to check week from AJ (WEEKnum) in this sheet
        const weekRaw = (row['WEEKnum'] || row['Week'] || row['Tuần'] || '').trim();
        
        const existing = assignmentsMap.get(jobCode);
        if (existing) {
          assignmentsMap.set(jobCode, {
            ...existing,
            status: 'Done',
            week: weekRaw || existing.week, // Use WEEKnum if available
            completion_date: row['Timestamp'] || ''
          });
        } else {
          // If a report exists for a shop not in the assignment list, we still show it in "Done"
          assignmentsMap.set(jobCode, {
            job_code: jobCode,
            brand: row['Brand'] || 'Unknown',
            address: row['Địa chỉ'] || row['Dia chi'] || 'N/A',
            pic: row['Tên nhân viên'] || row['Nhân viên'] || '',
            status: 'Done',
            week: weekRaw || 'Unknown',
            district: row['District'] || row['Quận'] || 'N/A',
            city: row['City'] || row['Thành Phố'] || 'N/A',
            completion_date: row['Timestamp'] || ''
          });
        }
      });

      const transformed = Array.from(assignmentsMap.values());
      const transformedAcceptance = rawAcceptance
        .map(row => ({
          job_code: (row['Mã cv (theo mã trong file chia. VD: QC1)'] || row['Mã cv'] || row['jobCode'] || row['Mã CV'])?.toString().trim(),
          image1: row['Link 1'] || row['Ảnh 1'] || '',
          image2: row['Link 2'] || row['Ảnh 2'] || '',
          posm_status: row['POSM_Status'] || row['POSM Status'] || row['Tình trạng POSM'] || '',
          note: row['Ghi chú'] || ''
        }))
        .filter(item => item.job_code && item.job_code.length > 0);

      try {
        await db.posmData.clear();
        await db.acceptanceData.clear();
        await db.transaction('rw', [db.posmData, db.acceptanceData], async () => {
          await db.posmData.bulkAdd(transformed);
          await db.acceptanceData.bulkAdd(transformedAcceptance);
        });
      } catch (dbErr) {
        console.warn("DB Update failed, pulling manually:", dbErr);
      }

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
