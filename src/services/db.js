import Dexie from 'dexie';

export const db = new Dexie('POSMTrackerDB');

// When another tab opens a newer DB version, close this connection gracefully.
db.on('versionchange', function () {
  db.close();
});

db.version(3).stores({
  users: 'user_id, user_name, ho_ten, role',
  posmData: '++id, job_code, brand, pic_id, status, district',
  acceptanceData: '++id, job_code',
  syncQueue: '++id, type, payload, timestamp'
});

// Version 4: Re-sync to fix lat/lng stored as 0 → null
db.version(4).stores({
  users: 'user_id, user_name, ho_ten, role',
  posmData: '++id, job_code, brand, pic_id, status, district, week',
  acceptanceData: '++id, job_code',
  syncQueue: '++id, type, payload, timestamp'
}).upgrade(async tx => {
  await tx.table('posmData').clear();
});

// Version 11: Flush cache to trigger full native Google Maps Geocoding integration
db.version(11).stores({
  users: 'user_id, user_name, ho_ten, role',
  posmData: '++id, job_code, brand, pic_id, status, district, week, pic',
  acceptanceData: '++id, job_code',
  syncQueue: '++id, type, payload, timestamp'
}).upgrade(async tx => {
  await tx.table('posmData').clear();
});

// Version 12: Add checkins table for GPS visit verification evidence
db.version(12).stores({
  users: 'user_id, user_name, ho_ten, role',
  posmData: '++id, job_code, brand, pic_id, status, district, week, pic',
  acceptanceData: '++id, job_code',
  syncQueue: '++id, type, payload, timestamp',
  checkins: '++id, job_code, pic_id, checkin_time, result'
});

export const masterReset = async () => {
  await db.delete();
  localStorage.clear();
  window.location.reload();
};
