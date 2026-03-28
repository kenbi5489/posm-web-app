import Dexie from 'dexie';

export const db = new Dexie('POSMTrackerDB');

db.version(3).stores({
  users: 'user_id, user_name, ho_ten, role',
  posmData: '++id, job_code, brand, pic_id, status, district',
  acceptanceData: '++id, job_code',
  syncQueue: '++id, type, payload, timestamp'
});

export const masterReset = async () => {
  await db.delete();
  localStorage.clear();
  window.location.reload();
};
