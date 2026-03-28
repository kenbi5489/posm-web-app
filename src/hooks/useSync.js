import React, { useState, useEffect } from 'react';
import { fetchPOSMData, fetchAcceptanceData, updatePOSMStatus } from '../services/api';
import { db } from '../services/db';
import { useAuth } from '../context/AuthContext';

export const useSync = (user) => {
  const [syncing, setSyncing] = useState(false);
  const { setLastSync, lastSync } = useAuth();

  const pullData = async () => {
    if (!user) return;
    setSyncing(true);
    try {
      const [data, rawAcceptance] = await Promise.all([
        fetchPOSMData(),
        fetchAcceptanceData()
      ]);
      
      // Transform data for local DB (lowercase keys for easier access)
      const transformed = data.map(row => ({
        week: row['Week triển khai'],
        date_assigned: row['Ngày chia'],
        brand: row['Brand'],
        job_code: row['Mã cv'],
        mã_cv: row['Mã cv'],
        address: row['Địa chỉ'],
        ward: row['Phường'],
        district: row['Quận'],
        city: row['Thành Phố'],
        pic: row['PIC'],
        status: row['Status'],
        completion_date: row['Ngày hoàn thành (Typing theo thứ tự: Tháng/Ngày/Năm)'] || row['Ngày hoàn thành'],
        portal_id: row['Tài khoản Portal'],
        lat: parseFloat(row['latitude']),
        lng: parseFloat(row['longitude']),
        pic_id: row['pic_id']
      }));

      const transformedAcceptance = rawAcceptance.map(row => ({
        job_code: row['Mã cv (theo mã trong file chia. VD: QC1)'],
        image1: row['Link 1'],
        image2: row['Link 2'],
        posm_status: row['POSM_Status'] || row['Có POSM không? Nhân viên thanh toán được không? '] || row['Tình trạng POSM'] || '',
        note: row['Ghi chú'] || ''
      })).filter(item => item.job_code);

      await db.posmData.clear();
      await db.acceptanceData.clear();
      await Promise.all([
        db.posmData.bulkAdd(transformed),
        db.acceptanceData.bulkAdd(transformedAcceptance)
      ]);
      setLastSync(new Date());
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      setSyncing(false);
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
