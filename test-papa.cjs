const Papa = require('papaparse');
const SPREADSHEET_ID = '1VdycOwMxhEY62_Ws3QAXYIydvsKftsSh3EEyNdMbrJM';
const GID_DATA = '620957061';
const getCsvUrl = (gid) => `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&gid=${gid}`;

async function run() {
  const url = getCsvUrl(GID_DATA);
  const response = await globalThis.fetch(url);
  const text = await response.text();
  const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
  
  const rows = parsed.data.filter(r => r.PIC && r.PIC.includes('Trương Trọng Tân') && r['Week triển khai'] === 'W9');
  const d8Rows = rows.filter(r => r['Địa chỉ'].includes('Q.8') || r['Địa chỉ'].includes('Quận 8'));
  console.log("Found", d8Rows.length, "D8 rows");
  console.log(d8Rows.map(r => ({
    addr: r['Địa chỉ'],
    w: r['Phường'],
    d: r['Quận'],
    c: r['Thành Phố']
  })));
}
run();
