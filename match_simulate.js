const fs = require('fs');
const Papa = require('papaparse');
const acc = Papa.parse(fs.readFileSync('acc_export.csv', 'utf8'), {header:false}).data;
const data = Papa.parse(fs.readFileSync('posmdata_export.csv', 'utf8'), {header:false}).data;

const stripAccents = s => (s||'').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const cleanKey = s => (s||'').toString().replace(/[^a-zA-Z0-9]/g, '').toUpperCase().trim();

const assignmentsMap = new Map();
const jobCodeToIndex = new Map();

data.slice(1).forEach((row, index) => {
    if (row.length < 12) return;
    const jc = cleanKey(row[3]);
    if (!jc) return;
    const item = {
        week: row[0].toUpperCase(),
        pic: row[11],
        status: row[12].trim() || 'On-going',
        pic_id: ''
    };
    const key = `${jc}_${item.week}_${index}`;
    assignmentsMap.set(key, item);
    if (!jobCodeToIndex.has(jc)) jobCodeToIndex.set(jc, []);
    jobCodeToIndex.get(jc).push(key);
});

let failed_codes = [];
acc.slice(1).forEach(row => {
    if (row.length < 35) return;
    let reportWeekString = row[35].trim().toUpperCase() === 'W13' ? 'W13' : '';
    // Let's implement full WEEKnum logic from JS
    const rawW = row[35].trim();
    const wNum = parseInt(rawW.replace(/\D/g, '')) || 0;
    reportWeekString = wNum ? `W${wNum}` : '';

    const picName = row[1];
    
    if (stripAccents(picName) !== stripAccents('Lê Anh Tuấn') || reportWeekString !== 'W13') return;

    const jc = cleanKey(row[4]);
    const pidNorm = '';
    const pNameNorm = stripAccents(picName).toLowerCase().trim();

    const keysAtLoc = jobCodeToIndex.get(jc) || [];
    const sortedKeys = [...keysAtLoc].sort((a, b) => {
        const mA = assignmentsMap.get(a);
        const mB = assignmentsMap.get(b);
        if (reportWeekString) {
        const aWeekMatch = mA.week === reportWeekString;
        const bWeekMatch = mB.week === reportWeekString;
        if (aWeekMatch && !bWeekMatch) return -1;
        if (!aWeekMatch && bWeekMatch) return 1;
        }
        if (mA.status !== 'Done' && mB.status === 'Done') return -1;
        if (mA.status === 'Done' && mB.status !== 'Done') return 1;
        return 0;
    });

    const targetKey = sortedKeys.find(k => {
        const m = assignmentsMap.get(k);
        const mPId = String(m.pic_id || '').trim().toLowerCase();
        const mPName = stripAccents(m.pic || '').toLowerCase().trim();
        if (pidNorm && mPId && mPId !== pidNorm) return false;
        if (!mPId && mPName !== pNameNorm) return false;
        return true; 
    });

    if (targetKey) {
        const existing = assignmentsMap.get(targetKey);
        assignmentsMap.set(targetKey, {
            ...existing,
            status: 'Done',
            week: reportWeekString || existing.week,
        });
    } else {
        failed_codes.push(jc);
    }
});

console.log('Failed:', failed_codes);
console.log('W13 total assigned (W13 + migrated):', Array.from(assignmentsMap.values()).filter(a => stripAccents(a.pic) === 'le anh tuan' && a.week === 'W13').length);
console.log('W13 total done:', Array.from(assignmentsMap.values()).filter(a => stripAccents(a.pic) === 'le anh tuan' && a.week === 'W13' && stripAccents(a.status) == 'done').length);
