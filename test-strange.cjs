async function search(q) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&countrycodes=vn`;
  const res = await globalThis.fetch(url, { headers: { 'User-Agent': 'POSMTracker/1.0' } });
  const data = await res.json();
  if (data.length > 0) {
    if (Math.abs(parseFloat(data[0].lat) - 8.68) < 0.1) {
      console.log('!!! BINGO !!! ->', q, data[0].lat, data[0].lon);
    }
  }
}
async function run() {
  const words = ['Việt Nam', 'Hồ Chí Minh', 'Thành phố Hồ Chí Minh', 'TP. Hồ Chí Minh', 'TP.HCM', 'Hồ Chí Minh Việt Nam', 'Thành Phố', 'Quận', 'Phường', ' '];
  for (const w of words) await search(w);
}
run();
