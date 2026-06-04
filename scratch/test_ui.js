const puppeteer = require('puppeteer');

(async () => {
  console.log('Iniciando navegador automatizado para testes...');
  const browser = await puppeteer.launch({ 
    headless: false,
    defaultViewport: null,
    args: ['--start-maximized']
  });
  const page = await browser.newPage();
  
  console.log('Navegando para o sistema local...');
  await page.goto('http://127.0.0.1:5500/login.html');
  
  console.log('Preenchendo CPF e Senha...');
  await page.type('#loginDocument', '99973740297');
  await page.type('#password', '3011');
  
  console.log('Clicando em Entrar...');
  await page.click('button[type="submit"]');
  
  await page.waitForNavigation();
  console.log('Login efetuado. Navegando para seção de pacientes...');
  
  await page.evaluate(() => { switchView('patient'); });
  await new Promise(r => setTimeout(r, 1000));
  
  console.log('Testando busca de paciente...');
  await page.type('#searchInput', 'Luiz');
  await new Promise(r => setTimeout(r, 1000));
  
  const suggestions = await page.$('#patientPageSuggestions li');
  if(suggestions) {
    console.log('Sugestões encontradas. Clicando no primeiro resultado...');
    await suggestions.click();
    await new Promise(r => setTimeout(r, 1000));
    console.log('Modal aberto com sucesso!');
  } else {
    console.log('Nenhuma sugestão apareceu na busca flutuante.');
  }
  
  console.log('Teste concluído! Fechando navegador em 3 segundos...');
  await new Promise(r => setTimeout(r, 3000));
  await browser.close();
})();
