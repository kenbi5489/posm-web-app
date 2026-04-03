const extractWardDistrict = (address) => {
  let w = '', d = '', s = '';
  
  // Clean address for easier parsing
  const clean = address.replace(/TP\.?\s*HCM|TP\.?\s*Hồ Chí Minh/gi, '');

  // Extract District: Q.7, Quận 7, Q1, Quận 10
  const dMatch = clean.match(/(?:Q\.|Quận|Quan)\s*([A-Za-z0-9\s]+)/i);
  if (dMatch && dMatch[1]) {
    d = dMatch[1].trim();
    // Stop at the next comma or end
    d = d.split(',')[0].trim();
    // If it's a number, ensure it stays a number
    if (/^\d+$/.test(d)) d = `Quận ${d}`;
  }

  // Extract Ward: P.16, Phường Tân Phú, P Tân Hưng
  const wMatch = clean.match(/(?:P\.|Phường|Phuong)\s*([A-Za-z0-9\s]+)/i);
  if (wMatch && wMatch[1]) {
    w = wMatch[1].trim();
    w = w.split(',')[0].trim();
    // If we accidentally captured the District as well, split it
    w = w.split(/(?:Q\.|Quận|Quan)/i)[0].trim();
    if (/^\d+$/.test(w)) w = `Phường ${w}`;
  }

  // Extract Street Name intelligently
  // Look for "Đường X", or just the words before the Ward
  const sMatch = clean.match(/(?:Đường|Đ\.)\s*([A-Za-z0-9\s]+)/i);
  if (sMatch && sMatch[1]) {
    s = sMatch[1].trim();
    s = s.split(',')[0].trim();
  } else {
    // If no explicit "Đường", try to extract the chunk before the Ward
    const parts = clean.split(/(?:P\.|Phường|Phuong)/i);
    if (parts.length > 1) {
      // Get the segment right before the Ward
      const beforeWard = parts[0].trim().split(',').pop().trim();
      // Only accept it as a street if it looks like one (e.g. "101 Tôn Dật Tiên" or "Tôn Dật Tiên")
      // Remove numbers from the start
      s = beforeWard.replace(/^\d+\s*(?:[A-Za-z]\s+)?/, '').trim();
      // Remove Tòa nhà, TTTM, etc
      s = s.replace(/.*(?:TTTM|Mall|Centre|City|Plaza|Tầng|Khu|Lô|Gian).*/i, '').trim();
    }
  }

  return { w, d, s };
};

const addresses = [
  "VivoCity 2 - Số 02-11 Tầng 2,1058 Nguyễn Văn Linh, P.Tân Phong, Q.7, TP.Hồ Chí Minh",
  "Tầng GF & 2F, TTTM Crescent Mall, 101 Tôn Dật Tiên, Phường Tân Mỹ, TPHCM",
  "L1-12B, Tầng 1, TTTM Parc Mall, 547-549 Tạ Quang Bửu, P.4, Q.8, TP.Hồ Chí Minh",
  "59-61 Xóm Củi, P.11,Q.8, TP.HCM",
  "Số 243, Nam Kỳ Khởi Nghĩa, ​​Phường Võ Thị Sáu, Quận 3, Thành phố Hồ Chí Minh"
];

for (let a of addresses) {
  const {w, d, s} = extractWardDistrict(a);
  console.log(`Original: ${a}`);
  console.log(`Extracted: Street [${s}], Ward [${w}], District [${d}]`);
  console.log('---');
}

