(function () {
    let currentPatients = []; // Guarda os pacientes carregados
    let currentPatientPrograms = [];
    let currentEditPatientPrograms = [];
    let medicationList = [];
    let acsList = []; // Guarda os ACS carregados
    let patientCurrentPage = 0;
    let patientTotalPages = 1;

    // carregar ACS
    async function loadAcsList() {
        try {
            const response = await fetch(`${API_URL}/employees?size=1000`, {
                headers: getAuthHeaders()
            });
            if (response.ok) {
                const pageData = await response.json();
                const employees = pageData.content || [];
                acsList = employees.filter(emp => emp.status && emp.role === 'ACS');
                populateAcsDropdowns();
            }
        } catch (error) {
            console.error("Erro ao carregar lista de ACS:", error);
        }
    }

    function populateAcsDropdowns() {
        const newSelect = document.getElementById('newPatientAcs');
        const editSelect = document.getElementById('editPatientAcs');
        if (newSelect) {
            newSelect.innerHTML = '<option value="">Selecione o ACS...</option>';
            acsList.forEach(acs => {
                const opt = document.createElement('option');
                opt.value = acs.id;
                opt.textContent = acs.name;
                newSelect.appendChild(opt);
            });
        }
        if (editSelect) {
            editSelect.innerHTML = '<option value="">Selecione o ACS...</option>';
            acsList.forEach(acs => {
                const opt = document.createElement('option');
                opt.value = acs.id;
                opt.textContent = acs.name;
                editSelect.appendChild(opt);
            });
        }
    }

    // carregar medicamentos
    async function loadMedications() {
        try {
            const response = await fetch(`${API_URL}/medications`, {
                headers: getAuthHeaders()
            });
            if (response.ok) {
                medicationList = await response.json();
            }
        } catch (error) {
            console.error("Erro ao carregar medicamentos:", error);
        }
    }

    function setupMedicationAutocomplete(inputId, listId, idField, nameField, concentrationField) {
        const inputEl = document.getElementById(inputId);
        const listEl = document.getElementById(listId);
        if (!inputEl || !listEl) return;

        inputEl.addEventListener('input', function (e) {
            const query = e.target.value.toLowerCase();
            if (query.length < 2) {
                listEl.classList.add('d-none');
                listEl.style.display = 'none';
                return;
            }

            const categoryId = inputId === 'builderMedSearch' ? 'builderCategory' : 'editBuilderCategory';
            const selectedCategory = document.getElementById(categoryId).value;

            const filtered = medicationList.filter(m =>
                m.activeIngredient && m.activeIngredient.toLowerCase().includes(query) &&
                (!selectedCategory || (m.programCategories && m.programCategories.includes(selectedCategory)))
            );

            listEl.innerHTML = '';
            if (filtered.length === 0) {
                listEl.innerHTML = '<li style="padding: 10px 15px; color: #ef4444; font-size: 14px;">Medicamento não encontrado.</li>';
            } else {
                filtered.forEach(m => {
                    const li = document.createElement('li');
                    li.style.cssText = 'padding: 10px 15px; border-bottom: 1px solid #f3f4f6; cursor: pointer; transition: background 0.2s;';
                    li.innerHTML = `<span style="font-weight: 600; color: #1f2937;">${m.activeIngredient}</span> <span style="font-size: 13px; color: #6b7280;">(${m.concentration})</span>`;

                    li.onmouseover = () => li.style.backgroundColor = '#e0e7ff';
                    li.onmouseout = () => li.style.backgroundColor = 'transparent';

                    li.onclick = () => {
                        inputEl.value = `${m.activeIngredient} (${m.concentration})`;
                        document.getElementById(idField).value = m.id;
                        document.getElementById(nameField).value = m.activeIngredient;
                        document.getElementById(concentrationField).value = m.concentration;
                        listEl.classList.add('d-none');
                        listEl.style.display = 'none';
                    };
                    listEl.appendChild(li);
                });
            }
            listEl.classList.remove('d-none');
            listEl.style.display = 'block';
        });

        document.addEventListener('click', function (e) {
            if (e.target.id !== inputId) {
                listEl.classList.add('d-none');
                listEl.style.display = 'none';
            }
        });
    }

    function addProgramToBuilder() {
        const category = document.getElementById('builderCategory').value;
        const medId = document.getElementById('builderMedId').value;
        const medName = document.getElementById('builderMedName').value;
        const medConcentration = document.getElementById('builderMedConcentration').value;
        const quantity = parseInt(document.getElementById('builderQuantity').value);

        if (!category) {
            showToast("Selecione um programa.");
            return;
        }

        if (!medId || isNaN(quantity) || quantity <= 0) {
            showToast("Selecione um medicamento e informe uma quantidade válida maior que zero.");
            return;
        }

        if (currentPatientPrograms.some(p => p.medicationId === medId)) {
            showToast("Este medicamento já foi adicionado para este paciente.");
            return;
        }

        currentPatientPrograms.push({
            category: category,
            medicationId: medId,
            medicationName: medName,
            concentration: medConcentration,
            quantity: quantity
        });

        document.getElementById('builderCategory').value = '';
        document.getElementById('builderMedSearch').value = '';
        document.getElementById('builderMedId').value = '';
        document.getElementById('builderMedName').value = '';
        document.getElementById('builderMedConcentration').value = '';
        document.getElementById('builderQuantity').value = '';

        renderBuilderPrograms();
    }

    function removeProgramFromBuilder(index) {
        currentPatientPrograms.splice(index, 1);
        renderBuilderPrograms();
    }

    function renderBuilderPrograms() {
        const listEl = document.getElementById('patientProgramsList');
        listEl.innerHTML = '';

        if (currentPatientPrograms.length === 0) {
            listEl.innerHTML = '<div style="text-align: center; color: #6b7280; font-size: 14px; padding: 10px; border: 1px dashed #d1d5db; border-radius: 6px;">Nenhum programa adicionado.</div>';
            return;
        }

        const fragment = document.createDocumentFragment();

        currentPatientPrograms.forEach((prog, index) => {
            const labels = {
                "DIABETES": "Diabetes",
                "HIPERTENSAO": "Hipertensão",
                "FARMACIA_BASICA": "Farmácia Básica",
                "SAUDE_DA_MULHER": "Saúde da Mulher",
                "SAUDE_MENTAL": "Saúde Mental"
            };
            const catName = labels[prog.category] || prog.category;

            const div = document.createElement('div');
            div.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 12px 15px; background: white; border: 1px solid #e5e7eb; border-radius: 6px; box-shadow: 0 1px 2px rgba(0,0,0,0.05); margin-bottom: 8px;';
            div.innerHTML = `
            <div>
                <div style="font-weight: 600; color: #111827; font-size: 14px;">${catName}</div>
                <div style="font-size: 13px; color: #4b5563; margin-top: 4px;">
                    <i class="fa-solid fa-pills" style="color: #0f766e; margin-right: 4px;"></i> ${prog.medicationName} (${prog.concentration}) - <b style="color: #ea580c;">${prog.quantity} un</b>
                </div>
            </div>
            <button type="button" onclick="removeProgramFromBuilder(${index})" style="background: none; border: none; color: #ef4444; cursor: pointer; padding: 5px;">
                <i class="fa-solid fa-trash"></i>
            </button>
        `;
            fragment.appendChild(div);
        });

        listEl.appendChild(fragment);
    }

    function addProgramToEditBuilder() {
        const category = document.getElementById('editBuilderCategory').value;
        const medId = document.getElementById('editBuilderMedId').value;
        const medName = document.getElementById('editBuilderMedName').value;
        const medConcentration = document.getElementById('editBuilderMedConcentration').value;
        const quantity = parseInt(document.getElementById('editBuilderQuantity').value);

        if (!category) {
            showToast("Selecione um programa.");
            return;
        }

        if (!medId || isNaN(quantity) || quantity <= 0) {
            showToast("Selecione um medicamento e informe uma quantidade válida maior que zero.");
            return;
        }

        if (currentEditPatientPrograms.some(p => p.medicationId === medId)) {
            showToast("Este medicamento já foi adicionado para este paciente.");
            return;
        }

        currentEditPatientPrograms.push({
            category: category,
            medicationId: medId,
            medicationName: medName,
            concentration: medConcentration,
            quantity: quantity
        });

        document.getElementById('editBuilderCategory').value = '';
        document.getElementById('editBuilderMedSearch').value = '';
        document.getElementById('editBuilderMedId').value = '';
        document.getElementById('editBuilderMedName').value = '';
        document.getElementById('editBuilderMedConcentration').value = '';
        document.getElementById('editBuilderQuantity').value = '';

        renderEditBuilderPrograms();
    }

    function removeProgramFromEditBuilder(index) {
        currentEditPatientPrograms.splice(index, 1);
        renderEditBuilderPrograms();
    }

    function renderEditBuilderPrograms() {
        const listEl = document.getElementById('editPatientProgramsList');
        listEl.innerHTML = '';

        if (currentEditPatientPrograms.length === 0) {
            listEl.innerHTML = '<div style="text-align: center; color: #6b7280; font-size: 14px; padding: 10px; border: 1px dashed #d1d5db; border-radius: 6px;">Nenhum programa adicionado.</div>';
            return;
        }

        const fragment = document.createDocumentFragment();

        currentEditPatientPrograms.forEach((prog, index) => {
            const labels = {
                "DIABETES": "Diabetes",
                "HIPERTENSAO": "Hipertensão",
                "SAUDE_DA_MULHER": "Saúde da Mulher",
                "SAUDE_MENTAL": "Saúde Mental"
            };
            const catName = labels[prog.category] || prog.category;

            const div = document.createElement('div');
            div.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 12px 15px; background: white; border: 1px solid #e5e7eb; border-radius: 6px; box-shadow: 0 1px 2px rgba(0,0,0,0.05); margin-bottom: 8px;';
            div.innerHTML = `
            <div>
                <div style="font-weight: 600; color: #111827; font-size: 14px;">${catName}</div>
                <div style="font-size: 13px; color: #4b5563; margin-top: 4px;">
                    <i class="fa-solid fa-pills" style="color: #0f766e; margin-right: 4px;"></i> ${prog.medicationName} (${prog.concentration}) - <b style="color: #ea580c;">${prog.quantity} un</b>
                </div>
            </div>
            <button type="button" onclick="removeProgramFromEditBuilder(${index})" style="background: none; border: none; color: #ef4444; cursor: pointer; padding: 5px;">
                <i class="fa-solid fa-trash"></i>
            </button>
        `;
            fragment.appendChild(div);
        });

        listEl.appendChild(fragment);
    }

    function updateBuilderOptions(selectId, checkboxPrefix) {
        const selectEl = document.getElementById(selectId);
        const checkboxes = document.querySelectorAll(`input[id^="${checkboxPrefix}"]`);
        const selected = Array.from(checkboxes).filter(cb => cb.checked).map(cb => cb.value);

        const labels = {
            "DIABETES": "Diabetes",
            "HIPERTENSAO": "Hipertensão",
            "FARMACIA_BASICA": "Farmácia Básica",
            "SAUDE_DA_MULHER": "Saúde da Mulher",
            "SAUDE_MENTAL": "Saúde Mental"
        };

        const currentValue = selectEl.value;

        // Farmácia Básica não é mais injetada automaticamente, 
        // deve ser selecionada no grid ou pelo backend

        selectEl.innerHTML = '<option value="">Selecione o programa...</option>';

        selected.forEach(val => {
            const opt = document.createElement('option');
            opt.value = val;
            opt.innerText = labels[val] || val;
            selectEl.appendChild(opt);
        });

        if (selected.includes(currentValue)) {
            selectEl.value = currentValue;
        }
    }

    // --- FUNÇÕES DE SEGURANÇA E UTILIDADE ---
    function clearNewPatientForm() {
        document.getElementById('newName').value = '';
        document.getElementById('newCpf').value = '';
        document.getElementById('newCns').value = '';
        document.getElementById('newBirthDate').value = '';
        document.getElementById('newPhone1').value = '';
        document.getElementById('newPhone2').value = '';
        document.getElementById('newPhone3').value = '';
        document.getElementById('newPhone4').value = '';
        document.getElementById('newIsExternal').checked = false;

        const newSelect = document.getElementById('newPatientAcs');
        if (newSelect) newSelect.value = '';
        const newMicro = document.getElementById('newPatientMicroarea');
        if (newMicro) newMicro.value = '';

        const acsContainer = document.getElementById('newPatientAcsContainer');
        if (acsContainer) acsContainer.style.display = 'flex';

        // Limpa os programas selecionados (checkboxes)
        document.querySelectorAll('input[id^="regProg"]').forEach(cb => cb.checked = false);
        updateBuilderOptions('builderCategory', 'regProg');

        // Limpa os medicamentos do builder
        currentPatientPrograms = [];
        renderBuilderPrograms();

        // Garante que a seção de programas volte a aparecer para o próximo cadastro
        const secaoProgramas = document.getElementById('secaoProgramasCadastro');
        if (secaoProgramas) secaoProgramas.style.display = 'block';
    }

    // --- ESCONDER/MOSTRAR PROGRAMAS NO CADASTRO (Estava faltando!) ---
    function toggleProgramasCadastro() {
        const isExternal = document.getElementById('newIsExternal').checked;
        const secaoProgramas = document.getElementById('secaoProgramasCadastro');
        const acsContainer = document.getElementById('newPatientAcsContainer');

        if (acsContainer) {
            acsContainer.style.display = isExternal ? 'none' : 'flex';
            if (isExternal) {
                const selectEl = document.getElementById('newPatientAcs');
                if (selectEl) selectEl.value = '';
                const microareaInput = document.getElementById('newPatientMicroarea');
                if (microareaInput) microareaInput.value = '';
            }
        }

        if (!secaoProgramas) return;

        if (isExternal) {
            // Esconde a área
            secaoProgramas.style.display = 'none';

            // Desmarca tudo se for marcado como externo
            currentPatientPrograms = [];
            renderBuilderPrograms();
        } else {
            // Mostra a área novamente
            secaoProgramas.style.display = 'block';
        }
    }

    // --- ESCONDER/MOSTRAR PROGRAMAS NA EDIÇÃO ---
    function toggleProgramasEdit() {
        const isExternal = document.getElementById('editExternal').checked;
        const secaoProgramas = document.getElementById('secaoProgramasEdit');
        const acsContainer = document.getElementById('editPatientAcsContainer');

        if (acsContainer) {
            acsContainer.style.display = isExternal ? 'none' : 'flex';
            if (isExternal) {
                const selectEl = document.getElementById('editPatientAcs');
                if (selectEl) selectEl.value = '';
                const microareaInput = document.getElementById('editPatientMicroarea');
                if (microareaInput) microareaInput.value = '';
            }
        }

        if (!secaoProgramas) return;

        if (isExternal) {
            secaoProgramas.style.display = 'none';

            currentEditPatientPrograms = [];
            renderEditBuilderPrograms();
        } else {
            secaoProgramas.style.display = 'block';
        }
    }

    async function saveNewPatient() {
        // 1. Captura os valores
        let nomeInput = document.getElementById('newName').value.trim();
        if (nomeInput) {
            nomeInput = nomeInput.toLowerCase().replace(/(?:^|\s)\S/g, a => a.toUpperCase());
        }
        const cpfInput = document.getElementById('newCpf').value.trim();
        const cnsInput = document.getElementById('newCns').value.trim();
        const birthDateInput = document.getElementById('newBirthDate').value;
        const isExternalInput = document.getElementById('newIsExternal').checked;

        // --- VALIDAÇÕES DE FRONT-END ---
        const errors = [];

        // 1. Validação avançada de Nome Completo
        const nameValidation = validatePatientName(nomeInput);
        if (!nameValidation.valid) {
            errors.push({ message: nameValidation.message, type: 'warning' });
        } else {
            nomeInput = nameValidation.formattedName;
        }

        // 2. Documentos (Pelo menos um e validar se preenchido)
        if (!cpfInput && !cnsInput) {
            errors.push({ message: "É obrigatório informar pelo menos um documento (CPF ou CNS).", type: 'warning' });
        } else {
            if (cpfInput && !isValidCPF(cpfInput)) {
                errors.push({ message: "O CPF informado é inválido. Por favor, verifique os números.", type: 'error' });
            }
            if (cnsInput && !isValidCNS(cnsInput)) {
                errors.push({ message: "O CNS (Cartão SUS) informado é inválido. Por favor, verifique os números.", type: 'error' });
            }
        }

        // 3. Data de Nascimento
        if (!birthDateInput) {
            errors.push({ message: "A data de nascimento é obrigatória.", type: 'warning' });
        } else {
            const dataNascimento = new Date(birthDateInput + 'T00:00:00');
            const hoje = new Date();
            hoje.setHours(0, 0, 0, 0);

            if (dataNascimento > hoje) {
                errors.push({ message: "Data de nascimento inválida! O paciente ainda não nasceu? Selecione uma data no passado.", type: 'error' });
            }
        }

        // Se houver erros, exibe todos e interrompe
        if (errors.length > 0) {
            errors.forEach(err => showToast(err.message, err.type));
            return;
        }

        const p1 = document.getElementById('newPhone1').value.trim();
        const p2 = document.getElementById('newPhone2').value.trim();
        const p3 = document.getElementById('newPhone3').value.trim();
        const p4 = document.getElementById('newPhone4').value.trim();

        if (!p1) {
            showToast("O Telefone 1 é obrigatório.", "warning");
            return;
        }

        const phonesList = [p1, p2, p3, p4]
            .map(n => n.replace(/\D/g, ''))
            .filter(n => n.length > 0);

        const enrollments = [];
        if (!isExternalInput) {
            document.querySelectorAll('input[id^="regProg"]:checked').forEach(cb => {
                const category = cb.value;
                const medications = currentPatientPrograms
                    .filter(p => p.category === category)
                    .map(p => ({
                        medicationId: p.medicationId,
                        medicationName: p.medicationName,
                        concentration: p.concentration,
                        quantity: p.quantity
                    }));
                
                enrollments.push({
                    category: category,
                    medications: medications
                });
            });
        }

        const payload = {
            name: nomeInput,
            cpf: cpfInput.trim() === "" ? null : cpfInput.replace(/\D/g, ''),
            cns: cnsInput.trim() === "" ? null : cnsInput.replace(/\D/g, ''),
            birthDate: new Date(birthDateInput + 'T00:00:00').toISOString(),
            external: isExternalInput,
            phones: phonesList,
            enrollments: enrollments,
            acsId: isExternalInput ? null : (document.getElementById('newPatientAcs').value || null)
        };

        setLoading('btnSaveNewPatient', true);
        try {
            const response = await fetch(`${API_URL}/patients`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                showToast('Paciente cadastrado com sucesso!');
                window.dispatchEvent(new Event('patientsChanged'));
                clearNewPatientForm();

                const tabs = document.querySelectorAll('.tab');
                if (tabs.length > 0) {
                    switchTab('tab-busca', tabs[0]);
                }
                searchPatients();
            } else if (response.status === 422) {
                try {
                    const errorData = await response.json();
                    if (errorData.errors && errorData.errors.length > 0) {
                        // Mostra apenas o primeiro erro para não poluir
                        showToast(errorData.errors[0].message, 'error');
                    } else {
                        showToast(errorData.message || 'Existem campos inválidos no formulário.', 'error');
                    }
                } catch (e) {
                    showToast('Erro de validação no servidor.', 'error');
                }
            } else {
                try {
                    const errorData = await response.json();
                    showToast(errorData.message || 'Erro ao cadastrar. Verifique se o CPF ou CNS já estão cadastrados no sistema.', 'error');
                } catch (e) {
                    showToast('Erro ao cadastrar. Verifique se o CPF ou CNS já estão cadastrados no sistema.', 'error');
                }
            }
        } catch (error) {
            showToast('Erro de conexão com o servidor.', 'error');
        } finally {
            setLoading('btnSaveNewPatient', false);
        }
    }

    // --- INICIALIZAÇÃO DA PÁGINA ---
    let isPatientModuleInitialized = false;
    window.initPatientModule = function () {
        loadMedications();
        loadAcsList();
        if (isPatientModuleInitialized) return;
        isPatientModuleInitialized = true;

        // Listeners para atualização de microárea do ACS
        const newSelect = document.getElementById('newPatientAcs');
        if (newSelect) {
            newSelect.addEventListener('change', function() {
                const selectedAcs = acsList.find(acs => acs.id === this.value);
                const microareaInput = document.getElementById('newPatientMicroarea');
                if (microareaInput) {
                    microareaInput.value = selectedAcs ? `Microárea ${selectedAcs.microarea}` : '';
                }
            });
        }

        const editSelect = document.getElementById('editPatientAcs');
        if (editSelect) {
            editSelect.addEventListener('change', function() {
                const selectedAcs = acsList.find(acs => acs.id === this.value);
                const microareaInput = document.getElementById('editPatientMicroarea');
                if (microareaInput) {
                    microareaInput.value = selectedAcs ? `Microárea ${selectedAcs.microarea}` : '';
                }
            });
        }

        setupMedicationAutocomplete('builderMedSearch', 'builderMedSuggestions', 'builderMedId', 'builderMedName', 'builderMedConcentration');
        setupMedicationAutocomplete('editBuilderMedSearch', 'editBuilderMedSuggestions', 'editBuilderMedId', 'editBuilderMedName', 'editBuilderMedConcentration');

        renderInitialTable();

        // LER A URL E ABRIR A ABA CERTA
        if (window.location.hash === '#cadastro') {
            const tabs = document.querySelectorAll('#view-patient .tab');
            if (tabs.length > 1) {
                if (typeof window.switchTab === 'function') {
                    window.switchTab('tab-cadastro', tabs[1]);
                }
                history.replaceState(null, null, ' ');
            }
        }

        const newCpfEl = document.getElementById('newCpf');
        if (newCpfEl) newCpfEl.addEventListener('input', e => e.target.value = applyCpfMask(e.target.value));

        const newCnsEl = document.getElementById('newCns');
        if (newCnsEl) newCnsEl.addEventListener('input', e => e.target.value = applyCnsMask(e.target.value));

        const editCpfEl = document.getElementById('editCpf');
        if (editCpfEl) editCpfEl.addEventListener('input', e => e.target.value = applyCpfMask(e.target.value));

        const editCnsEl = document.getElementById('editCns');
        if (editCnsEl) editCnsEl.addEventListener('input', e => e.target.value = applyCnsMask(e.target.value));

        for (let i = 1; i <= 4; i++) {
            const newPhoneEl = document.getElementById(`newPhone${i}`);
            if (newPhoneEl) {
                newPhoneEl.addEventListener('input', e => {
                    e.target.value = applySinglePhoneMask(e.target.value);
                });
            }
            const editPhoneEl = document.getElementById(`editPhone${i}`);
            if (editPhoneEl) {
                editPhoneEl.addEventListener('input', e => {
                    e.target.value = applySinglePhoneMask(e.target.value);
                });
            }
        }

        // Limitar data de nascimento até o dia atual
        const today = new Date().toISOString().split('T')[0];
        const newBirthDateEl = document.getElementById('newBirthDate');
        const editBirthDateEl = document.getElementById('editBirthDate');
        if (newBirthDateEl) newBirthDateEl.setAttribute('max', today);
        if (editBirthDateEl) editBirthDateEl.setAttribute('max', today);
    };

    async function searchPatients(page = 0) {
        patientCurrentPage = page;
        const searchInput = document.getElementById('searchInput');
        const statusFilter = document.getElementById('statusFilter');
        const programFilter = document.getElementById('programFilter');

        const rawQuery = searchInput ? searchInput.value.trim() : '';
        const cleanQuery = /^[\d.\-]+$/.test(rawQuery) ? rawQuery.replace(/\D/g, '') : rawQuery;

        const statusFiltro = statusFilter ? statusFilter.value : '';
        const programFiltro = programFilter && programFilter.value !== 'todos' ? programFilter.value : '';
        let pageSize = document.getElementById('pageSize') ? document.getElementById('pageSize').value : '20';
        if (pageSize === 'all') pageSize = 1000;

        const tbody = document.getElementById('patientsTableBody');
        if (!tbody) return;

        tbody.innerHTML = '<tr><td colspan="5" class="empty-msg"><i class="fa-solid fa-spinner fa-spin"></i> A pesquisar...</td></tr>';

        setLoading('btnSearchPatients', true);
        try {
            const response = await fetch(`${API_URL}/patients?query=${encodeURIComponent(cleanQuery)}&status=${statusFiltro}&program=${encodeURIComponent(programFiltro)}&page=${patientCurrentPage}&size=${pageSize}`, {
                headers: getAuthHeaders(),
                cache: 'no-store'
            });

            if (response.ok) {
                const pageData = await response.json();
                currentPatients = pageData.content || [];

                // Update pagination UI
                const pageInfo = pageData.page || pageData;
                patientTotalPages = pageInfo.totalPages || 1;
                document.getElementById('patientCurrentPage').innerText = `Pág ${pageInfo.number + 1} de ${patientTotalPages}`;

                const startItem = pageInfo.totalElements === 0 ? 0 : (pageInfo.number * pageInfo.size) + 1;
                const endItem = Math.min((pageInfo.number + 1) * pageInfo.size, pageInfo.totalElements);
                document.getElementById('patientPageInfo').innerText = `${startItem}-${endItem} de ${pageInfo.totalElements}`;

                document.getElementById('btnPrevPatient').disabled = pageInfo.number === 0;
                document.getElementById('btnNextPatient').disabled = pageInfo.number >= (patientTotalPages - 1);

                renderPatientTable();
            } else {
                tbody.innerHTML = '<tr><td colspan="5" class="empty-msg" style="color: red;">Erro ao buscar pacientes.</td></tr>';
            }
        } catch (error) {
            console.error("API off, erro na requisição.", error);
            tbody.innerHTML = '<tr><td colspan="5" class="empty-msg" style="color: red;">Erro de conexão com o servidor.</td></tr>';
        } finally {
            setLoading('btnSearchPatients', false);
        }
    }

    window.prevPatientPage = function () {
        if (patientCurrentPage > 0) searchPatients(patientCurrentPage - 1);
    };

    window.nextPatientPage = function () {
        if (patientCurrentPage < patientTotalPages - 1) searchPatients(patientCurrentPage + 1);
    };

    // Funções de autocomplete dinâmico removidas (usando fetchFloatingSuggestions no final do arquivo)

    function renderInitialTable() {
        const tbody = document.getElementById('patientsTableBody');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="5" class="empty-msg">Utilize a barra de pesquisa ou os filtros acima para listar os pacientes.</td></tr>';
        }
    }

    function renderPatientTable() {
        const tbody = document.getElementById('patientsTableBody');
        if (!tbody) return;

        const pageSize = document.getElementById('pageSize') ? document.getElementById('pageSize').value : 'all';
        tbody.innerHTML = '';

        if (!currentPatients || currentPatients.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="empty-msg">Nenhum paciente encontrado.</td></tr>';
            return;
        }

        let displayList = currentPatients;

        const fragment = document.createDocumentFragment();

        displayList.forEach(p => {
            let statusHtml = p.status
                ? '<span class="status-badge badge-active"><i class="fa-solid fa-check"></i> Ativo</span>'
                : '<span class="status-badge badge-inactive"><i class="fa-solid fa-xmark"></i> Inativo</span>';

            let vinculoHtml = p.external
                ? '<span class="status-badge badge-external"><i class="fa-solid fa-map-location-dot"></i> Externo</span>'
                : '<span class="status-badge badge-local"><i class="fa-solid fa-house-medical"></i> UBS Local</span>';

            let cpfFormatado = p.cpf ? applyCpfMask(p.cpf) : '-';
            let cnsFormatado = p.cns ? applyCnsMask(p.cns) : '-';

            const tr = document.createElement('tr');
            tr.style.cursor = 'pointer';
            tr.onclick = () => openPatientModal(String(p.id));
            tr.innerHTML = `
            <td>
                <div style="display: flex; align-items: center; gap: 12px;">
                    <div style="width: 32px; height: 32px; border-radius: 50%; background: var(--color-bg); display: flex; align-items: center; justify-content: center; color: var(--color-primary);">
                        <i class="fa-solid fa-user"></i>
                    </div>
                    <span style="font-weight: 600; color: var(--color-text-main);">${escapeHTML(p.name)}</span>
                </div>
            </td>
            <td class="text-center" style="font-family: var(--font-data); font-size: 13px;">${escapeHTML(cpfFormatado)}</td>
            <td class="text-center" style="font-family: var(--font-data); font-size: 13px;">${escapeHTML(cnsFormatado)}</td>
            <td class="text-center">${statusHtml}</td>
            <td class="text-center">${vinculoHtml}</td>
        `;
            fragment.appendChild(tr);
        });
        tbody.appendChild(fragment);
    }

    function openPatientModal(id) {
        // Busca o paciente no array carregado na tabela
        const patient = currentPatients.find(p => String(p.id) === String(id));
        if (!patient) return;

        // Converte a nova estrutura hierárquica (enrollments) para o formato plano esperado pela interface
        if (patient.enrollments) {
            patient.programCategories = patient.enrollments.map(e => e.category);
            patient.programs = [];
            patient.enrollments.forEach(e => {
                if (e.medications) {
                    e.medications.forEach(m => {
                        patient.programs.push({
                            category: e.category,
                            medicationId: m.medicationId,
                            medicationName: m.medicationName,
                            concentration: m.concentration,
                            quantity: m.quantity
                        });
                    });
                }
            });
        }

        // Preenchimento dos dados básicos
        document.getElementById('viewName').innerText = patient.name;
        document.getElementById('viewCpf').innerText = patient.cpf ? applyCpfMask(patient.cpf) : '-';

        // CORREÇÃO 1: Atribuição do CNS que estava solta
        document.getElementById('viewCns').innerText = patient.cns ? applyCnsMask(patient.cns) : '-';

        let birthDateFormatted = 'Não informada';
        if (patient.birthDate) {
            const dateObj = new Date(patient.birthDate);
            // Usamos UTC para evitar que o fuso horário mude o dia do nascimento
            birthDateFormatted = dateObj.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
        }
        document.getElementById('viewBirthDate').innerText = birthDateFormatted;
        const patientAge = formatPatientAge(patient.birthDate);
        document.getElementById('viewAge').innerText = patientAge;
        document.getElementById('modalTitle').innerHTML = `<i class="fa-solid fa-id-card"></i> Prontuário do Paciente — ${escapeHTML(patient.name)} (${patientAge})`;

        document.getElementById('viewStatus').innerHTML = patient.status
            ? '<span style="color: #10b981; font-weight: 600;">Ativo</span>'
            : '<span style="color: #ef4444; font-weight: 600;">Inativo</span>';

        document.getElementById('viewExternal').innerHTML = patient.external
            ? '<span style="color: #ea580c; font-weight: 600;">Externo</span>'
            : '<span style="color: #3b82f6; font-weight: 600;">UBS Local</span>';

        // ACS Responsável
        const viewAcsBox = document.getElementById('viewAcsBox');
        if (viewAcsBox) {
            if (patient.external) {
                viewAcsBox.style.display = 'none';
            } else {
                viewAcsBox.style.display = 'block';
                document.getElementById('viewAcs').innerHTML = patient.acsName 
                    ? `${escapeHTML(patient.acsName)}<br><span style="font-size: 13px; color: var(--color-text-muted); font-weight: 500;">Microárea ${patient.microarea}</span>` 
                    : 'Não associado';
            }
        }

        // Telefones
        if (patient.phones && patient.phones.length > 0) {
            const formattedPhones = patient.phones.map(tel => formatPhone(tel));
            document.getElementById('viewPhones').innerText = formattedPhones.join(', ');
        } else {
            document.getElementById('viewPhones').innerText = 'Nenhum contato salvo';
        }

        // Programas de Saúde e Medicamentos
        const viewProgramsEl = document.getElementById('viewPrograms');
        let programsHtml = '';

        const labels = {
            "DIABETES": "Diabetes",
            "HIPERTENSAO": "Hipertensão",
            "SAUDE_DA_MULHER": "Saúde da Mulher",
            "SAUDE_MENTAL": "Saúde Mental"
        };

        // 1. Mostrar Programas Inscritos
        if (patient.programCategories && patient.programCategories.length > 0) {
            const catNames = patient.programCategories
                .filter(cat => cat !== 'FARMACIA_BASICA') // Remove redundância
                .map(cat => labels[cat] || cat)
                .join(', ');

            if (catNames) {
                programsHtml += `<div style="margin-bottom: 12px; padding: 8px 12px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; color: #166534;">
                <i class="fa-solid fa-check-circle"></i> <b>Inscrito em:</b> ${catNames}
            </div>`;
            }
        }

        // 2. Mostrar Medicamentos
        if (patient.programs && patient.programs.length > 0) {
            patient.programs.forEach(prog => {
                const progKey = prog.category || prog.name || prog;
                const catName = labels[progKey] || progKey;

                programsHtml += `<div style="margin-bottom: 8px; border-left: 3px solid #e2e8f0; padding-left: 10px;">
                <b style="font-size: 13px; color: #64748b;">${catName}</b><br>
                <span style="font-size: 14px; color: #1e293b;">
                    <i class="fa-solid fa-pills" style="font-size: 12px; color: #0f766e;"></i> ${prog.medicationName} (${prog.concentration}) - <b style="color:#ea580c;">${prog.quantity} un</b>
                </span>
            </div>`;
            });
        }

        if (!programsHtml) {
            programsHtml = '<span class="text-muted">Nenhum programa ou medicamento vinculado</span>';
        }

        viewProgramsEl.innerHTML = programsHtml;

        // CORREÇÃO 3: IMPORTANTE! Atribuir o ID ao input de edição para o botão funcionar
        document.getElementById('editId').value = patient.id;

        // Exibe o modal no modo visualização
        document.getElementById('viewMode').classList.remove('d-none');
        document.getElementById('editMode').classList.add('d-none');
        document.getElementById('patientModal').classList.add('active');
    }

    function closeModal() {
        document.getElementById('patientModal').classList.remove('active');
    }

    async function enableEditMode() {
        await loadMedications();
        const id = document.getElementById('editId').value;
        const patient = currentPatients.find(p => String(p.id) === String(id));

        if (!patient) return;
        document.getElementById('editName').value = patient.name || '';
        document.getElementById('editCpf').value = patient.cpf ? applyCpfMask(patient.cpf) : '';
        document.getElementById('editCns').value = patient.cns ? applyCnsMask(patient.cns) : '';
        document.getElementById('editBirthDate').value = patient.birthDate ? patient.birthDate.split('T')[0] : '';

        const pList = patient.phones || [];
        document.getElementById('editPhone1').value = pList[0] ? formatPhone(pList[0]) : '';
        document.getElementById('editPhone2').value = pList[1] ? formatPhone(pList[1]) : '';
        document.getElementById('editPhone3').value = pList[2] ? formatPhone(pList[2]) : '';
        document.getElementById('editPhone4').value = pList[3] ? formatPhone(pList[3]) : '';

        document.getElementById('editExternal').checked = !!patient.external;
        document.getElementById('editStatus').checked = !!patient.status;

        const editAcsSelect = document.getElementById('editPatientAcs');
        if (editAcsSelect) {
            editAcsSelect.value = patient.acsId || '';
        }
        const editMicroareaInput = document.getElementById('editPatientMicroarea');
        if (editMicroareaInput) {
            editMicroareaInput.value = patient.microarea ? `Microárea ${patient.microarea}` : '';
        }

        // Reseta e preenche os programas selecionados (checkboxes)
        document.querySelectorAll('input[id^="editProg"]').forEach(cb => cb.checked = false);
        if (patient.programCategories) {
            patient.programCategories.forEach(cat => {
                const cb = document.querySelector(`input[id="editProg${cat.charAt(0) + cat.slice(1).toLowerCase().replace(/_([a-z])/g, (g) => g[1].toUpperCase())}"]`);
                // Nota: O ID no HTML está como editProgDiabetes, editProgHipertensao, etc.
                // Vou ajustar os IDs no HTML para serem mais fáceis de mapear ou usar o value.
            });
            // Forma mais robusta usando value:
            const editCheckboxes = document.querySelectorAll('input[id^="editProg"]');
            editCheckboxes.forEach(cb => {
                if (patient.programCategories.includes(cb.value)) {
                    cb.checked = true;
                }
            });
        } else if (patient.programs) {
            // Fallback: se não tiver programCategories, deriva dos programas vinculados
            const cats = [...new Set(patient.programs.map(p => p.category))];
            const editCheckboxes = document.querySelectorAll('input[id^="editProg"]');
            editCheckboxes.forEach(cb => {
                if (cats.includes(cb.value)) {
                    cb.checked = true;
                }
            });
        }
        updateBuilderOptions('editBuilderCategory', 'editProg');

        currentEditPatientPrograms = [];
        if (patient.programs) {
            patient.programs.forEach(prog => {
                currentEditPatientPrograms.push({
                    category: prog.category || prog.name || prog,
                    medicationId: prog.medicationId,
                    medicationName: prog.medicationName,
                    concentration: prog.concentration,
                    quantity: prog.quantity
                });
            });
        }
        renderEditBuilderPrograms();

        document.getElementById('viewMode').classList.add('d-none');
        document.getElementById('editMode').classList.remove('d-none');

        toggleProgramasEdit();
    }

    function cancelEditMode() {
        document.getElementById('viewMode').classList.remove('d-none');
        document.getElementById('editMode').classList.add('d-none');
    }

    async function savePatientEdit() {
        const id = document.getElementById('editId').value;
        let nomeEdit = document.getElementById('editName').value.trim();
        if (nomeEdit) {
            nomeEdit = nomeEdit.toLowerCase().replace(/(?:^|\s)\S/g, a => a.toUpperCase());
        }
        const cpfEdit = document.getElementById('editCpf').value.trim();
        const cnsEdit = document.getElementById('editCns').value.trim();
        const birthDateEdit = document.getElementById('editBirthDate').value;

        if (!id) {
            showToast("ID do paciente não encontrado.", 'error');
            return;
        }

        // --- VALIDAÇÕES DE FRONT-END ---
        const errors = [];

        // 1. Validação avançada de Nome Completo
        const nameValidation = validatePatientName(nomeEdit);
        if (!nameValidation.valid) {
            errors.push({ message: nameValidation.message, type: 'warning' });
        } else {
            nomeEdit = nameValidation.formattedName;
        }

        // 2. Documentos (Pelo menos um e validar se preenchido)
        if (!cpfEdit && !cnsEdit) {
            errors.push({ message: "É obrigatório informar pelo menos um documento (CPF ou CNS).", type: 'warning' });
        } else {
            if (cpfEdit && !isValidCPF(cpfEdit)) {
                errors.push({ message: "O CPF informado é inválido. Por favor, verifique os números.", type: 'error' });
            }
            if (cnsEdit && !isValidCNS(cnsEdit)) {
                errors.push({ message: "O CNS (Cartão SUS) informado é inválido. Por favor, verifique os números.", type: 'error' });
            }
        }

        // 3. Data de Nascimento
        let birthDateISO = null;
        if (!birthDateEdit) {
            errors.push({ message: "A data de nascimento é obrigatória.", type: 'warning' });
        } else {
            birthDateISO = new Date(birthDateEdit + 'T00:00:00');
            const hoje = new Date();
            hoje.setHours(0, 0, 0, 0);

            if (birthDateISO > hoje) {
                errors.push({ message: "Data de nascimento inválida! O paciente ainda não nasceu? Selecione uma data no passado.", type: 'error' });
            }
        }

        // Se houver erros, exibe todos e interrompe
        if (errors.length > 0) {
            errors.forEach(err => showToast(err.message, err.type));
            return;
        }

        const isExternal = document.getElementById('editExternal').checked;

        const enrollments = [];
        if (!isExternal) {
            document.querySelectorAll('input[id^="editProg"]:checked').forEach(cb => {
                const category = cb.value;
                const medications = currentEditPatientPrograms
                    .filter(p => p.category === category)
                    .map(p => ({
                        medicationId: p.medicationId,
                        medicationName: p.medicationName,
                        concentration: p.concentration,
                        quantity: p.quantity
                    }));
                
                enrollments.push({
                    category: category,
                    medications: medications
                });
            });
        }

        const p1 = document.getElementById('editPhone1').value.trim();
        const p2 = document.getElementById('editPhone2').value.trim();
        const p3 = document.getElementById('editPhone3').value.trim();
        const p4 = document.getElementById('editPhone4').value.trim();

        if (!p1) {
            showToast("O Telefone 1 é obrigatório.", "warning");
            return;
        }

        const phonesList = [p1, p2, p3, p4]
            .map(n => n.replace(/\D/g, ''))
            .filter(n => n.length > 0);

        const payload = {
            name: nomeEdit,
            cpf: cpfEdit === "" ? null : cpfEdit.replace(/\D/g, ''),
            cns: cnsEdit === "" ? null : cnsEdit.replace(/\D/g, ''),
            birthDate: birthDateISO,
            external: isExternal,
            status: document.getElementById('editStatus').checked,
            phones: phonesList,
            enrollments: enrollments,
            acsId: isExternal ? null : (document.getElementById('editPatientAcs').value || null)
        };

        setLoading('btnUpdatePatient', true);
        try {
            const response = await fetch(`${API_URL}/patients/${id}`, {
                method: 'PUT',
                headers: getAuthHeaders(),
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                showToast('Prontuário atualizado com sucesso!');
                window.dispatchEvent(new Event('patientsChanged'));
                closeModal();
                searchPatients();
            } else if (response.status === 422) {
                try {
                    const errorData = await response.json();
                    if (errorData.errors && errorData.errors.length > 0) {
                        showToast(errorData.errors[0].message, 'error');
                    } else {
                        showToast(errorData.message || 'Existem campos inválidos no formulário.', 'error');
                    }
                } catch (e) {
                    showToast('Erro de validação no servidor.', 'error');
                }
            } else {
                try {
                    const errorData = await response.json();
                    showToast(errorData.message || 'Erro ao atualizar. Verifique se o CPF ou CNS já estão em uso por outro paciente.', 'error');
                } catch (e) {
                    showToast('Erro ao atualizar. Verifique se o CPF ou CNS já estão em uso por outro paciente.', 'error');
                }
            }
        } catch (error) {
            console.error(error);
            showToast('Erro na comunicação com o servidor.', 'error');
        } finally {
            setLoading('btnUpdatePatient', false);
        }
    }

    async function toggleStatus(id) {
        if (!confirm('Tem a certeza que deseja alterar o status deste paciente?')) return;

        try {
            const response = await fetch(`${API_URL}/patients/${id}/status`, {
                method: 'PATCH',
                headers: getAuthHeaders()
            });

            if (response.ok) {
                showToast('Status atualizado com sucesso!');
                window.dispatchEvent(new Event('patientsChanged'));
                searchPatients();
            } else {
                showToast('Erro ao alterar o status no servidor.', 'error');
            }
        } catch (e) {
            console.error(e);
        }
    }

    function formatPhone(phone) {
        if (!phone) return '';
        let numbers = phone.replace(/\D/g, '');

        if (numbers.length === 11) {
            return numbers.replace(/^(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
        } else if (numbers.length === 10) {
            return numbers.replace(/^(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
        } else {
            return phone;
        }
    }

    function applyCpfMask(value) {
        if (!value) return '';
        return value
            .replace(/\D/g, '')
            .replace(/(\d{3})(\d)/, '$1.$2')
            .replace(/(\d{3})(\d)/, '$1.$2')
            .replace(/(\d{3})(\d{1,2})/, '$1-$2')
            .replace(/(-\d{2})\d+?$/, '$1');
    }

    function applyCnsMask(value) {
        if (!value) return '';
        return value
            .replace(/\D/g, '')
            .replace(/(\d{3})(\d)/, '$1.$2')
            .replace(/(\d{4})(\d)/, '$1.$2')
            .replace(/(\d{4})(\d{1,4})/, '$1.$2')
            .replace(/(\.\d{4})\d+?$/, '$1');
    }

    function applySinglePhoneMask(value) {
        if (!value) return '';
        let nums = value.replace(/\D/g, '');
        if (nums.length === 0) return '';
        if (nums.length <= 2) return `(${nums}`;
        if (nums.length <= 6) return `(${nums.substring(0, 2)}) ${nums.substring(2)}`;
        if (nums.length <= 10) return `(${nums.substring(0, 2)}) ${nums.substring(2, 6)}-${nums.substring(6)}`;
        return `(${nums.substring(0, 2)}) ${nums.substring(2, 7)}-${nums.substring(7, 11)}`;
    }

    var phoneLimitToastActive = false;

    function applyMultiPhoneMask(value) {
        if (!value) return '';

        let parts = value.split(',');
        let validParts = [];
        let count = 0;
        let limitExceeded = false;

        for (let part of parts) {
            let nums = part.replace(/\D/g, '');
            if (nums.length > 0) {
                count++;
                if (count > 4) {
                    limitExceeded = true;
                    break;
                }
                validParts.push(part);
            } else {
                if (count < 4) {
                    validParts.push(part);
                }
            }
        }

        if (limitExceeded) {
            if (!phoneLimitToastActive) {
                phoneLimitToastActive = true;
                showToast("Você pode adicionar no máximo 4 números de telefone.", 'warning');
                setTimeout(() => { phoneLimitToastActive = false; }, 3000);
            }
        }

        let maskedParts = validParts.map(part => {
            let nums = part.replace(/\D/g, '');
            if (nums.length === 0) return '';

            if (nums.length <= 2) return `(${nums}`;
            if (nums.length <= 6) return `(${nums.substring(0, 2)}) ${nums.substring(2)}`;
            if (nums.length <= 10) return `(${nums.substring(0, 2)}) ${nums.substring(2, 6)}-${nums.substring(6)}`;

            return `(${nums.substring(0, 2)}) ${nums.substring(2, 7)}-${nums.substring(7, 11)}`;
        });

        let result = maskedParts.filter(p => p !== '').join(', ');

        if (value.trim().endsWith(',') && count < 4) {
            result += ', ';
        }

        return result;
    }

    var searchInputEl = document.getElementById('searchInput');
    var suggestionsList = document.getElementById('patientPageSuggestions');
    var floatingSearchTimeout;

    if (searchInputEl) {
        searchInputEl.addEventListener('input', function (e) {
            let val = e.target.value;

            // Removida a máscara forçada de CPF aqui para permitir a digitação de CNS (15 dígitos) ou outros formatos.

            clearTimeout(floatingSearchTimeout);

            if (val.length >= 3) {
                floatingSearchTimeout = setTimeout(() => fetchFloatingSuggestions(val), 400);
            } else {
                if (suggestionsList) suggestionsList.style.display = 'none';
            }
        });
    }

    async function fetchFloatingSuggestions(query) {
        if (!suggestionsList) return;

        const statusFilter = document.getElementById('statusFilter');
        const statusFiltro = statusFilter ? statusFilter.value : 'ativos';

        try {
            const cleanQuery = /^[\d.\-]+$/.test(query) ? query.replace(/\D/g, '') : query;
            const response = await fetch(`${API_URL}/patients?query=${encodeURIComponent(cleanQuery)}&status=${statusFiltro}`, {
                headers: getAuthHeaders(),
                cache: 'no-store'
            });

            if (response.ok) {
                const pageData = await response.json();
                const patients = pageData.content || [];
                suggestionsList.innerHTML = '';

                if (patients.length === 0) {
                    suggestionsList.innerHTML = '<li style="padding: 12px 15px; color: #ef4444; font-size: 14px;">Nenhum paciente encontrado.</li>';
                } else {
                    patients.forEach(p => {
                        const li = document.createElement('li');
                        li.style.cssText = 'padding: 12px 15px; border-bottom: 1px solid #f3f4f6; cursor: pointer; display: flex; justify-content: space-between; align-items: center; transition: background 0.2s;';

                        const cpfBonito = p.cpf ? applyCpfMask(p.cpf) : 'Sem CPF';

                        li.innerHTML = `
                        <span style="font-weight: 600; color: #1f2937;">${escapeHTML(p.name)}</span>
                        <span style="font-size: 13px; color: #6b7280; background: #f3f4f6; padding: 2px 8px; border-radius: 4px;">CPF: ${escapeHTML(cpfBonito)}</span>
                    `;

                        li.onmouseover = () => li.style.backgroundColor = '#f0fdf4';
                        li.onmouseout = () => li.style.backgroundColor = 'transparent';

                        li.onclick = () => {
                            document.getElementById('searchInput').value = p.name;
                            suggestionsList.style.display = 'none';

                            currentPatients = [p];
                            renderPatientTable();
                            openPatientModal(String(p.id));
                        };
                        suggestionsList.appendChild(li);
                    });
                }
                suggestionsList.style.display = 'block';
            }
        } catch (error) {
            console.error("Erro na busca flutuante:", error);
        }
    }
    document.addEventListener('click', function (e) {
        if (e.target.id !== 'searchInput') {
            if (suggestionsList) suggestionsList.style.display = 'none';
        }
    });

    function formatPatientAge(birthDateString) {
        if (!birthDateString) return '-';

        const birth = new Date(birthDateString.split('T')[0] + 'T00:00:00');
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let years = today.getFullYear() - birth.getFullYear();
        let months = today.getMonth() - birth.getMonth();

        if (today.getDate() < birth.getDate()) {
            months--;
        }

        if (months < 0) {
            years--;
            months += 12;
        }

        if (years >= 1) {
            return `${years} ano${years > 1 ? 's' : ''}`;
        } else if (months >= 1) {
            return `${months} ${months > 1 ? 'meses' : 'mês'}`;
        } else {
            const diffTime = Math.abs(today - birth);
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            return `${diffDays} dia${diffDays !== 1 ? 's' : ''}`;
        }
    }

    /**
     * Validação de CPF (Algoritmo Oficial Módulo 11)
     */
    function isValidCPF(cpf) {
        cpf = cpf.replace(/\D/g, '');
        if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;
        let sum = 0, remainder;
        for (let i = 1; i <= 9; i++) sum = sum + parseInt(cpf.substring(i - 1, i)) * (11 - i);
        remainder = (sum * 10) % 11;
        if ((remainder === 10) || (remainder === 11)) remainder = 0;
        if (remainder !== parseInt(cpf.substring(9, 10))) return false;
        sum = 0;
        for (let i = 1; i <= 10; i++) sum = sum + parseInt(cpf.substring(i - 1, i)) * (12 - i);
        remainder = (sum * 10) % 11;
        if ((remainder === 10) || (remainder === 11)) remainder = 0;
        if (remainder !== parseInt(cpf.substring(10, 11))) return false;
        return true;
    }

    /**
     * Validação de CNS (Cartão Nacional de Saúde)
     */
    function isValidCNS(cns) {
        cns = cns.replace(/\D/g, '');
        if (cns.length !== 15) return false;
        const firstDigit = cns[0];
        if (['1', '2'].includes(firstDigit)) {
            let pis = cns.substring(0, 11);
            let soma = 0;
            for (let i = 0; i < 11; i++) soma += parseInt(pis[i]) * (15 - i);
            let resto = soma % 11;
            let dv = 11 - resto;
            if (dv === 11) dv = 0;
            if (dv === 10) {
                soma += 2;
                resto = soma % 11;
                dv = 11 - resto;
                return cns === (pis + "001" + dv.toString());
            } else {
                return cns === (pis + "000" + dv.toString());
            }
        } else if (['7', '8', '9'].includes(firstDigit)) {
            let soma = 0;
            for (let i = 0; i < 15; i++) soma += parseInt(cns[i]) * (15 - i);
            return (soma % 11 === 0);
        }
        return false;
    }

    window.toggleProgramasCadastro = toggleProgramasCadastro;
    window.toggleProgramasEdit = toggleProgramasEdit;
    window.loadAcsList = loadAcsList;

    // Expor funções globais para o HTML e router
    window.loadMedications = loadMedications;
    window.setupMedicationAutocomplete = setupMedicationAutocomplete;
    window.addProgramToBuilder = addProgramToBuilder;
    window.removeProgramFromBuilder = removeProgramFromBuilder;
    window.renderBuilderPrograms = renderBuilderPrograms;
    window.addProgramToEditBuilder = addProgramToEditBuilder;
    window.removeProgramFromEditBuilder = removeProgramFromEditBuilder;
    window.renderEditBuilderPrograms = renderEditBuilderPrograms;
    window.updateBuilderOptions = updateBuilderOptions;
    window.clearNewPatientForm = clearNewPatientForm;
    window.saveNewPatient = saveNewPatient;
    window.searchPatients = searchPatients;
    window.renderInitialTable = renderInitialTable;
    window.renderPatientTable = renderPatientTable;
    window.openPatientModal = openPatientModal;
    window.closeModal = closeModal;
    window.enableEditMode = enableEditMode;
    window.cancelEditMode = cancelEditMode;
    window.savePatientEdit = savePatientEdit;
    window.toggleStatus = toggleStatus;
    window.formatPhone = formatPhone;
    window.applyCpfMask = applyCpfMask;
    window.applyCnsMask = applyCnsMask;
    window.applyMultiPhoneMask = applyMultiPhoneMask;
    window.fetchFloatingSuggestions = fetchFloatingSuggestions;
    window.formatPatientAge = formatPatientAge;
    window.isValidCPF = isValidCPF;
    window.isValidCNS = isValidCNS;

    window.deletePatientFromModal = async function () {
        const id = document.getElementById('editId').value;
        if (!id) {
            showToast('Erro: ID do paciente não encontrado.', 'error');
            return;
        }

        const patient = currentPatients.find(p => String(p.id) === String(id));
        const name = patient ? patient.name : 'Paciente';

        if (!confirm(`Tem certeza de que deseja EXCLUIR permanentemente o prontuário de "${name}"? Esta ação não pode ser desfeita.`)) {
            return;
        }

        try {
            const response = await fetch(`${API_URL}/patients/${id}`, {
                method: 'DELETE',
                headers: getAuthHeaders()
            });

            if (response.ok) {
                showToast(`Paciente "${name}" excluído com sucesso!`);
                closeModal();
                loadPatients(); // Recarrega a lista de pacientes
            } else {
                const err = await response.json().catch(() => ({}));
                showToast(err.message || 'Erro ao excluir paciente.', 'error');
            }
        } catch (error) {
            showToast('Erro de conexão ao excluir paciente.', 'error');
        }
    };

    function validatePatientName(name) {
        if (!name) return { valid: false, message: "O nome é obrigatório." };

        let formattedName = name.replace(/\s+/g, ' ').trim();

        // Regex otimizada do padrão SUS (Regras 1, 2, 3, 5, 6, 7 e 8)
        const regexSus = /^(?=.{3,}$)(?!.* {2})(?!^[a-zà-öø-ÿ'] [a-zà-öø-ÿ'](?: |$))(?!^[a-zà-öø-ÿ']{2} [a-zà-öø-ÿ']{2}$)^[a-zà-öø-ÿ']+(?: (?:[a-zà-öø-ÿ']{2,}|e|y))+$/i;

        if (!regexSus.test(formattedName)) {
            return {
                valid: false,
                message: "O nome informado não atende aos padrões do SUS. Verifique letras soltas, termos muito curtos ou caracteres inválidos."
            };
        }

        return { valid: true, formattedName: formattedName };
    }

    window.togglePatientFilters = function () {
        const section = document.getElementById('patientFiltersSection');
        if (section) {
            if (section.style.display === 'none') {
                section.style.display = 'flex';
            } else {
                section.style.display = 'none';
            }
        }
    };

})();
