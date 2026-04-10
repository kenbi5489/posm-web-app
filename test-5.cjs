async function test(query) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=vn`;
  const res = await globalThis.fetch(url, { headers: { 'User-Agent': 'TESTER' } });
  const data = await res.json();
  if (data.length > 0) console.log(`O -> [${query}] : ${data[0].lat}, ${data[0].lon} | ${data[0].display_name}`);
  else console.log(`X -> [${query}] : NOT FOUND`);
}
async function run() {
  await test("260A Pasteur, Phường 8, Quận 3. Thành phố Hồ Chí Minh");
  await test("635A Điện Biên Phủ, Phường 1, Quận 3, Thành phố Hồ Chí Minh");
  await test("391B Trần Hưng Đạo, Phường Cầu kho, Quận 1, Thành phố Hồ Chí Minh");
  await test("Tầng 4 Crescent Mall, 101 Tôn Dật Tiên, Phường Tân Phú, Quận 7, Thành phố Hồ Chí Minh");
  await test("17/3, Huỳnh Tấn Phát, X.Phú Xuân, H.Nhà Bè, TP.Hồ Chí Minh");
  await test("420 Huỳnh Tấn Phát, P. Bình Thuận, Quận 7, TP Hồ Chí Minh");
}
run();
