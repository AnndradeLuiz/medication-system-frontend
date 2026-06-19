(function () {
    let allpractitioners = [];
    let practitionerCurrentPage = 0;
    let practitionerTotalPages = 1;

    async function loadpractitioners(page = 0) {
        practitionerCurrentPage = page;
        setLoading('btnRefreshpractitioners', true);

        let pageSize = 20;

        try {
            const { data: pageData } = await window.apiClient.get(`/practitioners?page=${practitionerCurrentPage}&size=${pageSize}`);
            allpractitioners = pageData.content || [];

            const pageInfo = pageData.page || pageData;
            practitionerTotalPages = pageInfo.totalPages || 1;
            document.getElementById('practitionerCurrentPage').innerText = `Pág ${pageInfo.number + 1} de ${practitionerTotalPages}`;

            const startItem = pageInfo.totalElements === 0 ? 0 : (pageInfo.number * pageInfo.size) + 1;
            const endItem = Math.min((pageInfo.number + 1) * pageInfo.size, pageInfo.totalElements);
            document.getElementById('practitionerPageInfo').innerText = `${startItem}-${endItem} de ${pageInfo.totalElements}`;

            document.getElementById('btnPrevpractitioner').disabled = pageInfo.number === 0;
            document.getElementById('btnNextpractitioner').disabled = pageInfo.number >= (practitionerTotalPages - 1);

            renderpractitionerTable(allpractitioners);
        } catch (e) {
            console.error(e);
            document.getElementById('practitionerTableBody').innerHTML =
                '<tr><td colspan="5" class="empty-msg" style="color:#ef4444;">Erro ao carregar dados. Verifique a conexão com o servidor.</td></tr>';
        } finally {
            setLoading('btnRefreshpractitioners', false);
        }
    }

    window.prevpractitionerPage = function () {
        if (practitionerCurrentPage > 0) loadpractitioners(practitionerCurrentPage - 1);
    };

    window.nextpractitionerPage = function () {
        if (practitionerCurrentPage < practitionerTotalPages - 1) loadpractitioners(practitionerCurrentPage + 1);
    };

    function renderpractitionerTable(list) {
        const tbody = document.getElementById('practitionerTableBody');
        if (!tbody) return;
        tbody.innerHTML = '';

        if (!list || list.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="empty-msg">Nenhum funcionário encontrado.</td></tr>';
            return;
        }

        const loggedId = sessionStorage.getItem('sgdm_practitionerId');
        const fragment = document.createDocumentFragment();

        list.forEach(emp => {
            const rawId = emp.id || emp._id;
            const empId = typeof rawId === 'object' && rawId.$oid ? rawId.$oid : String(rawId);

            const isMe = String(empId) === String(loggedId);
            const badgeClass = `role-${emp.role}`;
            const roleLabel = window.ROLE_LABELS ? window.ROLE_LABELS[emp.role] || emp.role : emp.role;

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
            <td class="font-data text-muted text-center">${window.formatCPF(emp.cpf)}</td>
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

            const editBtn = tr.querySelector('.btn-edit-emp');
            if (editBtn) {
                editBtn.addEventListener('click', () => openEditModal(empId));
            }

            const deleteBtn = tr.querySelector('.btn-delete-emp');
            if (deleteBtn) {
                deleteBtn.addEventListener('click', () => deletepractitioner(empId, emp.name));
            }

            fragment.appendChild(tr);
        });

        tbody.appendChild(fragment);
    }


    function filterpractitionerTable() {
        const q = document.getElementById('searchpractitionerInput').value.toLowerCase();
        const filtered = allpractitioners.filter(e =>
            (e.name && e.name.toLowerCase().includes(q)) ||
            (e.registration && e.registration.toLowerCase().includes(q)) ||
            (e.cpf && e.cpf.toLowerCase().includes(q))
        );
        renderpractitionerTable(filtered);
    }

    // A validação de nome agora é herdada centralizadamente de window.validateFullName

    async function saveNewpractitioner() {
        const rawName = document.getElementById('newEmpName').value;
        let registration = document.getElementById('newEmpRegistration').value.trim();
        if (!registration) registration = "S/M";
        const cpf = document.getElementById('newEmpCpf').value.trim();
        const password = document.getElementById('newEmpPassword').value;
        const role = document.getElementById('newEmpRole').value;
        const status = true; // Novos funcionários sempre ativos por padrão

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

        const nameValidation = window.validateFullName(rawName);
        if (!nameValidation.valid) {
            showToast(`Erro: ${nameValidation.message}`, 'error');
            return;
        }
        const name = nameValidation.formattedName;

        if (!window.isValidCPF(cpf)) {
            showToast('Erro: O CPF informado é inválido.', 'error');
            return;
        }

        const normalizedCpf = cpf.replace(/\D/g, "");

        const payload = { name, registration, cpf: normalizedCpf, password, role, status, microarea: microarea ? parseInt(microarea) : null };

        setLoading('btnSaveNewpractitioner', true);
        try {
            await window.apiClient.post('/practitioners', payload);
            showToast(`Funcionário "${name}" cadastrado com sucesso!`);
            window.dispatchEvent(new Event('practitionersChanged'));
            document.getElementById('newEmpName').value = '';
            document.getElementById('newEmpRegistration').value = '';
            document.getElementById('newEmpCpf').value = '';
            document.getElementById('newEmpPassword').value = '';
            document.getElementById('newEmpRole').value = 'TEC_ENFERMAGEM';
            document.getElementById('newEmpMicroareaGroup').style.display = 'none';
            document.getElementById('newEmpMicroarea').value = '';
            loadpractitioners();
            const tabs = document.querySelectorAll('#view-practitioner .tabs-container .tab');
            if (tabs.length > 0) {
                switchTab('tab-list-practitioner', tabs[0]);
            }
        } catch (e) {
            showToast(e.message || 'Erro ao cadastrar funcionário.', 'error');
        } finally {
            setLoading('btnSaveNewpractitioner', false);
        }
    }

    function openEditModal(id) {
        const emp = allpractitioners.find(e => String(e.id || e._id) === String(id));
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

        document.getElementById('editpractitionerModal').classList.add('active');
    }

    function closeEditModal() {
        document.getElementById('editpractitionerModal').classList.remove('active');
    }

    async function savepractitionerEdit() {
        const id = document.getElementById('editEmpId').value;
        const rawName = document.getElementById('editEmpName').value;
        let registration = document.getElementById('editEmpRegistration').value.trim();
        if (!registration) registration = "S/M";
        const cpf = document.getElementById('editEmpCpf').value.trim();
        const password = document.getElementById('editEmpPassword').value;
        const role = document.getElementById('editEmpRole').value;
        const status = document.getElementById('editEmpStatus').checked;

        let microarea = null;
        if (role === 'ACS') {
            microarea = document.getElementById('editEmpMicroarea').value;
            if (!microarea) {
                showToast('Erro: A microárea é obrigatória para o cargo ACS.', 'error');
                return;
            }
        }

        if (!rawName || !cpf || !role) {
            showToast('Erro: Nome, CPF e Cargo são obrigatórios.', 'error');
            return;
        }

        const nameValidation = window.validateFullName(rawName);
        if (!nameValidation.valid) {
            showToast(`Erro: ${nameValidation.message}`, 'error');
            return;
        }
        const name = nameValidation.formattedName;

        if (!window.isValidCPF(cpf)) {
            showToast('Erro: O CPF informado é inválido.', 'error');
            return;
        }

        const normalizedCpf = cpf.replace(/\D/g, "");

        const payload = { name, cpf: normalizedCpf, registration, role, status, microarea: microarea ? parseInt(microarea) : null };
        if (password && password.trim() !== "") {
            payload.password = password;
        }

        setLoading('btnUpdatepractitioner', true);
        try {
            await window.apiClient.put(`/practitioners/${id}`, payload);
            showToast(`Funcionário "${name}" atualizado com sucesso!`);
            window.dispatchEvent(new Event('practitionersChanged'));
            closeEditModal();
            loadpractitioners();
        } catch (e) {
            showToast(e.message || 'Erro ao atualizar os dados.', 'error');
        } finally {
            setLoading('btnUpdatepractitioner', false);
        }
    }

    function openDeleteConfirm(id, name) {
        if (!id || id === 'undefined' || id === 'null') {
            showToast('ID do funcionário inválido para exclusão.', 'error');
            return;
        }

        const modal = document.getElementById('deleteConfirmModal');
        const text = document.getElementById('deleteConfirmText');
        const btn = document.getElementById('btnConfirmDelete');

        text.textContent = `Tem certeza que deseja excluir o funcionário "${name}"? Esta ação é irreversível.`;
        btn.onclick = () => {
            closeDeleteConfirm();
            confirmDeletepractitioner(id, name);
        };
        modal.classList.add('active');
    }

    function closeDeleteConfirm() {
        const modal = document.getElementById('deleteConfirmModal');
        if (modal) modal.classList.remove('active');
    }

    async function confirmDeletepractitioner(id, name) {
        try {
            await window.apiClient.delete(`/practitioners/${id}`);
            showToast(`Funcionário "${name}" excluído com sucesso.`);
            window.dispatchEvent(new Event('practitionersChanged'));
            loadpractitioners();
        } catch (e) {
            const msg = e.message || 'Verifique se o funcionário não possui registros ativos (dispensações, etc).';
            showToast(`Erro ao excluir: ${msg}`, 'error');
        }
    }

    async function deletepractitioner(id, name) {
        openDeleteConfirm(id, name);
    }
    document.addEventListener('click', (e) => {
        const editModal = document.getElementById('editpractitionerModal');
        if (e.target === editModal) closeEditModal();
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
    window.loadpractitioners = loadpractitioners;
    window.filterpractitionerTable = filterpractitionerTable;
    window.openEditModal = openEditModal;
    window.closeEditModal = closeEditModal;
    window.saveNewpractitioner = saveNewpractitioner;
    window.savepractitionerEdit = savepractitionerEdit;
    window.deletepractitioner = deletepractitioner;
    window.openDeleteConfirm = openDeleteConfirm;
    window.closeDeleteConfirm = closeDeleteConfirm;
    window.toggleMicroareaField = toggleMicroareaField;

    window.closeDeleteConfirm = closeDeleteConfirm;

    window.addEventListener('practitionersChanged', () => {
        loadpractitioners(practitionerCurrentPage);
    });

})();

