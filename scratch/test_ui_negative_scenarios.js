const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch({ headless: false, defaultViewport: null, args: ['--start-maximized'] });
    const page = await browser.newPage();
    
    // Toast Interceptor
    let currentToasts = [];
    page.on('console', msg => {
        const text = msg.text();
        if (text.startsWith('[TOAST INTERCEPTADO]')) {
            const regex = /\[(.*?)\] (.*)/;
            const match = text.replace('[TOAST INTERCEPTADO] ', '').match(regex);
            if (match) {
                currentToasts.push({ type: match[1], msg: match[2] });
                console.log(`\x1b[33m  -> TOAST DETECTADO: [${match[1]}] ${match[2]}\x1b[0m`);
            }
        }
    });

    // Toast interceptor logic will be added after navigation

    console.log('1. Acessando a aplicação...');
    await page.goto('http://127.0.0.1:5500/app.html');
    await new Promise(r => setTimeout(r, 1000));
    
    const isLoggedIn = await page.evaluate(() => !!localStorage.getItem('sgdm_token'));
    if (!isLoggedIn) {
        console.log('   -> Realizando Login...');
        await page.goto('http://127.0.0.1:5500/login.html');
        await new Promise(r => setTimeout(r, 1000));
        await page.type('#loginDocument', '99973740297');
        await page.type('#password', '3011');
        await Promise.all([
            page.waitForNavigation(),
            page.evaluate(() => document.querySelector('button[type="submit"]').click())
        ]);
        await new Promise(r => setTimeout(r, 1000));
    }

    const waitForTimeout = ms => new Promise(r => setTimeout(r, ms));
    
    // Override showToast now that we are in the application (after login)
    await page.evaluate(() => {
        const originalShowToast = window.showToast;
        window.showToast = function(msg, type) {
            console.log(`[TOAST INTERCEPTADO] [${type || 'success'}] ${msg}`);
            if (originalShowToast) originalShowToast(msg, type);
        };
    });

    // Accept alerts automatically
    page.on('dialog', async dialog => await dialog.accept());
    const clearToasts = () => { currentToasts = []; };
    const assertToast = (expectedMsgPart, expectedType) => {
        const found = currentToasts.find(t => t.msg.includes(expectedMsgPart) && (!expectedType || t.type === expectedType));
        if (found) {
            console.log(`  \x1b[32m[PASS]\x1b[0m Recebeu toast de erro esperado: "${found.msg}"`);
            return true;
        } else {
            console.error(`  \x1b[31m[FAIL]\x1b[0m Não encontrou toast contendo: "${expectedMsgPart}"`);
            return false;
        }
    };

    let totalTests = 0;
    let passedTests = 0;

    const runTest = async (name, testFn) => {
        console.log(`\n\x1b[36m-> Teste: ${name}\x1b[0m`);
        clearToasts();
        totalTests++;
        try {
            const pass = await testFn();
            if (pass) passedTests++;
        } catch (e) {
            console.error(`  \x1b[31m[FAIL]\x1b[0m Exceção durante o teste: ${e.message}`);
        }
        await waitForTimeout(500);
    };

    // ============================================
    // MÓDULO: PACIENTES
    // ============================================
    console.log('\n===========================================');
    console.log(' MÓDULO: PACIENTES');
    console.log('===========================================');
    await page.evaluate(() => switchView('patient'));
    await waitForTimeout(1000);
    await page.evaluate(() => { 
        const btn = document.querySelector('div[onclick*="tab-cadastro-paciente"]');
        if(btn) btn.click();
    });
    await waitForTimeout(1000);

    await runTest('Tentar salvar paciente sem preencher nome ou documentos', async () => {
        await page.evaluate(() => document.querySelector('#btnSaveNewPatient').click());
        await waitForTimeout(1000);
        return assertToast('informe o nome completo', 'warning');
    });

    await runTest('Tentar salvar paciente com nome incompleto', async () => {
        await page.type('#newName', 'João');
        await page.evaluate(() => document.querySelector('#btnSaveNewPatient').click());
        await waitForTimeout(1000);
        return assertToast('informe o nome completo', 'warning');
    });

    await runTest('Tentar salvar paciente com CPF matematicamente incorreto', async () => {
        await page.evaluate(() => document.querySelector('#newName').value = '');
        await page.type('#newName', 'João da Silva');
        await page.type('#newCpf', '11111111111');
        await page.evaluate(() => document.querySelector('#btnSaveNewPatient').click());
        await waitForTimeout(1000);
        return assertToast('CPF informado é inválido', 'error');
    });

    await runTest('Tentar salvar paciente com Data de Nascimento no Futuro', async () => {
        await page.evaluate(() => document.querySelector('#newCpf').value = '');
        // Set a future date natively
        await page.evaluate(() => {
            const tmr = new Date();
            tmr.setDate(tmr.getDate() + 1);
            document.querySelector('#newBirthDate').value = tmr.toISOString().split('T')[0];
        });
        await page.type('#newCns', '700000000000001'); // Some random 15 digits
        await page.evaluate(() => document.querySelector('#btnSaveNewPatient').click());
        await waitForTimeout(1000);
        return assertToast('Data de nascimento inválida! O paciente ainda não nasceu?', 'error');
    });


    // ============================================
    // MÓDULO: FUNCIONÁRIOS
    // ============================================
    console.log('\n===========================================');
    console.log(' MÓDULO: FUNCIONÁRIOS');
    console.log('===========================================');
    await page.evaluate(() => switchView('funcionarios'));
    await waitForTimeout(1000);
    await page.evaluate(() => { 
        const btn = document.querySelector('div[onclick*="tab-cadastro-funcionario"]');
        if(btn) btn.click();
    });
    await waitForTimeout(1000);

    await runTest('Tentar salvar funcionário com formulário totalmente em branco', async () => {
        await page.evaluate(() => document.querySelector('#btnSaveNewEmployee').click());
        await waitForTimeout(1000);
        return assertToast('Todos os campos (exceto Matrícula) são obrigatórios', 'error');
    });

    await runTest('Tentar salvar funcionário com CPF inválido', async () => {
        await page.type('#newEmpName', 'Funcionário Errado');
        await page.type('#newEmpRegistration', 'MAT9999');
        await page.type('#newEmpCpf', '99999999999'); // Invalid CPF
        await page.type('#newEmpPassword', '123');
        await page.select('#newEmpRole', 'TEC');
        await page.evaluate(() => document.querySelector('#btnSaveNewEmployee').click());
        await waitForTimeout(1000);
        return assertToast('CPF informado é inválido', 'error');
    });


    // ============================================
    // MÓDULO: ESTOQUE E INSUMOS
    // ============================================
    console.log('\n===========================================');
    console.log(' MÓDULO: ESTOQUE E INSUMOS');
    console.log('===========================================');
    await page.evaluate(() => switchView('estoque'));
    await waitForTimeout(1000);
    
    // Aba: Cadastrar Item (Medicamento)
    await page.evaluate(() => { 
        const btn = document.querySelector('div[onclick*="tab-cadastro-estoque"]');
        if(btn) btn.click();
    });
    await waitForTimeout(1000);

    await runTest('Tentar cadastrar medicamento sem preencher campos', async () => {
        await page.evaluate(() => document.querySelector('#btnSaveNewCatalogItem').click());
        await waitForTimeout(1000);
        return assertToast('obrigatório', 'warning') || assertToast('obrigatórios', 'warning') || assertToast('vazio', 'error');
    });

    // Aba: Entrada de Lote
    await page.evaluate(() => { 
        const btn = document.querySelector('div[onclick*="tab-lote"]');
        if(btn) btn.click();
    });
    await waitForTimeout(1000);

    await runTest('Tentar inserir lote sem preencher dados', async () => {
        await page.evaluate(() => document.querySelector('#btnSaveLot').click());
        await waitForTimeout(1000);
        return assertToast('Preencha todos os campos do lote', 'success') || assertToast('obrigatório', 'error');
    });


    // ============================================
    // MÓDULO: DISPENSAÇÃO
    // ============================================
    console.log('\n===========================================');
    console.log(' MÓDULO: DISPENSAÇÃO');
    console.log('===========================================');
    await page.evaluate(() => switchView('dashboard'));
    await waitForTimeout(1000);
    
    await page.evaluate(() => { 
        const btn = document.querySelector('div[onclick*="tab-nova-dispensacao"]');
        if(btn) btn.click();
    });
    await waitForTimeout(1000);

    await runTest('Tentar dispensar sem paciente selecionado e sem itens', async () => {
        await page.evaluate(() => document.querySelector('#btnFinalize').click());
        await waitForTimeout(1000);
        return assertToast('pesquise e clique no nome do paciente', 'success') || assertToast('paciente', 'error');
    });

    console.log('\n===========================================');
    console.log(` RESULTADO FINAL: ${passedTests} de ${totalTests} testes passaram.`);
    console.log('===========================================');

    await browser.close();
})();
