async function test(query) {
  const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=1&lang=vi&lat=10.762&lon=106.660`;
  const response = await globalThis.fetch(url);
  const data = await response.json();
  if (data.features && data.features.length > 0) {
    console.log("Photon Result for", query, ": lat", data.features[0].geometry.coordinates[1], "lon", data.features[0].geometry.coordinates[0], "name", data.features[0].properties.name);
  } else {
    console.log("Photon: NOT FOUND for", query);
  }
}

async function run() {
  await test('Q.8, TP.HCM, Việt Nam');
  await test('Quận 8, Thành phố Hồ Chí Minh, Việt Nam');
  await test('Quận 8, Hồ Chí Minh');
  await test('Hồ Chí Minh, Việt Nam');
}
run();
