import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.toString()));
  page.on('requestfailed', request => console.log('REQUEST FAILED:', request.url(), request.failure()?.errorText));

  console.log('Navigating...');
  await page.goto('http://localhost:5174/', { waitUntil: 'networkidle0', timeout: 15000 }).catch(e => console.log('Goto error:', e));
  
  console.log('Taking screenshot...');
  // await page.screenshot({ path: 'test-screenshot.png' });
  
  await browser.close();
})();
