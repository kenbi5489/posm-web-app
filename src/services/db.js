import Dexie from 'dexie';

export const db = new Dexie('POSMTrackerDB');

db.version(1).stores({
  users: 'user_id, user_name, ho_ten, role',
  posmData: '++id, mã_cv, job_code, brand, pic_id, status, district',
  acceptanceData: '++id, job_code',
  syncQueue: '++id, type, payload, timestamp'
});

export const clearLocalData = async () => {
  await db.users.clear();
  await db.posmData.clear();
  await db.acceptanceData.clear();
  await db.syncQueue.clear();
};
