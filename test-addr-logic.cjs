const expandVi = (txt) => {
   if (!txt) return '';
   return txt.replace(/\bP\./gi, 'Phường ')
             .replace(/\bQ\./gi, 'Quận ')
             .replace(/\bTP\.HCM\b/gi, 'Hồ Chí Minh')
             .replace(/\bTP\./gi, 'Thành phố ')
             .replace(/\bTX\./gi, 'Thị xã ')
             .replace(/\bTT\./gi, 'Thị trấn ')
             .replace(/Hồ Chí Minh/gi, 'Thành phố Hồ Chí Minh');
};

const formatDist = (district) => {
  if (!district) return '';
  if (/^\d+$/.test(district.trim())) return `Quận ${district.trim()}`;
  return district;
};

async function test(query) {
  const q = encodeURIComponent(query);
  const url = `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1&countrycodes=vn`;
  const res = await globalThis.fetch(url, { headers: { 'User-Agent': 'TESTER' } });
  const data = await res.json();
  if (data.length > 0) console.log(`O -> [${query}] : ${data[0].lat}, ${data[0].lon} | ${data[0].display_name.substring(0,60)}`);
  else console.log(`X -> [${query}] : NOT FOUND`);
}

async function run() {
  await test("Phường 4 Quận 8 Thành phố Hồ Chí Minh");
  await test("Trần Hưng Đạo Phường Cầu Kho Quận 1 Thành phố Hồ Chí Minh");
  await test("Tôn Dật Tiên Phường Tân Phú Quận 7 Thành phố Hồ Chí Minh");
  await test("Nguyễn Hữu Thọ Phường Tân Hưng Quận 7 Thành phố Hồ Chí Minh");
  await test("Huỳnh Tấn Phát Phường Tân Phú Quận 7 Thành phố Hồ Chí Minh");
  await test("Nguyễn Văn Linh Phường Tân Hưng Quận 7 Thành phố Hồ Chí Minh");
  await test("Đường Số 8 Phường 11 Quận 8 Thành phố Hồ Chí Minh");
}
run();
