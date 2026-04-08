const fs = require('fs');
const Papa = require('papaparse');

const stripAccents = s => (s||'').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const cleanKey = s => (s||'').replace(/[^a-zA-Z0-9]/g, '').toUpperCase().trim();

const acc = Papa.parse(fs.readFileSync('acc_export.csv', 'utf8'), {header:false}).data;
const data = Papa.parse(fs.readFileSync('posmdata_export.csv', 'utf8'), {header:false}).data;

const dataIndex = new Map();
data.slice(1).forEach((r, i) => {
    if (r.length < 12) return;
    const jc = cleanKey(r[3]);
    if (!dataIndex.has(jc)) dataIndex.set(jc, []);
    dataIndex.get(jc).push({
        pic: stripAccents(r[11]),
        week: r[0].toUpperCase(),
        status: r[12]
    });
});

let matched = 0;
let failed = [];

acc.slice(1).forEach((r) => {
    if (r.length > 35 && stripAccents(r[1]) === stripAccents('Lê Anh Tuấn') && r[35].trim().toUpperCase() === 'W13') {
        const jc = cleanKey(r[4]);
        const locs = dataIndex.get(jc) || [];
        const match = locs.find(m => m.pic === stripAccents('Lê Anh Tuấn'));
        if (match) {
            matched++;
        } else {
            failed.append({ jc, locs });
        }
    }
});

console.log('Matched:', matched, 'Failed:', failed);
