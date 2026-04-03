async function test(query) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=vn`;
  const res = await globalThis.fetch(url, { headers: { 'User-Agent': 'TESTER' } });
  const data = await res.json();
  if (data.length > 0) console.log(`O -> [${query}] : ${data[0].lat}, ${data[0].lon} | ${data[0].display_name.substring(0,60)}`);
  else console.log(`X -> [${query}] : NOT FOUND`);
}
async function run() {
  await test("Trần Hưng Đạo, Quận 1, Thành phố Hồ Chí Minh");
  await test("Tôn Dật Tiên, Quận 7, Thành phố Hồ Chí Minh");
  await test("Nguyễn Văn Linh, Quận 7, Thành phố Hồ Chí Minh");
  await test("Crescent Mall, Quận 7, Thành phố Hồ Chí Minh");
  await test("SC Vivo City, Quận 7, Thành phố Hồ Chí Minh");
}
run();
