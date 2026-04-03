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
   
   // Match District until comma
   const dMatch = text.match(/(?:Quận|Huyện)\s*([^,]+)/i);
   if (dMatch && dMatch[0]) d = dMatch[0].trim();
   
   // Match Ward until comma
   const wMatch = text.match(/(?:Phường|Xã|Thị trấn)\s*([^,]+)/i);
   if (wMatch && wMatch[0]) {
       w = wMatch[0].split(/(?:Quận|Huyện)/i)[0].trim();
   }
   
   return { w, d };
};

const addresses = [
  "58C1 Cao Thắng, Phường 5, Quận 3, Hồ Chí Minh",
  "161 Khánh Hội, P.3, Q.4, TP.Hồ Chí Minh",
  "126 Hồng Bàng, , 12, Quận 5, Hồ Chí Minh",
  "1058 Đại Lộ Nguyễn Văn Linh, Tân Phong, Quận 7, Hồ Chí Minh",
  "200A Lý Tự Trọng, Phường Bến Thành, Quận 1, TP.HCM",
  "Tầng 4 Crescent Mall, 101 Tôn Dật Tiên, Phường Tân Phú, Quận 7, Thành phố Hồ Chí Minh"
];

for(let a of addresses) {
  const {w, d} = extractAdmin(a);
  console.log(`Address: ${a}`);
  console.log(`Ward=[${w}] District=[${d}]`);
  console.log("---");
}
