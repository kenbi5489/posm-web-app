const puppeteer = require('puppeteer');
(async () => {
    const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.goto('http://localhost:4174', { waitUntil: 'networkidle2' });
    // Attempt to login if redirected to /login
    if (page.url().includes('login')) {
      await page.type('input[type="text"]', '1234');
      await page.click('button[type="submit"]');
      await page.waitForNavigation({ waitUntil: 'networkidle2' });
    }
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'dashboard_error_debug.png' });
    const logs = await page.evaluate(() => {
        return window.performance.getEntriesByType('measure').map(m => m.name);
    });
    console.log("If blank, maybe crash?");
    await browser.close();
})();
