async function testReverse() {
  const url = `https://nominatim.openstreetmap.org/reverse?lat=8.68&lon=106.60&format=json`;
  const response = await globalThis.fetch(url, { headers: { 'User-Agent': 'POSMTracker/1.0' } });
  const data = await response.json();
  console.log("Reverse for 8.68, 106.60:", data.display_name);
}
testReverse();
