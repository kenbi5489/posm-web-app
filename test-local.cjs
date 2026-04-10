const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
  page.on('pageerror', error => console.log('BROWSER ERROR:', error.message));
  page.on('requestfailed', request => console.log('BROWSER NETWORK ERROR:', request.url(), request.failure().errorText));
  
  await page.goto('http://localhost:5173/map', { waitUntil: 'networkidle2' });
  await page.waitForTimeout(2000);
  
  const html = await page.content();
  console.log('MAP RENDERED:', html.includes('leaflet-container'));
  
  await page.screenshot({ path: '/Users/tuan.la/.gemini/antigravity/brain/6226a0bd-1ece-4fdd-b776-2cf703a279f0/artifacts/debug_leaflet.png' });
  await browser.close();
})();
