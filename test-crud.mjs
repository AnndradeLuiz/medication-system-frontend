const API_URL = 'http://localhost:8080';

async function run() {
    console.log("=== INICIANDO TESTE CRUD (PACIENTES E FUNCIONÁRIOS) ===");
    
    // 1. LOGIN
    const loginRes = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login: "99973740297", password: "3011" })
    });
    
    if (!loginRes.ok) {
        console.error("❌ Falha no login", await loginRes.text());
        return;
    }
    const loginData = await loginRes.json();
    const token = loginData.token;
    console.log("✅ Login bem-sucedido.");
    
    // Decode JWT payload
    try {
        const payloadBase64 = token.split('.')[1];
        const payloadJson = Buffer.from(payloadBase64, 'base64').toString('utf8');
        console.log("Token payload:", payloadJson);
    } catch(e) {}
    
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };

    function gerarCpf() {
        const n = (r) => Math.round(Math.random() * r);
        const mod = (dv, d) => Math.round(dv - Math.floor(dv / d) * d);
        let n1 = n(9), n2 = n(9), n3 = n(9), n4 = n(9), n5 = n(9), n6 = n(9), n7 = n(9), n8 = n(9), n9 = n(9);
        let d1 = n9*2+n8*3+n7*4+n6*5+n5*6+n4*7+n3*8+n2*9+n1*10;
        d1 = 11 - mod(d1, 11);
        if (d1 >= 10) d1 = 0;
        let d2 = d1*2+n9*3+n8*4+n7*5+n6*6+n5*7+n4*8+n3*9+n2*10+n1*11;
        d2 = 11 - mod(d2, 11);
        if (d2 >= 10) d2 = 0;
        return ''+n1+n2+n3+n4+n5+n6+n7+n8+n9+d1+d2;
    }

    // ============================================
    // CRUD FUNCIONÁRIOS
    // ============================================
    console.log("\n--- TESTANDO FUNCIONÁRIOS ---");
    let employeeId = null;
    let empCpf = gerarCpf();
    
    // CREATE
    const fakeEmployee = {
        name: "Funcionario Teste CRUD",
        cpf: empCpf,
        registration: "TEST" + Math.floor(Math.random() * 10000),
        role: "ENF",
        status: true,
        password: "123"
    };
    
    const empCreateRes = await fetch(`${API_URL}/employees`, {
        method: 'POST',
        headers,
        body: JSON.stringify(fakeEmployee)
    });
    
    if (empCreateRes.ok) {
        console.log(`✅ [CREATE] Funcionário criado (Status: ${empCreateRes.status})`);
        // O corpo da resposta pode ser vazio, então vamos buscar na lista pelo CPF
        const empReadRes = await fetch(`${API_URL}/employees?page=0&size=500`, { headers });
        if (empReadRes.ok) {
            const list = await empReadRes.json();
            const found = list.content.find(e => e.cpf === empCpf);
            if (found) {
                employeeId = found.id;
                console.log(`✅ [READ] Funcionário encontrado na listagem! (ID: ${employeeId}, Nome: ${found.name})`);
            } else {
                console.log(`❌ [READ] Funcionário não encontrado na listagem após a criação.`);
            }
        }
    } else {
        console.error("❌ [CREATE] Erro ao criar funcionário:", await empCreateRes.text());
    }
    
    if (employeeId) {
        // UPDATE
        const empUpdateData = {
            id: employeeId,
            name: "Funcionario Teste Z Atualizado",
            role: "TEC",
            status: false
        };
        const empUpdateRes = await fetch(`${API_URL}/employees/${employeeId}`, {
            method: 'PUT',
            headers,
            body: JSON.stringify(empUpdateData)
        });
        if (empUpdateRes.ok) {
            console.log(`✅ [UPDATE] Funcionário atualizado com sucesso.`);
        } else {
            console.error("❌ [UPDATE] Erro na atualização:", await empUpdateRes.text());
        }
        
        // DELETE
        const empDeleteRes = await fetch(`${API_URL}/employees/${employeeId}`, {
            method: 'DELETE',
            headers
        });
        if (empDeleteRes.ok) {
            console.log(`✅ [DELETE] Funcionário deletado com sucesso.`);
        } else {
            console.error("❌ [DELETE] Erro ao deletar:", await empDeleteRes.text());
        }
    }

    // ============================================
    // CRUD PACIENTES
    // ============================================
    console.log("\n--- TESTANDO PACIENTES ---");
    
    const getPatRes = await fetch(`${API_URL}/patients?page=0&size=5`, { headers });
    console.log("Status do GET /patients:", getPatRes.status);
    if(getPatRes.ok) console.log("✅ Conseguiu ler pacientes.");
    else console.log("❌ Falhou ao ler pacientes.");

    let patientId = null;
    let patCpf = gerarCpf();
    
    // Gerar um CNS válido fake (começando com 1 ou 2, com tamanho 15 e validação de soma Módulo 11)
    // Para simplificar, vou tentar passar null ou omitir para ver se o backend aceita.
    const fakePatient = {
        name: "Paciente Teste Beta",
        cpf: patCpf,
        // cns foi omitido
        birthDate: "1990-05-10T00:00:00Z",
        phones: ["11988888888"],
        programs: [],
        status: true,
        external: false
    };
    
    const patCreateRes = await fetch(`${API_URL}/patients`, {
        method: 'POST',
        headers,
        body: JSON.stringify(fakePatient)
    });
    
    if (patCreateRes.ok) {
        console.log(`✅ [CREATE] Paciente criado (Status: ${patCreateRes.status})`);
        const patReadRes = await fetch(`${API_URL}/patients?page=0&size=500`, { headers });
        if (patReadRes.ok) {
            const list = await patReadRes.json();
            const found = list.content ? list.content.find(p => p.cpf === patCpf) : list.find(p => p.cpf === patCpf);
            if (found) {
                patientId = found.id;
                console.log(`✅ [READ] Paciente encontrado na listagem! (ID: ${patientId}, Nome: ${found.name})`);
            } else {
                console.log(`❌ [READ] Paciente não encontrado na listagem após a criação.`);
            }
        }
    } else {
        console.error("❌ [CREATE] Erro ao criar paciente:", await patCreateRes.text());
    }
    
    if (patientId) {
        // UPDATE
        const patUpdateData = {
            id: patientId,
            name: "Paciente Teste Beta Modificado",
            programs: [],
            status: false
        };
        const patUpdateRes = await fetch(`${API_URL}/patients/${patientId}`, {
            method: 'PUT',
            headers,
            body: JSON.stringify(patUpdateData)
        });
        if (patUpdateRes.ok) {
            console.log(`✅ [UPDATE] Paciente atualizado com sucesso.`);
        } else {
            console.error("❌ [UPDATE] Erro na atualização:", await patUpdateRes.text());
        }
        
        // DELETE
        const patDeleteRes = await fetch(`${API_URL}/patients/${patientId}`, {
            method: 'DELETE',
            headers
        });
        if (patDeleteRes.ok) {
            console.log(`✅ [DELETE] Paciente deletado (soft delete/inativado) com sucesso.`);
        } else {
            console.error("❌ [DELETE] Erro ao deletar:", await patDeleteRes.text());
        }
    }
    
    console.log("\n=== TESTE CONCLUÍDO ===");
}

run();
