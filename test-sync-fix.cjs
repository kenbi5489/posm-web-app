const Papa = require('papaparse');

const SPREADSHEET_ID = '1VdycOwMxhEY62_Ws3QAXYIydvsKftsSh3EEyNdMbrJM';
const GID_DATA = '620957061';

const getCsvUrl = (gid) => `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&gid=${gid}`;

async function run() {
  const url = getCsvUrl(GID_DATA);
  const response = await globalThis.fetch(url);
  const text = await response.text();
  console.log("Response starts with:", text.substring(0, 100));
  
  const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
  console.log("Total rows:", parsed.data.length);
  if (parsed.data.length > 0) {
    const row = parsed.data[0];
    console.log("Headers:", Object.keys(row));
  }
}
run();
