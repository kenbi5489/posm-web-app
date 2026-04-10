async function test(query) {
  const apiKey = "AIzaSyAeTa1gk8_AoN56UX9ngDGJ93Tbj2eABF8";
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${apiKey}`;
  const res = await globalThis.fetch(url);
  const data = await res.json();
  if (data.status === 'OK' && data.results.length > 0) {
    const loc = data.results[0].geometry.location;
    console.log(`O -> [${query}] : ${loc.lat}, ${loc.lng}`);
  } else {
    console.log(`X -> [${query}] : NOT FOUND (${data.status} - ${data.error_message || ''})`);
  }
}
async function run() {
  await test("VivoCity 2 - Số 02-11 Tầng 2,1058 Nguyễn Văn Linh, P.Tân Phong, Q.7, TP.Hồ Chí Minh");
}
run();
