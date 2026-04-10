async function test(query) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=vn`;
  const res = await globalThis.fetch(url, { headers: { 'User-Agent': 'TESTER' } });
  const data = await res.json();
  if (data.length > 0) console.log(`O -> [${query}] : ${data[0].lat}, ${data[0].lon}`);
  else console.log(`X -> [${query}] : NOT FOUND`);
}
async function run() {
  await test("Phường Tân Phú Quận 7 Thành phố Hồ Chí Minh");
  await test("Phường Tân Hưng Quận 7 Thành phố Hồ Chí Minh");
  await test("Phường Sài Gòn Hồ Chí Minh");
}
run();
