const puppeteer = require('puppeteer');

(async () => {
  try {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
    await page.goto('http://localhost:5174/map', { waitUntil: 'networkidle0', timeout: 10000 });
    await browser.close();
  } catch (e) {
    if (e.message.includes('ERR_CONNECTION_REFUSED')) {
      console.log('Server not running');
    } else {
      console.log('Error:', e.message);
    }
  }
})();
