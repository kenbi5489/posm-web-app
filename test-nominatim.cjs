async function testNominatim(query) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=vn`;
  console.log("Fetching Nominatim:", url);
  const response = await globalThis.fetch(url, { headers: { 'User-Agent': 'POSMTracker/1.0' } });
  const data = await response.json();
  if (data && data.length > 0) {
    console.log(" Nominatim Result for", query, ": lat", data[0].lat, "lon", data[0].lon, "name", data[0].display_name);
  } else {
    console.log(" Nominatim: NOT FOUND for", query);
  }
}

async function run() {
  await testNominatim('P.11 Q.8 TP.HCM');
  await testNominatim('Phường 11 Quận 8 Hồ Chí Minh');
  await testNominatim('Quận 8 Hồ Chí Minh');
  await testNominatim('TP.Hồ Chí Minh');
}
run();
