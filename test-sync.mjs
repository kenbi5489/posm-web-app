import fs from 'fs';
import Papa from 'papaparse';

const SPREADSHEET_ID = '1VdycOwMxhEY62_Ws3QAXYIydvsKftsSh3EEyNdMbrJM';
const GID_DATA = '620957061';
const GID_ACCEPTANCE = '511717734';

const getCsvUrl = (gid) => `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&gid=${gid}&tq=select%20*&_t=${Date.now()}`;

async function run() {
  const dataRes = await fetch(getCsvUrl(GID_DATA));
  const dataText = await dataRes.text();
  const data = Papa.parse(dataText, { header: true, skipEmptyLines: true }).data;

  const accRes = await fetch(getCsvUrl(GID_ACCEPTANCE));
  const accText = await accRes.text();
  const rawAcceptance = Papa.parse(accText, { header: true, skipEmptyLines: true }).data;

  const normalizeStr = (str) => str ? str.toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "") : "";
  const stripAccents = (s) => (s || '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

  const getHeaderMap = (row) => {
    const map = new Map();
    Object.keys(row).forEach(k => {
      const originalKey = k;
      const cleanKey = k.toString().trim();
      map.set(normalizeStr(cleanKey).toLowerCase(), originalKey);
      map.set(stripAccents(cleanKey), originalKey);
    });
    return map;
  };

  const headerMapData = data.length > 0 ? getHeaderMap(data[0]) : new Map();
  const headerMapAcc = rawAcceptance.length > 0 ? getHeaderMap(rawAcceptance[0]) : new Map();

  const getValFast = (row, patterns, hMap) => {
    for (const p of patterns) {
      const normP = normalizeStr(p.trim()).toLowerCase();
      const stripP = stripAccents(p.trim());
      const key = hMap.get(normP) || hMap.get(stripP);
      if (key !== undefined) {
         const val = (row[key] ?? '').toString().trim();
         if (val !== '') return val;
      }
    }
    return '';
  };

  const assignmentsMap = new Map();

  let w12_count = 0;
  let w13_count = 0;

  data.forEach((row, index) => {
    const pic = getValFast(row, ['PIC', 'Nhân viên', 'Nhan vien', 'Người thực hiện'], headerMapData);
    if (!stripAccents(pic).includes('le anh tuan')) return;

    const weekNumVal = getValFast(row, ['WEEKnum', 'WEEK_num', 'WEEK num', 'weeknum'], headerMapData);
    let weekNum = parseInt(weekNumVal.toString().replace(/\D/g, '')) || 0;
    
    if (!weekNum) {
       const fallbackWeek = getValFast(row, ['Week triển khai', 'Week', 'Tuần', 'Tuan'], headerMapData);
       weekNum = parseInt(fallbackWeek.toString().replace(/\D/g, '')) || 0;
    }

    if (weekNum === 12) w12_count++;
    if (weekNum === 13) w13_count++;
  });

  console.log(`Le Anh Tuan Assignments: W12=${w12_count}, W13=${w13_count}`);
}

run();
