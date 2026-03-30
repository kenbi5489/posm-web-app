const puppeteer = require('puppeteer');

(async () => {
  console.log('Starting puppeteer tests for /map bypass...');
  try {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    page.on('console', msg => console.log('LOG:', msg.type(), msg.text()));
    page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
    
    // Fake login
    await page.goto('http://localhost:5174/', { waitUntil: 'networkidle2' });
    await page.evaluate(() => {
      localStorage.setItem('posm_user', JSON.stringify({ role: 'admin', user_id: 'admin', ho_ten: 'Admin System' }));
    });
    
    console.log('Navigating to /map...');
    await page.goto('http://localhost:5174/map', { waitUntil: 'networkidle2', timeout: 30000 });
    
    // Wait for a bit more to see if it crashes internally
    await new Promise(r => setTimeout(r, 5000));
    
    // Check if the MapView component has any text content that indicates crash
    const content = await page.evaluate(() => document.body.innerText);
    console.log('Body Text:', content.slice(0, 100).replace(/\n/g, ' '));
    
    await browser.close();
  } catch (e) {
    console.error('Script Error:', e.message);
  }
})();
