async function testNominatimFull(query) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&countrycodes=vn`;
  const response = await globalThis.fetch(url, { headers: { 'User-Agent': 'POSMTracker/1.0' } });
  const data = await response.json();
  console.log(`\nResults for '${query}':`);
  data.forEach((d, i) => console.log(`[${i}] ${d.lat}, ${d.lon} -> ${d.display_name}`));
}
async function run() {
  await testNominatimFull('Phường 11 Quận 8 Hồ Chí Minh');
  await testNominatimFull('Hồ Chí Minh');
}
run();
