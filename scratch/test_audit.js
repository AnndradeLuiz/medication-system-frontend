const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Capture console errors
  page.on('console', msg => {
    console.log(`[BROWSER CONSOLE] ${msg.type().toUpperCase()}: ${msg.text()}`);
  });

  page.on('pageerror', err => {
    console.error(`[BROWSER EXCEPTION] ${err.message}`);
    console.error(err.stack);
  });

  // Inject token and mock session
  await page.addInitScript(() => {
    const futureExp = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
    window.localStorage.setItem('sgdm_token', 'fake-jwt-token');
    window.localStorage.setItem('sgdm_userName', 'Luiz Andrade');
    window.localStorage.setItem('sgdm_userRole', 'ADM_TI');
    window.localStorage.setItem('sgdm_employeeId', '123');
    window.localStorage.setItem('sgdm_token_exp', String(futureExp));
  });

  console.log('Navigating to app.html...');
  await page.goto('http://localhost:80/app.html');
  
  console.log('Navigating to #audit...');
  await page.evaluate(() => {
    window.location.hash = '#audit';
  });

  // Wait a bit
  await page.waitForTimeout(2000);

  // Check if view-audit is active and visible
  const isVisible = await page.locator('#view-audit').isVisible();
  console.log(`Is #view-audit visible? ${isVisible}`);

  await browser.close();
})();
