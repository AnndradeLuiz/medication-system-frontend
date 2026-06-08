(function() {
// API_URL vem do config.js
let allEmployees = [];
let employeeCurrentPage = 0;
let employeeTotalPages = 1;

// --- CARREGAR FUNCIONÁRIOS ---
async function loadEmployees(page = 0) {
    employeeCurrentPage = page;
    setLoading('btnRefreshEmployees', true);
    
    // Default size is 20
    let pageSize = 20;

    try {
        const response = await fetch(`${API_URL}/employees?page=${employeeCurrentPage}&size=${pageSize}`, {
            headers: getAuthHeaders(),
            cache: 'no-store'
        });
        if (!response.ok) throw new Error('Erro ao carregar funcionários');
        
        const pageData = await response.json();
        allEmployees = pageData.content || [];
        
        // Update pagination UI
        const pageInfo = pageData.page || pageData;
        employeeTotalPages = pageInfo.totalPages || 1;
        document.getElementById('employeeCurrentPage').innerText = `Pág ${pageInfo.number + 1} de ${employeeTotalPages}`;
        
        const startItem = pageInfo.totalElements === 0 ? 0 : (pageInfo.number * pageInfo.size) + 1;
        const endItem = Math.min((pageInfo.number + 1) * pageInfo.size, pageInfo.totalElements);
        document.getElementById('employeePageInfo').innerText = `${startItem}-${endItem} de ${pageInfo.totalElements}`;
        
        document.getElementById('btnPrevEmployee').disabled = pageInfo.number === 0;
        document.getElementById('btnNextEmployee').disabled = pageInfo.number >= (employeeTotalPages - 1);

        renderEmployeeTable(allEmployees);
    } catch (e) {
        console.error(e);
        document.getElementById('employeeTableBody').innerHTML =
            '<tr><td colspan="5" class="empty-msg" style="color:#ef4444;">Erro ao carregar dados. Verifique a conexão com o servidor.</td></tr>';
    } finally {
        setLoading('btnRefreshEmployees', false);
    }
}

window.prevEmployeePage = function() {
    if (employeeCurrentPage > 0) loadEmployees(employeeCurrentPage - 1);
};

window.nextEmployeePage = function() {
    if (employeeCurrentPage < employeeTotalPages - 1) loadEmployees(employeeCurrentPage + 1);
};

// --- RENDERIZAR TABELA ---
function renderEmployeeTable(list) {
    const tbody = document.getElementById('employeeTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    if (!list || list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-msg">Nenhum funcionário encontrado.</td></tr>';
        return;
    }

    const loggedId = localStorage.getItem('sgdm_employeeId');
    const fragment = document.createDocumentFragment();

    list.forEach(emp => {
        const rawId = emp.id || emp._id;
        const empId = typeof rawId === 'object' && rawId.$oid ? rawId.$oid : String(rawId);
        
        const isMe = String(empId) === String(loggedId);
        const badgeClass = `role-${emp.role}`;
        const roleLabel = {
            ADM_TI: 'Administrador TI',
            ENF_GERENTE: 'Enf. Gerente',
            ENF: 'Enfermeiro(a)',
            TRIAGEM: 'Triagem',
            TEC_ENFERMAGEM: 'Téc. Enfermagem',
            FARMACEUTICO: 'Farmacêutico',
            ADMINISTRATIVO: 'Administrativo',
            ACS: 'ACS'
        }[emp.role] || emp.role;

        const statusHtml = emp.status
            ? '<span class="status-indicator status-active">ATIVO</span>'
            : '<span class="status-indicator status-inactive">INATIVO</span>';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="text-center">
                <span class="fw-600 text-main">${escapeHTML(emp.name)}</span>
                ${isMe ? '<span class="status-indicator status-active fs-2xs ml-10">VOCÊ</span>' : ''}
            </td>
            <td class="font-data text-muted text-center">${emp.registration || '-'}</td>
            <td class="font-data text-muted text-center">${formatCPF(emp.cpf)}</td>
            <td class="text-center">
                <span class="role-badge ${badgeClass}">${roleLabel}</span>
            </td>
            <td class="text-center">${statusHtml}</td>
            <td class="text-center">
                <div class="table-actions">
                    <button class="btn-edit-emp btn-icon-sm btn-icon-blue" title="Editar funcionário">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                    ${!isMe ? `
                    <button class="btn-delete-emp btn-icon-sm btn-icon-red" title="Excluir funcionário">
                        <i class="fa-solid fa-trash"></i>
                    </button>` : ''}
                </div>
            </td>
        `;

        // Atribuir eventos usando closures (mais seguro)
        const editBtn = tr.querySelector('.btn-edit-emp');
        if (editBtn) {
            editBtn.addEventListener('click', () => openEditModal(empId));
        }

        const deleteBtn = tr.querySelector('.btn-delete-emp');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => deleteEmployee(empId, emp.name));
        }

        fragment.appendChild(tr);
    });

    tbody.appendChild(fragment);
}


// --- FILTRO DE BUSCA LOCAL ---
function filterEmployeeTable() {
    const q = document.getElementById('searchEmployeeInput').value.toLowerCase();
    const filtered = allEmployees.filter(e =>
        (e.name && e.name.toLowerCase().includes(q)) ||
        (e.registration && e.registration.toLowerCase().includes(q)) ||
        (e.cpf && e.cpf.toLowerCase().includes(q))
    );
    renderEmployeeTable(filtered);
}

function validateEmployeeName(name) {
    if (!name) return { valid: false, message: "O nome é obrigatório." };

    let formattedName = name.replace(/\s+/g, ' ').trim();
    const regexName = /^(?=.{3,}$)(?!.* {2})(?!^[a-zà-öø-ÿ'] [a-zà-öø-ÿ'](?: |$))(?!^[a-zà-öø-ÿ']{2} [a-zà-öø-ÿ']{2}$)^[a-zà-öø-ÿ']+(?: (?:[a-zà-öø-ÿ']{2,}|e|y))+$/i;

    if (!regexName.test(formattedName)) {
        return { 
            valid: false, 
            message: "O nome informado não atende aos padrões. Verifique letras soltas, termos muito curtos ou caracteres inválidos." 
        };
    }

    return { valid: true, formattedName: formattedName };
}

// --- CADASTRAR NOVO FUNCIONÁRIO ---
async function saveNewEmployee() {
    const rawName      = document.getElementById('newEmpName').value;
    let registration = document.getElementById('newEmpRegistration').value.trim();
    if (!registration) registration = "S/M";
    const cpf          = document.getElementById('newEmpCpf').value.trim();
    const password     = document.getElementById('newEmpPassword').value;
    const role         = document.getElementById('newEmpRole').value;
    const status       = true; // Novos funcionários sempre ativos por padrão

    let microarea = null;
    if (role === 'ACS') {
        microarea = document.getElementById('newEmpMicroarea').value;
        if (!microarea) {
            showToast('Erro: A microárea é obrigatória para o cargo ACS.', 'error');
            return;
        }
    }

    if (!rawName || !cpf || !password || !role) {
        showToast('Erro: Todos os campos (exceto Matrícula) são obrigatórios.', 'error');
        return;
    }

    const nameValidation = validateEmployeeName(rawName);
    if (!nameValidation.valid) {
        showToast(`Erro: ${nameValidation.message}`, 'error');
        return;
    }
    const name = nameValidation.formattedName;

    // Validação de CPF
    if (!isValidCPF(cpf)) {
        showToast('Erro: O CPF informado é inválido.', 'error');
        return;
    }

    // Checar duplicatas (Matrícula e CPF)
    const normalizedCpf = cpf.replace(/\D/g, "");
    const duplicate = allEmployees.find(emp => {
        const empReg = (emp.registration || "").trim();
        const empCpf = (emp.cpf || "").replace(/\D/g, "");
        const regMatch = (registration !== "S/M") && (empReg === registration);
        return regMatch || (empCpf !== "" && empCpf === normalizedCpf);
    });

    if (duplicate) {
        const isReg = (duplicate.registration || "").trim() === registration;
        showToast(`Erro: Já existe um funcionário com este ${isReg ? 'matrícula' : 'CPF'}.`, 'error');
        return;
    }

    const payload = { name, registration, cpf: normalizedCpf, password, role, status, microarea: microarea ? parseInt(microarea) : null };

    setLoading('btnSaveNewEmployee', true);
    try {
        const response = await fetch(`${API_URL}/employees`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload)
        });

        if (response.ok || response.status === 201) {
            showToast(`Funcionário "${name}" cadastrado com sucesso!`);
            window.dispatchEvent(new Event('employeesChanged'));
            document.getElementById('newEmpName').value = '';
            document.getElementById('newEmpRegistration').value = '';
            document.getElementById('newEmpCpf').value = '';
            document.getElementById('newEmpPassword').value = '';
            document.getElementById('newEmpRole').value = 'TEC_ENFERMAGEM';
            document.getElementById('newEmpMicroareaGroup').style.display = 'none';
            document.getElementById('newEmpMicroarea').value = '';
            loadEmployees();
            switchTab('tab-lista', document.querySelector('.tab'));
        } else {
            const err = await response.json().catch(() => ({}));
            showToast(err.message || 'Erro ao cadastrar funcionário.', 'error');
        }
    } catch (e) {
        showToast('Erro de conexão com o servidor.', 'error');
    } finally {
        setLoading('btnSaveNewEmployee', false);
    }
}

// --- ABRIR MODAL DE EDIÇÃO ---
function openEditModal(id) {
    const emp = allEmployees.find(e => String(e.id || e._id) === String(id));
    if (!emp) {
        showToast('Erro: Funcionário não encontrado na lista.', 'error');
        return;
    }

    const empId = emp.id || emp._id;
    document.getElementById('editEmpId').value = empId;
    document.getElementById('editEmpName').value = emp.name;
    document.getElementById('editEmpRegistration').value = emp.registration || '';
    
    const cpfInput = document.getElementById('editEmpCpf');
    cpfInput.value = emp.cpf || '';
    // Disparar o evento de input para aplicar a máscara imediatamente
    cpfInput.dispatchEvent(new Event('input'));
    
    document.getElementById('editEmpPassword').value = '';
    document.getElementById('editEmpRole').value = emp.role;
    document.getElementById('editEmpStatus').checked = (emp.status === true);

    if (emp.role === 'ACS') {
        document.getElementById('editEmpMicroareaGroup').style.display = 'block';
        document.getElementById('editEmpMicroarea').value = emp.microarea || '';
    } else {
        document.getElementById('editEmpMicroareaGroup').style.display = 'none';
        document.getElementById('editEmpMicroarea').value = '';
    }

    document.getElementById('editEmployeeModal').classList.add('active');
}

function closeEditModal() {
    document.getElementById('editEmployeeModal').classList.remove('active');
}

// --- SALVAR EDIÇÃO ---
async function saveEmployeeEdit() {
    const id           = document.getElementById('editEmpId').value;
    const rawName      = document.getElementById('editEmpName').value;
    let registration = document.getElementById('editEmpRegistration').value.trim();
    if (!registration) registration = "S/M";
    const cpf          = document.getElementById('editEmpCpf').value.trim();
    const password     = document.getElementById('editEmpPassword').value;
    const role         = document.getElementById('editEmpRole').value;
    const status       = document.getElementById('editEmpStatus').checked;

    let microarea = null;
    if (role === 'ACS') {
        microarea = document.getElementById('editEmpMicroarea').value;
        if (!microarea) {
            showToast('Erro: A microárea é obrigatória para o cargo ACS.', 'error');
            return;
        }
    }

    // Ajustado para bater com seu EmployeeRequestDTO (name, cpf, registration, password, role, status)
    if (!rawName || !cpf || !role) {
        showToast('Erro: Nome, CPF e Cargo são obrigatórios.', 'error');
        return;
    }

    const nameValidation = validateEmployeeName(rawName);
    if (!nameValidation.valid) {
        showToast(`Erro: ${nameValidation.message}`, 'error');
        return;
    }
    const name = nameValidation.formattedName;

    // Validação de CPF
    if (!isValidCPF(cpf)) {
        showToast('Erro: O CPF informado é inválido.', 'error');
        return;
    }

    // Checar duplicatas (exceto o próprio)
    const normalizedCpf = cpf.replace(/\D/g, "");
    const duplicate = allEmployees.find(emp => {
        if (String(emp.id) === String(id)) return false;
        const empReg = (emp.registration || "").trim();
        const empCpf = (emp.cpf || "").replace(/\D/g, "");
        const regMatch = (registration !== "S/M") && (empReg === registration);
        return regMatch || (empCpf !== "" && empCpf === normalizedCpf);
    });

    if (duplicate) {
        const isReg = (duplicate.registration || "").trim() === registration;
        showToast(`Erro: Já existe outro funcionário com este ${isReg ? 'matrícula' : 'CPF'}.`, 'error');
        return;
    }

    const payload = { name, cpf: normalizedCpf, registration, role, status, microarea: microarea ? parseInt(microarea) : null };
    if (password && password.trim() !== "") {
        payload.password = password;
    }

    setLoading('btnUpdateEmployee', true);
    try {
        const response = await fetch(`${API_URL}/employees/${id}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            showToast(`Funcionário "${name}" atualizado com sucesso!`);
            window.dispatchEvent(new Event('employeesChanged'));
            closeEditModal();
            loadEmployees();
        } else {
            const err = await response.json().catch(() => ({}));
            showToast(err.message || 'Erro ao atualizar os dados.', 'error');
        }
    } catch (e) {
        showToast('Erro de conexão com o servidor.', 'error');
    } finally {
        setLoading('btnUpdateEmployee', false);
    }
}

// --- EXCLUIR FUNCIONÁRIO ---
function openDeleteConfirm(id, name) {
    if (!id || id === 'undefined' || id === 'null') {
        showToast('ID do funcionário inválido para exclusão.', 'error');
        return;
    }

    const modal = document.getElementById('deleteConfirmModal');
    const text  = document.getElementById('deleteConfirmText');
    const btn   = document.getElementById('btnConfirmDelete');

    text.textContent = `Tem certeza que deseja excluir o funcionário "${name}"? Esta ação é irreversível.`;
    btn.onclick = () => {
        closeDeleteConfirm();
        confirmDeleteEmployee(id, name);
    };
    modal.classList.add('active');
}

function closeDeleteConfirm() {
    const modal = document.getElementById('deleteConfirmModal');
    if (modal) modal.classList.remove('active');
}

async function confirmDeleteEmployee(id, name) {
    try {
        const response = await fetch(`${API_URL}/employees/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });

        if (response.ok || response.status === 204) {
            showToast(`Funcionário "${name}" excluído com sucesso.`);
            window.dispatchEvent(new Event('employeesChanged'));
            loadEmployees();
        } else {
            const errData = await response.json().catch(() => ({}));
            const msg = errData.message || 'Verifique se o funcionário não possui registros ativos (dispensações, etc).';
            showToast(`Erro ao excluir: ${msg}`, 'error');
        }
    } catch (e) {
        showToast('Erro de conexão ao tentar excluir.', 'error');
    }
}

// Mantém compatibilidade com chamadas diretas existentes
async function deleteEmployee(id, name) {
    openDeleteConfirm(id, name);
}

// Fechar modal de edição ao clicar diretamente no overlay
document.addEventListener('click', (e) => {
    const editModal = document.getElementById('editEmployeeModal');
    // Só fechar se o clique foi exatamente no overlay, não em filhos
    if (e.target === editModal) closeEditModal();
    // Fechar modal de exclusão ao clicar no overlay
    const deleteModal = document.getElementById('deleteConfirmModal');
    if (e.target === deleteModal) closeDeleteConfirm();
});

function toggleMicroareaField(prefix) {
    const role = document.getElementById(`${prefix}EmpRole`).value;
    const group = document.getElementById(`${prefix}EmpMicroareaGroup`);
    if (group) {
        if (role === 'ACS') {
            group.style.display = 'block';
        } else {
            group.style.display = 'none';
            const select = document.getElementById(`${prefix}EmpMicroarea`);
            if (select) select.value = '';
        }
    }
}

// Exportar globais
window.loadEmployees        = loadEmployees;
window.filterEmployeeTable  = filterEmployeeTable;
window.openEditModal        = openEditModal;
window.closeEditModal       = closeEditModal;
window.saveNewEmployee      = saveNewEmployee;
window.saveEmployeeEdit     = saveEmployeeEdit;
window.deleteEmployee       = deleteEmployee;
window.openDeleteConfirm    = openDeleteConfirm;
window.closeDeleteConfirm   = closeDeleteConfirm;
window.toggleMicroareaField = toggleMicroareaField;

window.closeDeleteConfirm   = closeDeleteConfirm;

// Atualizar automaticamente ao ouvir o evento
window.addEventListener('employeesChanged', () => {
    loadEmployees(employeeCurrentPage);
});

})();
