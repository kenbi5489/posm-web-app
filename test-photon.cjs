async function test(query) {
  const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=1`;
  const res = await globalThis.fetch(url);
  const data = await res.json();
  if (data.features && data.features.length > 0) {
    const coords = data.features[0].geometry.coordinates;
    console.log(`O -> [${query}] : ${coords[1]}, ${coords[0]} | ${data.features[0].properties.name || data.features[0].properties.state}`);
  }
  else console.log(`X -> [${query}] : NOT FOUND`);
}
async function run() {
  await test("Phường Cầu Kho, Quận 1, Thành phố Hồ Chí Minh");
  await test("Trần Hưng Đạo, Quận 1, Thành phố Hồ Chí Minh");
  await test("260A Pasteur, Phường 8, Quận 3, Hồ Chí Minh");
  await test("Tôn Dật Tiên, Quận 7, Thành phố Hồ Chí Minh");
  await test("Crescent Mall, Quận 7");
  await test("Vivo City, Quận 7");
}
run();
