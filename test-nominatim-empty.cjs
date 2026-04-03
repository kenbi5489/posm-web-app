async function testNominatim(query) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=vn`;
  console.log("Fetching:", url);
  const response = await globalThis.fetch(url, { headers: { 'User-Agent': 'POSMTracker/1.0' } });
  const data = await response.json();
  if (data && data.length > 0) {
    console.log("Result:", data[0].lat, data[0].lon, data[0].display_name);
  } else {
    console.log("NOT FOUND");
  }
}
async function run() {
  await testNominatim('');
  // Wait, let's also test 'Thành phố Hồ Chí Minh', wait wait, what if city equals 'TP.HCM' -> 'Hồ Chí Minh'
  await testNominatim('Việt Nam');
}
run();
