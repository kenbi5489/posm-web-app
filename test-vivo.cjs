async function testNominatimFull(query) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&countrycodes=vn`;
  const response = await globalThis.fetch(url, { headers: { 'User-Agent': 'POSMTracker/1.0' } });
  const data = await response.json();
  console.log(`\nResults for '${query}':`);
  if (!data || data.length === 0) console.log("NOT FOUND");
  else data.forEach((d, i) => console.log(`[${i}] ${d.lat}, ${d.lon} -> ${d.display_name}`));
}
async function run() {
  await testNominatimFull('Vivo city');
  await testNominatimFull('Saigon Centre');
}
run();
