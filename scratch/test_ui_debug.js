const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: false, args: ['--start-maximized'] });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));

  page.on('dialog', async dialog => {
    await dialog.accept();
  });
  
  await page.goto('http://127.0.0.1:5500/login.html');
  await page.type('#loginDocument', '99973740297');
  await page.type('#password', '3011');
  await page.evaluate(() => document.querySelector('button[type="submit"]').click());
  await page.waitForNavigation();
  
  await page.evaluate(() => { switchView('estoque'); });
  await new Promise(r => setTimeout(r, 1000));
  
  await page.evaluate(() => setMode('medicamentos'));
  await new Promise(r => setTimeout(r, 500));
  
  await page.evaluate(() => { 
      const tabs = document.querySelectorAll('#view-estoque .tab');
      for (let tab of tabs) {
          if (tab.innerText.includes('Cadastrar Novo')) { tab.click(); break; }
      }
  });
  await new Promise(r => setTimeout(r, 500));
  
  await page.type('#newItemName', 'AutoTest_v4_Med');
  await page.type('#newMedConcentrationValue', '500');
  await page.select('#newMedConcentrationUnit', 'mg');
  await page.select('#newMedForm', 'COMPRIMIDO');
  await page.select('#newMedRoute', 'ORAL');
  await page.select('#newMedProgram', 'FARMACIA_BASICA');
  
  // Capture screenshot to see if fields are filled
  await page.screenshot({ path: 'debug_screenshot.png' });
  
  // Also evaluate what saveNewItem would see!
  const debugData = await page.evaluate(() => {
    return {
       mode: currentMode,
       newItemName: document.getElementById('newItemName').value,
       newMedConcentrationValue: document.getElementById('newMedConcentrationValue').value,
       newMedConcentrationUnit: document.getElementById('newMedConcentrationUnit').value,
       newMedForm: document.getElementById('newMedForm').value,
       newMedRoute: document.getElementById('newMedRoute').value,
       newMedProgram: document.getElementById('newMedProgram').value,
    };
  });
  console.log('DEBUG DATA BEFORE SAVE:', debugData);
  
  await page.evaluate(() => saveNewItem());
  await new Promise(r => setTimeout(r, 3000));
  
  await browser.close();
})();
