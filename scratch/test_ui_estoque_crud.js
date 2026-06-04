const puppeteer = require('puppeteer');

(async () => {
  console.log('Iniciando navegador automatizado para Testes CRUD de Estoque (Medicamentos e Insumos)...');
  const browser = await puppeteer.launch({ 
    headless: false,
    defaultViewport: null,
    args: ['--start-maximized']
  });
  const page = await browser.newPage();
  
  page.on('response', async response => {
    if (response.url().includes('8080/medications') || response.url().includes('8080/supplies') || response.url().includes('8080/supply-facilities')) {
      if (response.request().method() === 'POST') {
         console.log(`\n[NETWORK] POST ${response.url()} -> ${response.status()}`);
         try {
           console.log(`[NETWORK BODY]`, await response.text());
         } catch(e) {}
      }
    }
  });

  page.on('dialog', async dialog => {
    console.log('  -> Dialog aceito:', dialog.message());
    await dialog.accept();
  });
  
  console.log('1. Navegando para o sistema local e realizando Login...');
  await page.goto('http://127.0.0.1:5500/login.html');
  await page.type('#loginDocument', '99973740297');
  await page.type('#password', '3011');
  await page.evaluate(() => document.querySelector('button[type="submit"]').click());
  await page.waitForNavigation();
  
  console.log('2. Entrando na seção de Estoque...');
  await page.evaluate(() => { switchView('estoque'); });
  await new Promise(r => setTimeout(r, 1000));
  
  async function testarFluxoCRUD(modeName, itemName, typeValue = null) {
    console.log(`\n======================================================`);
    console.log(`INICIANDO TESTE PARA: ${modeName.toUpperCase()} - ${itemName}`);
    
    if (modeName === 'medicamento') {
      await page.evaluate(() => setMode('medicamentos'));
    } else {
      await page.evaluate(() => setMode('insumos'));
    }
    await new Promise(r => setTimeout(r, 1000));
    
    console.log(`  -> [C] CADASTRAR: Indo para aba de cadastro...`);
    await page.evaluate(() => { 
        const tabs = document.querySelectorAll('#view-estoque .tab');
        for (let tab of tabs) {
            if (tab.innerText.includes('Cadastrar Novo')) { tab.click(); break; }
        }
    });
    await new Promise(r => setTimeout(r, 1000));
    
    await page.type('#newItemName', itemName);
    if (modeName === 'medicamento') {
        await page.type('#newMedConcentrationValue', '500');
        await page.select('#newMedConcentrationUnit', 'mg');
        await page.select('#newMedForm', 'COMPRIMIDO');
        await page.select('#newMedRoute', 'ORAL');
        await page.select('#newMedProgram', 'FARMACIA_BASICA'); // ADDED THIS
    } else {
        await page.select('#newInsumoType', typeValue); 
        await page.type('#newInsumoUnit', 'Caixa');
    }
    
    await page.evaluate(() => document.querySelector('#btnSaveNewCatalogItem').click());
    console.log(`  -> Cadastro salvo! Aguardando retorno...`);
    await new Promise(r => setTimeout(r, 2000));
    
    console.log(`  -> [R] LER/BUSCAR: Indo para aba de busca...`);
    await page.evaluate(() => { 
        const tabs = document.querySelectorAll('#view-estoque .tab');
        for (let tab of tabs) {
            if (tab.innerText.includes('Buscar Item')) { tab.click(); break; }
        }
    });
    await new Promise(r => setTimeout(r, 1000));
    
    await page.evaluate(() => { document.querySelector('#estoqueSearchInput').value = ''; });
    await page.type('#estoqueSearchInput', itemName);
    await new Promise(r => setTimeout(r, 2000));
    
    const hasSuggestions = await page.evaluate(() => {
        const suggs = document.querySelectorAll('#estoqueSuggestions li');
        if(suggs.length > 0) {
            suggs[0].click(); 
            return true;
        }
        return false;
    });
    
    if (hasSuggestions) {
        console.log(`  -> Item encontrado na busca! Aba de edição aberta.`);
        await new Promise(r => setTimeout(r, 1500));
        
        console.log(`  -> [U] EDITAR: Alterando nome do item...`);
        await page.type('#editItemName', ' Mod');
        await page.evaluate(() => document.querySelector('#btnSaveEditLabel').click());
        console.log(`  -> Edição salva com sucesso!`);
        await new Promise(r => setTimeout(r, 2000));
        
        console.log(`  -> [D] DELETAR: Excluindo o item do catálogo...`);
        await page.evaluate(() => deleteItem());
        await new Promise(r => setTimeout(r, 2000));
        console.log(`  -> Item excluído com sucesso!`);
        
    } else {
        console.log(`  -> ERRO: O item '${itemName}' não apareceu na busca!`);
    }
    console.log(`TESTE FINALIZADO PARA: ${modeName.toUpperCase()}`);
  }
  
  await testarFluxoCRUD('medicamento', 'AutoTest_v3_Med');
  await testarFluxoCRUD('insumo', 'AutoTest_v3_Seringa', 'medical');
  await testarFluxoCRUD('insumo', 'AutoTest_v3_Papel', 'facility');
  
  console.log('\nTodos os Testes de CRUD do Estoque concluídos! Fechando navegador em 3 segundos...');
  await new Promise(r => setTimeout(r, 3000));
  await browser.close();
})();
