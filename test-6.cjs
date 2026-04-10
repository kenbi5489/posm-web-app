async function test(query) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=vn`;
  const res = await globalThis.fetch(url, { headers: { 'User-Agent': 'TESTER' } });
  const data = await res.json();
  if (data.length > 0) console.log(`O -> [${query}] : ${data[0].lat}, ${data[0].lon}`);
  else console.log(`X -> [${query}] : NOT FOUND`);
}
async function run() {
  await test("Pasteur, Phường 8, Quận 3, Thành phố Hồ Chí Minh");
  await test("Đường Pasteur, Quận 3, Thành phố Hồ Chí Minh");
  await test("Điện Biên Phủ, Phường 1, Quận 3, Thành phố Hồ Chí Minh");
  await test("Trần Hưng Đạo, Quận 1, Thành phố Hồ Chí Minh");
  await test("Huỳnh Tấn Phát, Huyện Nhà Bè, Thành phố Hồ Chí Minh");
  await test("Huỳnh Tấn Phát, Quận 7, Thành phố Hồ Chí Minh");
}
run();
