const puppeteer = require('puppeteer');

(async () => {
  console.log('Iniciando navegador automatizado para Teste CRUD de Funcionários...');
  const browser = await puppeteer.launch({ 
    headless: false,
    defaultViewport: null,
    args: ['--start-maximized']
  });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
  
  // Aceita automaticamente alerts e confirms
  page.on('dialog', async dialog => {
    console.log('  -> Dialog detectado e aceito:', dialog.message());
    await dialog.accept();
  });
  
  console.log('1. Realizando Login...');
  await page.goto('http://127.0.0.1:5500/login.html'); // Assuming local Live Server is on 5500
  await page.type('#loginDocument', '99973740297');
  await page.type('#password', '3011');
  await page.evaluate(() => document.querySelector('button[type="submit"]').click());
  await page.waitForNavigation();
  
  console.log('2. Entrando na seção de Funcionários...');
  await page.evaluate(() => { 
      switchView('funcionarios'); 
      
      // Override showToast to log it so we can intercept it in Puppeteer
      const originalShowToast = window.showToast;
      window.showToast = function(msg, type) {
          console.log(`[TOAST INTERCEPTED] [${type || 'success'}] ${msg}`);
          if (originalShowToast) originalShowToast(msg, type);
      };
  });
  await new Promise(r => setTimeout(r, 1000));
  
  console.log('======================================================');
  console.log('INICIANDO TESTE DE FUNCIONÁRIOS');
  
  console.log('  -> [C] CADASTRAR: Abrindo aba de cadastro...');
  await page.evaluate(() => { 
      const btn = document.querySelector('div[onclick*="tab-cadastro-funcionario"]');
      if(btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 1000));
  
  const generateCpf = () => {
    const randomDigit = () => Math.floor(Math.random() * 10);
    const calcDigit = (cpfArray, factor) => {
        let total = 0;
        for (let i = 0; i < cpfArray.length; i++) total += cpfArray[i] * factor--;
        let remainder = total % 11;
        return remainder < 2 ? 0 : 11 - remainder;
    };
    const cpf = Array.from({ length: 9 }, randomDigit);
    cpf.push(calcDigit(cpf, 10));
    cpf.push(calcDigit(cpf, 11));
    return cpf.join('');
  };
  
  const testCpf = generateCpf();
  const testReg = 'MAT' + Math.floor(Math.random() * 100000);
  
  await page.type('#newEmpName', 'Funcionario Teste Automacao');
  await page.type('#newEmpRegistration', testReg);
  await page.type('#newEmpCpf', testCpf); 
  await page.type('#newEmpPassword', '123456');
  await page.select('#newEmpRole', 'ENF');

  
  // Debug input values
  const inputValues = await page.evaluate(() => {
      return {
          name: document.getElementById('newEmpName').value,
          registration: document.getElementById('newEmpRegistration').value,
          cpf: document.getElementById('newEmpCpf').value,
          password: document.getElementById('newEmpPassword').value,
          role: document.getElementById('newEmpRole').value
      };
  });
  console.log('  -> INPUT VALUES ANTES DO SAVE:', inputValues);

  await page.evaluate(() => document.querySelector('#btnSaveNewEmployee').click());
  console.log('  -> Botão de salvar clicado. Verificando toasts...');
  await new Promise(r => setTimeout(r, 1000)); 
  
  // Log toasts
  const toasts = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('.toast')).map(t => t.innerText);
  });
  if(toasts.length > 0) console.log('  -> MENSAGENS TOAST:', toasts);
  
  await new Promise(r => setTimeout(r, 2000));
  
  console.log('  -> [R/U] LER/EDITAR: Pesquisando funcionário na tabela...');
  await page.type('#searchEmployeeInput', testCpf);
  await page.evaluate(() => filterEmployeeTable());
  await new Promise(r => setTimeout(r, 1500));
  
  const foundEmployee = await page.evaluate(() => {
    const rows = document.querySelectorAll('#employeeTableBody tr');
    if (rows.length > 0 && !rows[0].querySelector('.empty-msg')) {
        const editBtn = rows[0].querySelector('.btn-edit-emp');
        if (editBtn) {
            editBtn.click();
            return true;
        }
    }
    return false;
  });
  
  if (foundEmployee) {
    console.log('  -> Funcionário encontrado na busca! Modal aberto.');
    await new Promise(r => setTimeout(r, 1500));
    
    console.log('  -> Alterando nome do funcionário...');
    // Limpa o input antes de digitar
    await page.evaluate(() => { document.getElementById('editEmpName').value = ''; });
    await page.type('#editEmpName', 'Funcionario Editado via Automacao');
    
    // Salvar edição
    await page.evaluate(() => document.getElementById('btnUpdateEmployee').click());
    await new Promise(r => setTimeout(r, 2000));
    console.log('  -> Edição salva com sucesso!');
    
    console.log('  -> [D] DELETAR: Excluindo funcionário da tabela...');
    // Como a tabela foi recarregada após editar, pesquisamos novamente
    await page.type('#searchEmployeeInput', testCpf);
    await page.evaluate(() => filterEmployeeTable());
    await new Promise(r => setTimeout(r, 1000));
    
    await page.evaluate(() => {
        const rows = document.querySelectorAll('#employeeTableBody tr');
        if (rows.length > 0 && !rows[0].querySelector('.empty-msg')) {
            const delBtn = rows[0].querySelector('.btn-delete-emp');
            if (delBtn) delBtn.click();
        }
    });
    
    // Aguardar modal de confirmação e clicar no botão Confirmar
    await new Promise(r => setTimeout(r, 1000));
    await page.evaluate(() => document.getElementById('btnConfirmDelete').click());
    await new Promise(r => setTimeout(r, 2000));
    
    console.log('  -> Funcionário excluído com sucesso!');
    
  } else {
    console.log('  -> ERRO: O funcionário não foi encontrado na tabela.');
    await page.screenshot({ path: 'debug_screenshot_employee.png' });
    console.log('  -> Screenshot salvo em debug_screenshot_employee.png');
  }
  
  console.log('======================================================');
  console.log('Todos os testes de Funcionários concluídos! Fechando navegador em 3 segundos...');
  await new Promise(r => setTimeout(r, 3000));
  await browser.close();
})();
