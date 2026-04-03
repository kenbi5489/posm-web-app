async function test(query) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=vn`;
  try {
    const res = await globalThis.fetch(url, { headers: { 'User-Agent': 'POSMTracker/2.0' } });
    const data = await res.json();
    if (data && data.length > 0) console.log(`O -> ${data[0].lat}, ${data[0].lon}`);
    else console.log(`X -> NOT FOUND (status=${res.status})`);
  } catch(e) { console.log(`ERR: ${e.message}`); }
}
test("324 Hồ Tùng Mậu, Q.Bắc Từ Liêm, TP.Hà Nội");
