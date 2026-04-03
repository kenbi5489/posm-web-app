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
   const dMatch = text.match(/(?:Quận|Huyện)\s*([A-Za-z0-9\s]+)/i);
   if (dMatch && dMatch[0]) d = dMatch[0].split(',')[0].trim();
   
   const wMatch = text.match(/(?:Phường|Xã|Thị trấn)\s*([A-Za-z0-9\s]+)/i);
   if (wMatch && wMatch[0]) w = wMatch[0].split(/(?:Quận|Huyện)/i)[0].split(',')[0].trim();
   
   return { w, d };
};

const addresses = [
  "58C1 Cao Thắng, Phường 5, Quận 3, Hồ Chí Minh",
  "161 Khánh Hội, P.3, Q.4, TP.Hồ Chí Minh",
  "126 Hồng Bàng, , 12, Quận 5, Hồ Chí Minh",
  "1058 Đại Lộ Nguyễn Văn Linh, Tân Phong, Quận 7, Hồ Chí Minh",
  "200A Lý Tự Trọng, Phường Bến Thành, Quận 1, TP.HCM"
];

for(let a of addresses) {
  const {w, d} = extractAdmin(a);
  console.log(`Address: ${a}`);
  console.log(`Extracted: Ward=[${w}] District=[${d}]`);
  console.log(`Query => ${w} ${d} Hồ Chí Minh`);
  console.log("---");
}
