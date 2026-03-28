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
      const findKey = (row, pattern) => {
        const keys = Object.keys(row);
        return keys.find(k => k.toLowerCase().includes(pattern.toLowerCase())) || pattern;
      };

      // Transform and Manual Deduplication
      const dedupMap = new Map();
      
      data.forEach(row => {
        const keyMap = {
          jobCode: findKey(row, 'Mã cv'),
          brand: findKey(row, 'Brand'),
          pic: findKey(row, 'PIC'),
          status: findKey(row, 'Status'),
          picId: findKey(row, 'pic_id')
        };
        
        const jobCode = row[keyMap.jobCode]?.toString().trim();
        if (!jobCode || jobCode === "" || jobCode.length < 2) return; // Skip invalid codes
        
        const item = {
          week: row[findKey(row, 'Week triển khai')],
          date_assigned: row[findKey(row, 'Ngày chia')],
          brand: row[keyMap.brand] || '',
          job_code: jobCode,
          address: row[findKey(row, 'Địa chỉ')] || '',
          ward: row[findKey(row, 'Phường')] || '',
          district: row[findKey(row, 'Quận')] || '',
          city: row[findKey(row, 'Thành Phố')] || '',
          pic: row[keyMap.pic] || '',
          status: row[keyMap.status] || 'On-going',
          completion_date: row['Ngày hoàn thành (Typing theo thứ tự: Tháng/Ngày/Năm)'] || row['Ngày hoàn thành'] || '',
          portal_id: row[findKey(row, 'Tài khoản Portal')] || '',
          lat: parseFloat(row[findKey(row, 'latitude')]) || 0,
          lng: parseFloat(row[findKey(row, 'longitude')]) || 0,
          pic_id: row[keyMap.picId]?.toString().trim() || ''
        };
        
        // Use job_code as unique key to prevent doubling
        dedupMap.set(jobCode, item);
      });

      const transformed = Array.from(dedupMap.values());
      console.log('Final Deduped Count:', transformed.length);

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
