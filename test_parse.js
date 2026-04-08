const fs = require('fs');
const Papa = require('papaparse');

const csv = fs.readFileSync('acc_export.csv', 'utf8');
const results = Papa.parse(csv, { header: true, skipEmptyLines: true });
const rawAcc = results.data;

const normalizeStr = (str) => str ? str.toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "") : "";
const stripAccents = (s) => (s || '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

const getHeaderMap = (row) => {
  const map = new Map();
  Object.keys(row).forEach(k => {
    const originalKey = k;
    const trimmedKey = k.toString().trim();
    map.set(normalizeStr(trimmedKey).toLowerCase(), originalKey);
    map.set(stripAccents(trimmedKey), originalKey);
  });
  return map;
};

const getValFast = (row, patterns, hMap) => {
  for (const p of patterns) {
    const normP = normalizeStr(p.trim()).toLowerCase();
    const stripP = stripAccents(p.trim());
    const key = hMap.get(normP) || hMap.get(stripP);
    if (key !== undefined) {
      const val = (row[key] || '').toString().trim();
      if (val !== '') return val;
    }
  }
  return '';
};

const hMap = getHeaderMap(rawAcc[0]);
let found = 0;
for(let i=0; i<10; i++) {
   let row = rawAcc[i];
   let link1 = getValFast(row, ['Link 1', 'Ảnh 1', 'Hình 1'], hMap);
   let note = getValFast(row, ['Ghi chú', 'Ghi chu', 'Note'], hMap);
   console.log(`Row ${i}: Link1="${link1}" Note="${note}"`);
   if(link1) found++;
}
console.log('Total found links in first 10:', found);
