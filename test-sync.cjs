const fetch = require('node-fetch');
const Papa = require('papaparse');

const SPREADSHEET_ID = '1VdycOwMxhEY62_Ws3QAXYIydvsKftsSh3EEyNdMbrJM';
const GID_DATA = '620957061';

const getCsvUrl = (gid) => `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&gid=${gid}`;

async function run() {
  const url = getCsvUrl(GID_DATA);
  const response = await fetch(url);
  const text = await response.text();
  const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
  console.log("Total rows:", parsed.data.length);
  if (parsed.data.length > 0) {
    console.log("Headers:", Object.keys(parsed.data[0]));
    
    // Check if jobcode exists
    const row = parsed.data[0];
    const keys = Object.keys(row);
    const pattern = 'Mã cv';
    const exact = keys.find(k => k.toLowerCase() === pattern.toLowerCase());
    const partial = keys.find(k => k.toLowerCase().includes(pattern.toLowerCase()));
    console.log("Match exactly:", exact, "Partial match:", partial);
    console.log("Jobcode field value for row 1:", exact ? row[exact] : partial ? row[partial] : 'NOT FOUND');
  }
}
run();
