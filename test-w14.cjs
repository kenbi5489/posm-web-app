const SPREADSHEET_ID = '1VdycOwMxhEY62_Ws3QAXYIydvsKftsSh3EEyNdMbrJM';
const GID = '620957061';
const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&gid=${GID}`;

const Papa = require('papaparse');

async function run() {
  const res = await globalThis.fetch(url);
  const text = await res.text();
  const { data } = Papa.parse(text, { header: true, skipEmptyLines: true });
  
  const headers = Object.keys(data[0] || {});
  console.log("Headers:", headers.slice(0, 20).join(' | '));
  
  const weeks = [...new Set(data.map(r => r['Week triển khai'] || r['Week'] || '').filter(Boolean))];
  console.log("All weeks in data:", weeks.sort());
  
  const w14 = data.filter(r => (r['Week triển khai'] || '').trim() === 'W14');
  console.log("W14 count:", w14.length);
  if (w14[0]) console.log("Sample W14 row address:", w14[0]['Địa chỉ'] || w14[0]['Address']);
}
run().catch(console.error);
