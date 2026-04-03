const Papa = require('papaparse');

const SPREADSHEET_ID = '1VdycOwMxhEY62_Ws3QAXYIydvsKftsSh3EEyNdMbrJM';
const GID_DATA = '620957061';

const getCsvUrl = (gid) => `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&gid=${gid}`;

async function run() {
  const url = getCsvUrl(GID_DATA);
  const response = await globalThis.fetch(url);
  const text = await response.text();
  const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
  
  const weirdRows = parsed.data.filter(r => {
    return r.latitude && r.latitude.includes('8.6') || r.longitude && r.longitude.includes('8.6');
  });
  console.log("Weird rows:", weirdRows.length);
  if (weirdRows.length > 0) console.log(weirdRows);
}
run();
