const expandVi = (txt) => {
   if (!txt) return '';
   return txt.replace(/\bP\./gi, 'Phường ')
             .replace(/\bQ\./gi, 'Quận ')
             .replace(/\bTP\.HCM\b/gi, 'Hồ Chí Minh')
             .replace(/\bTP\./gi, 'Thành phố ')
             .replace(/\bTX\./gi, 'Thị xã ')
             .replace(/\bTT\./gi, 'Thị trấn ')
             .replace(/Hồ Chí Minh/gi, 'Hồ Chí Minh');
};

const extractAdmin = (fullText) => {
   let w = '', d = '';
   const text = expandVi(fullText);
   
   // 1. Find District
   const dMatch = text.match(/(?:Quận|Huyện)\s*([^,]+)/i);
   if (dMatch && dMatch[0]) d = dMatch[0].trim();
   
   // 2. Find Ward explicitly with "Phường"
   const wMatch = text.match(/(?:Phường|Xã|Thị trấn)\s*([^,]+)/i);
   if (wMatch && wMatch[0]) {
       w = wMatch[0].split(/(?:Quận|Huyện)/i)[0].trim();
   } else if (d) {
       // 3. If no explicit "Phường", infer from the segment right before District
       const parts = text.split(new RegExp(d, 'i'));
       if (parts.length > 1) {
          const beforeDistrict = parts[0].trim().replace(/,+$/, ''); // Remove trailing commas
          const segments = beforeDistrict.split(',');
          if (segments.length > 1) {
             const inferW = segments[segments.length - 1].trim();
             // Prevent capturing street names or numbers if they are too long to be a ward
             if (inferW && inferW.length < 20 && !/\d{3,}/.test(inferW)) {
                w = "Phường " + inferW;
             }
          }
       }
   }
   
   return { w, d };
};

const addresses = [
  "58C1 Cao Thắng, Phường 5, Quận 3, Hồ Chí Minh",
  "161 Khánh Hội, P.3, Q.4, TP.Hồ Chí Minh",
  "126 Hồng Bàng, , 12, Quận 5, Hồ Chí Minh",
  "1058 Đại Lộ Nguyễn Văn Linh, Tân Phong, Quận 7, Hồ Chí Minh",
  "200A Lý Tự Trọng, Phường Bến Thành, Quận 1, TP.HCM",
  "Tầng 4 Crescent Mall, 101 Tôn Dật Tiên, Phường Tân Phú, Quận 7, Thành phố Hồ Chí Minh",
  "Saigon Centre"
];

for(let a of addresses) {
  const {w, d} = extractAdmin(a);
  console.log(`Address: ${a}`);
  console.log(`Ward=[${w}] District=[${d}]`);
  console.log("---");
}
