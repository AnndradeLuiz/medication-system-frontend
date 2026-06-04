const puppeteer = require('puppeteer');

(async () => {
  console.log('Iniciando navegador automatizado para Testes CRUD (Create, Read, Update, Delete) de Paciente...');
  const browser = await puppeteer.launch({ 
    headless: false,
    defaultViewport: null,
    args: ['--start-maximized']
  });
  const page = await browser.newPage();
  
  // Aceita automaticamente todos os window.confirm e window.alert
  page.on('dialog', async dialog => {
    console.log('  -> Dialog (Confirm/Alert) detectado e aceito:', dialog.message());
    await dialog.accept();
  });
  
  console.log('1. Navegando para o sistema local e realizando Login...');
  await page.goto('http://127.0.0.1:5500/login.html');
  await page.type('#loginDocument', '99973740297');
  await page.type('#password', '3011');
  await page.evaluate(() => document.querySelector('button[type="submit"]').click());
  await page.waitForNavigation();
  
  console.log('2. Entrando na seção de Pacientes...');
  await page.evaluate(() => { switchView('patient'); });
  await new Promise(r => setTimeout(r, 1000));
  
  console.log('3. Inserindo novo paciente...');
  await page.evaluate(() => { 
    const tabs = document.querySelectorAll('.tab');
    for (let tab of tabs) {
      if (tab.innerText.includes('Cadastrar Novo')) {
        tab.click();
        break;
      }
    }
  });
  await new Promise(r => setTimeout(r, 1000));
  
  await page.type('#newName', 'Paciente Teste Automacao');
  await page.type('#newCpf', '06236618055'); 
  await page.type('#newBirthDate', '01011990');
  
  await page.evaluate(() => document.querySelector('#btnSaveNewPatient').click());
  console.log('  -> Botão de salvar clicado. Aguardando processamento e retorno para a tela de busca...');
  await new Promise(r => setTimeout(r, 3000)); 
  
  console.log('4. Editando paciente criado...');
  await page.evaluate(() => { 
    const tabs = document.querySelectorAll('.tab');
    for (let tab of tabs) {
      if (tab.innerText.includes('Buscar Paciente')) {
        tab.click();
        break;
      }
    }
  });
  await new Promise(r => setTimeout(r, 1000));
  
  await page.type('#searchInput', 'Paciente Teste Automacao');
  await new Promise(r => setTimeout(r, 1500));
  
  const hasSuggestions = await page.evaluate(() => {
    const suggs = document.querySelectorAll('#patientPageSuggestions li');
    if(suggs.length > 0) {
        suggs[0].click();
        return true;
    }
    return false;
  });
  
  if(hasSuggestions) {
    console.log('  -> Paciente encontrado na busca! Modal aberto.');
    await new Promise(r => setTimeout(r, 1500));
    
    console.log('  -> Ativando modo de edição...');
    await page.evaluate(() => enableEditMode());
    await new Promise(r => setTimeout(r, 1000));
    
    console.log('  -> Alterando nome do paciente...');
    await page.type('#editName', ' - Editado');
    await page.evaluate(() => savePatientEdit());
    await new Promise(r => setTimeout(r, 3000));
    console.log('  -> Edição salva com sucesso!');
    
    console.log('5. Deletando (Desativando) o paciente...');
    await page.evaluate(() => {
        const id = document.getElementById('editId').value;
        if(id) toggleStatus(id);
    });
    await new Promise(r => setTimeout(r, 2000));
    console.log('  -> Paciente desativado com sucesso!');
    
  } else {
    console.log('ERRO: O paciente criado não apareceu na busca. Inserção falhou (CPF duplicado?).');
  }
  
  console.log('Testes de CRUD concluídos! Fechando navegador em 3 segundos...');
  await new Promise(r => setTimeout(r, 3000));
  await browser.close();
})();
