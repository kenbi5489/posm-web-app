async function testNominatim(query) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=vn`;
  const response = await globalThis.fetch(url, { headers: { 'User-Agent': 'POSMTracker/1.0' } });
  const data = await response.json();
  if (data && data.length > 0) {
    console.log("Nominatim Result for", query, ": lat", data[0].lat, "lon", data[0].lon);
  } else {
    console.log("Nominatim: NOT FOUND");
  }
}
async function run() {
  await testNominatim('Việt Nam');
  await testNominatim('Bà Rịa - Vũng Tàu');
  await testNominatim('Đông Nam Bộ'); // region
  // maybe the city is empty and it fell back to district?
}
run();
