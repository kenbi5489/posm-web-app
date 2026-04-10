const fetch = require('node-fetch');

const expandVi = (txt) => {
   if (!txt) return '';
   return txt.replace(/\bP\./gi, 'Phường ')
             .replace(/\bQ\./gi, 'Quận ')
             .replace(/\bTP\.HCM\b/gi, 'Hồ Chí Minh')
             .replace(/\bTP\./gi, 'Thành phố ')
             .replace(/\bTX\./gi, 'Thị xã ')
             .replace(/\bTT\./gi, 'Thị trấn ')
             .replace(/Hồ Chí Minh/gi, 'Hồ Chí Minh');
};

const addresses = [
  "59-61 Xóm Củi, P.11,Q.8, TP.HCM",
  "L1-12B, Tầng 1, TTTM Parc Mall, 547-549 Tạ Quang Bửu, P.4, Q.8, TP.Hồ Chí Minh",
  "Lầu 2, TTTM Parc Mall, Số 195, Đường Cao Lỗ, Phường 4, Quận 8, Thành phố Hồ Chí Minh",
  "26, Hồ Học Lãm, P.16, Q.8, TP.Hồ Chí Minh"
];

const wards = ["P.11", "P.4", "Phường 4", "P.16"];
const districts = ["Q.8", "Q.8", "Quận 8", "Q.8"];
const cities = ["TP.HCM", "TP.Hồ Chí Minh", "Thành phố Hồ Chí Minh", "TP.Hồ Chí Minh"];

async function run() {
  for (let i=0; i<wards.length; i++) {
    const ward = expandVi(wards[i] || '');
    const district = expandVi(districts[i] || '');
    const city = expandVi(cities[i] || '');
    const q1 = `${ward} ${district} ${city}`.replace(/\s+/g, ' ').trim();
    
    console.log("Querying:", q1);
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q1)}&format=json&limit=1&countrycodes=vn`;
    const res = await globalThis.fetch(url, { headers: { 'User-Agent': 'POSMTracker/1.0' } });
    const data = await res.json();
    if (data.length > 0) {
       console.log("  => lat", data[0].lat, "lon", data[0].lon, data[0].display_name);
    } else {
       console.log("  => NOT FOUND");
    }
  }
}
run();
