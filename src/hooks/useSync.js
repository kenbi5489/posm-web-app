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
      
      console.log('Raw Data fetched:', data.length);
      console.log('Sample Row keys:', data.length > 0 ? Object.keys(data[0]) : 'None');
      
      // Helper to find column keys case-insensitively or with partial match
      // Returns the actual key name from the row, or null if not found
      const findKey = (row, pattern) => {
        const keys = Object.keys(row);
        const lower = pattern.toLowerCase();
        // Try exact match first (case-insensitive)
        const exact = keys.find(k => k.toLowerCase() === lower);
        if (exact) return exact;
        // Then try partial match
        return keys.find(k => k.toLowerCase().includes(lower)) || null;
      };
      
      const getVal = (row, pattern, fallback = '') => {
        const key = findKey(row, pattern);
        return key ? (row[key] ?? fallback) : fallback;
      };

      // Transform and Manual Deduplication
      const dedupMap = new Map();
      
      data.forEach(row => {
        const jobCodeKey = findKey(row, 'Mã cv');
        const keyMap = {
          jobCode: jobCodeKey,
          brand: findKey(row, 'Brand'),
          pic: findKey(row, 'PIC'),
          status: findKey(row, 'Status'),
          picId: findKey(row, 'pic_id')
        };
        
        const jobCode = keyMap.jobCode ? row[keyMap.jobCode]?.toString().trim() : null;
        if (!jobCode || jobCode === "" || jobCode.length < 2) return; // Skip invalid codes
        
        const latStr = getVal(row, 'latitude') || getVal(row, 'lat') || getVal(row, 'vĩ độ') || getVal(row, 'vi do') || '';
        const lngStr = getVal(row, 'longitude') || getVal(row, 'lng') || getVal(row, 'kinh độ') || getVal(row, 'kinh do') || '';
        
        const latRaw = parseFloat(latStr.toString().replace(',', '.'));
        const lngRaw = parseFloat(lngStr.toString().replace(',', '.'));
        
        const item = {
          week: (getVal(row, 'Week triển khai') || getVal(row, 'Week') || getVal(row, 'Tuần') || '').trim(),
          date_assigned: getVal(row, 'Ngày chia'),
          brand: (keyMap.brand ? (row[keyMap.brand] || '') : '').trim(),
          job_code: jobCode,
          address: getVal(row, 'Địa chỉ') || getVal(row, 'Dia chi'),
          ward: getVal(row, 'Phường') || getVal(row, 'Phuong'),
          district: getVal(row, 'Quận') || getVal(row, 'Quan'),
          city: getVal(row, 'Thành Phố') || getVal(row, 'Thanh Pho') || getVal(row, 'City'),
          pic: (keyMap.pic ? (row[keyMap.pic] || '') : '').trim(),
          status: (keyMap.status ? (row[keyMap.status] || 'On-going') : 'On-going').trim(),
          completion_date: getVal(row, 'Ngày hoàn thành') || row['Ngày hoàn thành (Typing theo thứ tự: Tháng/Ngày/Năm)'] || '',
          portal_id: getVal(row, 'Tài khoản Portal'),
          lat: isNaN(latRaw) ? null : latRaw,
          lng: isNaN(lngRaw) ? null : lngRaw,
          pic_id: (keyMap.picId ? (row[keyMap.picId]?.toString() || '') : '').trim()
        };
        
        // Use job_code as unique key to prevent doubling
        dedupMap.set(jobCode, item);
      });

      const transformed = Array.from(dedupMap.values());
      console.log('Final Deduped Count:', transformed.length);
      console.log('Items with valid coords:', transformed.filter(i => i.lat !== null && i.lng !== null).length);
      const picSet = [...new Set(transformed.map(i => i.pic))];
      console.log('Unique PICs:', picSet);
      const weekSet = [...new Set(transformed.map(i => i.week))];
      console.log('Unique Weeks:', weekSet);
      const brandSet = [...new Set(transformed.map(i => i.brand))];
      console.log('Unique Brands:', brandSet);

      const transformedAcceptance = rawAcceptance
        .map(row => ({
          job_code: row['Mã cv (theo mã trong file chia. VD: QC1)']?.toString().trim(),
          image1: row['Link 1'],
          image2: row['Link 2'],
          posm_status: row['POSM_Status'] || row['Có POSM không? Nhân viên thanh toán được không? '] || row['Tình trạng POSM'] || '',
          note: row['Ghi chú'] || ''
        }))
        .filter(item => item.job_code && item.job_code.length > 0);

      // Use bulkAdd after clear for stability
      try {
        await db.posmData.clear();
        await db.acceptanceData.clear();
        
        await db.transaction('rw', [db.posmData, db.acceptanceData], async () => {
          await db.posmData.bulkAdd(transformed);
          await db.acceptanceData.bulkAdd(transformedAcceptance);
        });
      } catch (dbErr) {
        console.warn("Bulk add failed, attempting put individually:", dbErr);
        for (const item of transformed) {
          try { await db.posmData.put(item); } catch(e) {}
        }
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
