const cleanAddress = (str) => {
  return str
    .replace(/Tầng\s+[A-Za-z0-9&]+\s*,?/gi, '')
    .replace(/Lầu\s+[A-Za-z0-9&]+\s*,?/gi, '')
    .replace(/L\d+\s*,?/gi, '')
    .replace(/F\d+-\d+\s*,?/gi, '')
    .replace(/Lô\s+[A-Za-z0-9-]+\s*,?/gi, '')
    .replace(/Gian hàng\s+[A-Za-z0-9-]+\s*,?/gi, '')
    .replace(/TTTM\s*/gi, '')
    .replace(/Trung tâm thương mại\s*/gi, '')
    .replace(/Số\s+\d+-\d+\s*,?/gi, '')
    .trim()
    .replace(/^,\s*/, '');
};

async function test(query) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=vn`;
  const res = await globalThis.fetch(url, { headers: { 'User-Agent': 'TESTER' } });
  const data = await res.json();
  if (data.length > 0) console.log(`O -> [${query}] : ${data[0].lat}, ${data[0].lon}`);
  else console.log(`X -> [${query}] : NOT FOUND`);
}

async function run() {
  const addrs = [
    "Tầng GF & 2F, TTTM Crescent Mall, 101 Tôn Dật Tiên, Phường Tân Mỹ, TPHCM",
    "L1-12B, Tầng 1, TTTM Parc Mall, 547-549 Tạ Quang Bửu, P.4, Q.8, TP.Hồ Chí Minh",
    "Lô 02-39, Trung tâm thương mại SC Vivo City Nguyễn Văn Linh, 1058 Nguyễn Văn Linh, P.Tân Phong, Q.7, TP.Hồ Chí Minh",
    "F3-32 Tầng 3 TTTM The Crescent Mall  - 101 Tôn Dật Tiên, P.Tân Phú, Q.7, TP.Hồ Chí Minh"
  ];

  for (let a of addrs) {
    let cleaned = cleanAddress(a);
    console.log(`Original: ${a}\nCleaned:  ${cleaned}`);
    await test(cleaned);
  }
}
run();
