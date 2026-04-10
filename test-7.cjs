async function test(query) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=vn`;
  const res = await globalThis.fetch(url, { headers: { 'User-Agent': 'TESTER' } });
  const data = await res.json();
  if (data.length > 0) console.log(`O -> [${query}] : ${data[0].lat}, ${data[0].lon}`);
  else console.log(`X -> [${query}] : NOT FOUND`);
}
async function run() {
  await test("Phường 8, Quận 3, Thành phố Hồ Chí Minh");
  await test("Phường 1, Quận 3, Thành phố Hồ Chí Minh");
  await test("Phường Cầu Kho, Quận 1, Thành phố Hồ Chí Minh");
  await test("Xã Phú Xuân, Huyện Nhà Bè, Thành phố Hồ Chí Minh");
  await test("Phường Bình Thuận, Quận 7, Thành phố Hồ Chí Minh");
}
run();
