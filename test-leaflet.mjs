import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
  page.on('pageerror', error => console.log('BROWSER ERROR:', error.message));
  
  try {
    console.log("Navigating to http://localhost:5173/map");
    await page.goto('http://localhost:5173/map', { waitUntil: 'load', timeout: 30000 });
    await new Promise(r => setTimeout(r, 3000));
    console.log("Saving screenshot to test-map-error.png");
    await page.screenshot({ path: '/Users/tuan.la/.gemini/antigravity/scratch/posm-tracker-pwa/test-map-error.png' });
  } catch(e) {
    console.log("Test error:", e);
  } finally {
    await browser.close();
  }
})();
