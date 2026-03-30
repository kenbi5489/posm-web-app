import Dexie from 'dexie';

export const db = new Dexie('POSMTrackerDB');

// Handle db version upgrades across multiple tabs
db.on('versionchange', function (event) {
  // Automatically close to allow the new version to upgrade
  db.close();
  console.warn("Database version changed. Closing old connection.");
  // Optional: reload the page to get the new version
  window.location.reload();
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

// Version 5: Index pic, force re-sync to enable auto-geocoding
db.version(5).stores({
  users: 'user_id, user_name, ho_ten, role',
  posmData: '++id, job_code, brand, pic_id, status, district, week, pic',
  acceptanceData: '++id, job_code',
  syncQueue: '++id, type, payload, timestamp'
}).upgrade(async tx => {
  // Clear to force fresh sync so geocoding can run on missing coords
  await tx.table('posmData').clear();
});

export const masterReset = async () => {
  await db.delete();
  localStorage.clear();
  window.location.reload();
};
