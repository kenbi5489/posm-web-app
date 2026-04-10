async function testNominatim(query) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=vn`;
  const response = await globalThis.fetch(url, { headers: { 'User-Agent': 'POSMTracker/1.0' } });
  const data = await response.json();
  if (data && data.length > 0) {
    console.log("Result for", query, ": lat", data[0].lat, "lon", data[0].lon, "name", data[0].display_name);
  } else {
    console.log("NOT FOUND for", query);
  }
}
async function run() {
  await testNominatim('Hồ Chí Minh');
  await testNominatim('Thành phố Hồ Chí Minh');
  await testNominatim('Hồ Chí Minh, Việt Nam');
}
run();
