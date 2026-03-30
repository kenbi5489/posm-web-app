const puppeteer = require('puppeteer');

(async () => {
  console.log('Starting puppeteer script...');
  try {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    page.on('console', msg => console.log('PAGE LOG:', msg.type(), msg.text()));
    page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
    page.on('requestfailed', request => console.log('REQUEST FAILED:', request.url(), request.failure().errorText));
    
    console.log('Navigating to local server...');
    await page.goto('http://localhost:5174/map', { waitUntil: 'networkidle2', timeout: 30000 });
    console.log('Page loaded.');
    await browser.close();
  } catch (e) {
    console.error('Script Error:', e.message);
  }
})();
