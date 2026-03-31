/**
 * WatermarkService.js
 * Utility to process images and add time-marks (Watermark)
 */

export const addWatermark = async ({ imageBase64, address, staffName }) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = imageBase64;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      // Set canvas size to match image
      canvas.width = img.width;
      canvas.height = img.height;

      // Draw original image
      ctx.drawImage(img, 0, 0);

      // --- WATERMARK STYLING ---
      const padding = canvas.width * 0.05;
      const fontSizeLarge = Math.max(24, canvas.width * 0.08);
      const fontSizeSmall = Math.max(12, canvas.width * 0.03);
      const bottomOffset = canvas.height * 0.15;

      // Semi-transparent background at the bottom for readability
      const gradient = ctx.createLinearGradient(0, canvas.height - bottomOffset - 50, 0, canvas.height);
      gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0.6)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, canvas.height - bottomOffset - 50, canvas.width, bottomOffset + 50);

      // 1. TIME (Large)
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const timeStr = `${hours}:${minutes}`;

      ctx.font = `black ${fontSizeLarge}px Roboto, sans-serif`;
      ctx.fillStyle = 'white';
      ctx.fillText(timeStr, padding, canvas.height - padding - fontSizeSmall * 3.5);

      // 2. DATE & DAY
      const days = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
      const dayStr = days[now.getDay()];
      const dateStr = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
      
      ctx.font = `bold ${fontSizeSmall * 1.2}px Roboto, sans-serif`;
      ctx.fillText(`| ${dateStr}`, padding + fontSizeLarge * 1.5, canvas.height - padding - fontSizeSmall * 4.3);
      ctx.font = `normal ${fontSizeSmall}px Roboto, sans-serif`;
      ctx.fillText(dayStr, padding + fontSizeLarge * 1.5, canvas.height - padding - fontSizeSmall * 3.3);

      // 3. ADDRESS
      ctx.font = `bold ${fontSizeSmall}px Roboto, sans-serif`;
      // Handle multi-line address if too long
      const maxWidth = canvas.width - padding * 2;
      const words = address.split(' ');
      let line = '';
      let y = canvas.height - padding - fontSizeSmall * 1.5;
      
      for (let n = 0; n < words.length; n++) {
        let testLine = line + words[n] + ' ';
        let metrics = ctx.measureText(testLine);
        if (metrics.width > maxWidth && n > 0) {
          ctx.fillText(line, padding, y);
          line = words[n] + ' ';
          y += fontSizeSmall * 1.2;
        } else {
          line = testLine;
        }
      }
      ctx.fillText(line, padding, y);

      // 4. STAFF NAME
      ctx.font = `italic ${fontSizeSmall}px Roboto, sans-serif`;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.fillText(`Họ tên: ${staffName.toUpperCase()}`, padding, y + fontSizeSmall * 1.5);

      // 5. LOGO/BRAND (Bottom Right)
      ctx.font = `bold ${fontSizeSmall}px Roboto, sans-serif`;
      ctx.fillStyle = 'rgba(255, 215, 0, 0.9)'; // Golden color
      const brandText = "Timemark";
      const brandWidth = ctx.measureText(brandText).width;
      ctx.fillText(brandText, canvas.width - padding - brandWidth, canvas.height - padding);

      resolve(canvas.toDataURL('image/jpeg', 0.9));
    };
    img.onerror = (err) => reject(err);
  });
};
