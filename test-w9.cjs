const Papa = require('papaparse');
const SPREADSHEET_ID = '1VdycOwMxhEY62_Ws3QAXYIydvsKftsSh3EEyNdMbrJM';
const GID_DATA = '620957061';
const getCsvUrl = (gid) => `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&gid=${gid}`;

async function run() {
  const url = getCsvUrl(GID_DATA);
  const response = await globalThis.fetch(url);
  const text = await response.text();
  const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
  
  const w9Rows = parsed.data.filter(r => r.PIC && r.PIC.includes('Trương Trọng Tân') && (r['Week triển khai'] === 'W9' || r['Week'] === 'W9' || r['Tuần'] === 'W9'));
  console.log("Found", w9Rows.length, "rows in W9 for Tan");
  w9Rows.forEach((r, i) => {
    console.log(`[${i}] ${r['Địa chỉ']}`);
  });
}
run();
