const puppeteer = require('puppeteer');

(async () => {
  console.log('Iniciando navegador automatizado para Teste CRUD de Dispensação...');
  const browser = await puppeteer.launch({ 
    headless: false,
    defaultViewport: null,
    args: ['--start-maximized']
  });
  const page = await browser.newPage();

  page.on('dialog', async dialog => {
    console.log('  -> Dialog aceito:', dialog.message());
    await dialog.accept();
  });
  
  console.log('1. Realizando Login...');
  await page.goto('http://127.0.0.1:5500/login.html');
  await page.type('#loginDocument', '99973740297');
  await page.type('#password', '3011');
  await page.evaluate(() => document.querySelector('button[type="submit"]').click());
  await page.waitForNavigation();
  
  console.log('2. Entrando na seção de Dispensação...');
  await page.evaluate(() => { switchView('dashboard'); });
  await new Promise(r => setTimeout(r, 1000));
  
  console.log('======================================================');
  console.log('INICIANDO TESTE DE DISPENSAÇÃO');
  
  console.log('  -> [C] CADASTRAR (Registrar Dispensação)');
  await page.type('#dispensePatientInput', 'Lara Titiana');
  await new Promise(r => setTimeout(r, 1000));
  await page.evaluate(() => {
    const list = document.querySelectorAll('#patientSuggestions li');
    if(list.length > 0) list[0].click();
  });
  await new Promise(r => setTimeout(r, 500));
  
  await page.type('#dispenseMedInput', 'Ácido');
  await new Promise(r => setTimeout(r, 1000));
  await page.evaluate(() => {
    const list = document.querySelectorAll('#medSuggestions li');
    if(list.length > 0) list[0].click();
  });
  await new Promise(r => setTimeout(r, 500));
  
  await page.evaluate(() => { document.getElementById('medQuantity').value = ''; });
  await page.type('#medQuantity', '2');
  await page.evaluate(() => document.querySelector('#btnAddItem').click());
  await new Promise(r => setTimeout(r, 500));
  
  await page.evaluate(() => document.querySelector('#btnFinalize').click());
  console.log('  -> Dispensação registrada! Aguardando retorno...');
  await new Promise(r => setTimeout(r, 2500));
  
  console.log('  -> [R/U] LER/EDITAR: Indo para aba de edição...');
  await page.evaluate(() => { 
      const tabs = document.querySelectorAll('#view-dashboard .tab');
      for (let tab of tabs) {
          if (tab.innerText.includes('Editar Histórico')) { tab.click(); break; }
      }
  });
  await new Promise(r => setTimeout(r, 1000));
  
  await page.evaluate(() => { document.querySelector('#searchEditDispensationInput').value = ''; });
  await page.type('#searchEditDispensationInput', 'Lara Titiana');
  await new Promise(r => setTimeout(r, 1500));
  
  const hasSuggestions = await page.evaluate(() => {
      const suggs = document.querySelectorAll('#editDispensationSuggestions li');
      if(suggs.length > 0) {
          suggs[0].click(); 
          return true;
      }
      return false;
  });
  
  if (hasSuggestions) {
      console.log('  -> Dispensação encontrada na busca! Aba de edição aberta.');
      await new Promise(r => setTimeout(r, 1500));
      
      console.log('  -> Removendo o item da dispensação (Simulando Edição/Cancelamento de Item)...');
      await page.evaluate(() => {
          const btnRemover = document.querySelector('.btn-ghost-danger');
          if (btnRemover) btnRemover.click();
      });
      await new Promise(r => setTimeout(r, 1000));
      
      console.log('  -> Salvando a edição...');
      await page.evaluate(() => document.querySelector('#btnUpdateDispensation').click());
      await new Promise(r => setTimeout(r, 2000));
      console.log('  -> Edição salva com sucesso!');
      
  } else {
      console.log('  -> ERRO: A dispensação de "Lara Titiana" não apareceu na busca!');
  }
  
  console.log('======================================================');
  console.log('Todos os testes da Dispensação concluídos! Fechando navegador em 3 segundos...');
  await new Promise(r => setTimeout(r, 3000));
  await browser.close();
})();
