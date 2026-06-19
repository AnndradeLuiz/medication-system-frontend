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
            const { data: pageData } = await window.apiClient.get('/practitioners?size=1000');
            const practitioners = pageData.content || [];
            acsList = practitioners.filter(emp => emp.status && emp.role === 'ACS');
            populateAcsDropdowns();
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
            const { data } = await window.apiClient.get('/medications');
            medicationList = data || [];
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

            let selectedCategory = null;
            if (inputId === 'builderMedSearch') {
                selectedCategory = document.getElementById('builderCategory').value;
            } else if (inputId === 'editBuilderMedSearch') {
                selectedCategory = document.getElementById('editBuilderCategory').value;
            } else {
                selectedCategory = 'WOMENS_HEALTH';
            }

            const filtered = medicationList.filter(m =>
                m.activeIngredient && m.activeIngredient.toLowerCase().includes(query) &&
                (!selectedCategory || m.programCategory === selectedCategory || (m.programCategories && m.programCategories.includes(selectedCategory)))
            );

            listEl.innerHTML = '';
            if (filtered.length === 0) {
                listEl.innerHTML = '<li class="medication-not-found">Medicamento não encontrado.</li>';
            } else {
                filtered.forEach(m => {
                    const li = document.createElement('li');
                    li.className = 'medication-suggestion-item';
                    li.innerHTML = `<span class="medication-suggestion-name">${escapeHTML(m.activeIngredient)}</span> <span class="medication-suggestion-concentration">(${escapeHTML(m.concentration)})</span>`;

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

    function toggleBuilderFrequencyInput(isEdit) {
        const prefix = isEdit ? 'editBuilder' : 'builder';
        const select = document.getElementById(`${prefix}Frequency`);
        const customInput = document.getElementById(`${prefix}FrequencyCustom`);
        const timesInput = document.getElementById(`${prefix}TimesPerDay`);

        if (select && select.value === 'custom') {
            if (customInput) {
                customInput.disabled = false;
                customInput.placeholder = 'Ex: Dia sim, dia não';
            }
            if (timesInput) timesInput.value = '';
        } else {
            if (customInput) {
                customInput.disabled = true;
                customInput.value = '';
            }
            const selectedOption = select.options[select.selectedIndex];
            const times = selectedOption ? selectedOption.getAttribute('data-times') : '1';

            if (select.value === 'Uso sob demanda') {
                if (timesInput) timesInput.value = '0';
            } else {
                if (timesInput) timesInput.value = times;
            }
        }
    }

    function toggleBuilderDuration(isEdit) {
        const prefix = isEdit ? 'editBuilder' : 'builder';
        const isContinuousCheckbox = document.getElementById(`${prefix}IsContinuous`);
        const durationDaysInput = document.getElementById(`${prefix}DurationDays`);

        if (isContinuousCheckbox && isContinuousCheckbox.checked) {
            if (durationDaysInput) {
                durationDaysInput.disabled = true;
                durationDaysInput.value = '';
            }
        } else {
            if (durationDaysInput) durationDaysInput.disabled = false;
        }
    }

    function handleProgramToBuilder(isEdit) {
        const prefix = isEdit ? 'editBuilder' : 'builder';
        const targetList = isEdit ? currentEditPatientPrograms : currentPatientPrograms;

        const category = document.getElementById(`${prefix}Category`).value;
        const medId = document.getElementById(`${prefix}MedId`).value;
        const medName = document.getElementById(`${prefix}MedName`).value;
        const medConcentration = document.getElementById(`${prefix}MedConcentration`).value;
        const quantity = parseInt(document.getElementById(`${prefix}Quantity`).value);

        if (!category) {
            showToast("Selecione um programa.");
            return;
        }

        if (!medId || isNaN(quantity) || quantity <= 0) {
            showToast("Selecione um medicamento e informe uma quantidade válida maior que zero.");
            return;
        }

        if (targetList.some(p => p.medicationId === medId)) {
            showToast("Este medicamento já foi adicionado para este paciente.");
            return;
        }

        const rawPrescriptionDate = document.getElementById(`${prefix}PrescriptionDate`).value;
        if (!rawPrescriptionDate) {
            showToast("Informe a data de emissão da receita.");
            return;
        }

        const prescriberName = document.getElementById(`${prefix}PrescriberName`).value.trim();
        const prescriberCpf = document.getElementById(`${prefix}PrescriberCpf`).value.trim();
        const prescriberCouncil = document.getElementById(`${prefix}PrescriberCouncil`).value;
        const prescriberCouncilUF = document.getElementById(`${prefix}PrescriberCouncilUF`).value;
        const prescriberCouncilNumber = document.getElementById(`${prefix}PrescriberCouncilNumber`).value.trim();

        if (!prescriberName) {
            showToast("Informe o nome do prescritor.");
            return;
        }
        if (!prescriberCouncil) {
            showToast("Selecione o conselho do prescritor.");
            return;
        }
        if (!prescriberCouncilUF) {
            showToast("Selecione a UF do conselho.");
            return;
        }
        if (!prescriberCouncilNumber) {
            showToast("Informe o número do conselho.");
            return;
        }

        const doseQuantity = parseFloat(document.getElementById(`${prefix}DoseQty`).value) || 1.0;
        const doseUnit = document.getElementById(`${prefix}DoseUnit`).value;
        const freqSelect = document.getElementById(`${prefix}Frequency`).value;
        const frequency = freqSelect === 'custom'
            ? document.getElementById(`${prefix}FrequencyCustom`).value.trim()
            : freqSelect;
        const timesPerDay = parseInt(document.getElementById(`${prefix}TimesPerDay`).value) || 0;
        const prescriptionDate = rawPrescriptionDate ? new Date(rawPrescriptionDate + 'T00:00:00').toISOString() : null;
        const administrationInstructions = document.getElementById(`${prefix}Instructions`).value.trim();

        const prescription = {
            prescriptionDate: prescriptionDate,
            prescriberName: prescriberName,
            prescriberCpf: prescriberCpf === "" ? null : prescriberCpf.replace(/\D/g, ''),
            prescriberCouncil: prescriberCouncil,
            prescriberCouncilUF: prescriberCouncilUF,
            prescriberCouncilNumber: prescriberCouncilNumber
        };

        targetList.push({
            category: category,
            medicationId: medId,
            medicationName: medName,
            concentration: medConcentration,
            quantity: quantity,
            doseQuantity: doseQuantity,
            doseUnit: doseUnit,
            frequency: frequency,
            timesPerDay: timesPerDay,
            prescription: prescription,
            administrationInstructions: administrationInstructions
        });

        document.getElementById(`${prefix}Category`).value = '';
        document.getElementById(`${prefix}MedSearch`).value = '';
        document.getElementById(`${prefix}MedId`).value = '';
        document.getElementById(`${prefix}MedName`).value = '';
        document.getElementById(`${prefix}MedConcentration`).value = '';
        document.getElementById(`${prefix}Quantity`).value = '';

        document.getElementById(`${prefix}DoseQty`).value = '1';
        document.getElementById(`${prefix}DoseUnit`).value = 'comprimido(s)';
        document.getElementById(`${prefix}Frequency`).value = '1 vez ao dia';
        document.getElementById(`${prefix}FrequencyCustom`).value = '';
        document.getElementById(`${prefix}FrequencyCustomGroup`).style.display = 'none';
        document.getElementById(`${prefix}TimesPerDayGroup`).style.display = 'flex';
        document.getElementById(`${prefix}TimesPerDay`).value = '1';
        document.getElementById(`${prefix}Instructions`).value = '';

        renderProgramsList(isEdit);
    }

    function renderProgramsList(isEdit) {
        const listElId = isEdit ? 'editPatientProgramsList' : 'patientProgramsList';
        const listEl = document.getElementById(listElId);
        const targetList = isEdit ? currentEditPatientPrograms : currentPatientPrograms;
        listEl.innerHTML = '';

        if (targetList.length === 0) {
            listEl.innerHTML = '<div class="no-programs-alert">Nenhum programa adicionado.</div>';
            return;
        }

        const fragment = document.createDocumentFragment();

        targetList.forEach((prog, index) => {
            const catName = window.PROGRAM_LABELS ? window.PROGRAM_LABELS[prog.category] || prog.category : prog.category;
            const prescription = prog.prescription || {};
            const dateStr = prescription.prescriptionDate ? new Date(prescription.prescriptionDate).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '-';
            const prescriberStr = prescription.prescriberName ? `${prescription.prescriberName} (${prescription.prescriberCouncil}/${prescription.prescriberCouncilUF} ${prescription.prescriberCouncilNumber})` : 'Não informado';

            const div = document.createElement('div');
            div.className = 'program-card-item';
            
            const btnAction = isEdit ? `removeProgramFromEditBuilder(${index})` : `removeProgramFromBuilder(${index})`;

            div.innerHTML = `
            <div>
                <div class="program-card-title">${catName}</div>
                <div class="program-card-med">
                    <i class="fa-solid fa-pills"></i> <b>${prog.medicationName} (${prog.concentration})</b> - <b>${prog.quantity} un</b>
                </div>
                <div class="program-card-meta">
                    Posologia: ${prog.doseQuantity} ${prog.doseUnit}, ${prog.frequency}.<br>
                    Prescritor: ${prescriberStr} | Receita: ${dateStr}
                </div>
            </div>
            <button type="button" onclick="${btnAction}" class="program-card-delete-btn">
                <i class="fa-solid fa-trash"></i>
            </button>
        `;
            fragment.appendChild(div);
        });

        listEl.appendChild(fragment);
    }

    function addProgramToBuilder() { handleProgramToBuilder(false); }
    function addProgramToEditBuilder() { handleProgramToBuilder(true); }

    function removeProgramFromBuilder(index) {
        currentPatientPrograms.splice(index, 1);
        renderProgramsList(false);
    }

    function removeProgramFromEditBuilder(index) {
        currentEditPatientPrograms.splice(index, 1);
        renderProgramsList(true);
    }

    function renderBuilderPrograms() { renderProgramsList(false); }
    function renderEditBuilderPrograms() { renderProgramsList(true); }


    function updateBuilderOptions(selectId, checkboxPrefix) {
        const selectEl = document.getElementById(selectId);
        const checkboxes = document.querySelectorAll(`input[id^="${checkboxPrefix}"]`);
        const selected = Array.from(checkboxes).filter(cb => cb.checked).map(cb => cb.value);

        const labels = window.PROGRAM_LABELS || {};

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

        const genderSelect = document.getElementById('newGender');
        if (genderSelect) genderSelect.value = '';
        
        const usesCheckbox = document.getElementById('newUsesContraceptive');
        if (usesCheckbox) {
            usesCheckbox.checked = false;
            // Isso já limpa os campos de detalhes
            const details = document.getElementById('newContraceptiveDetails');
            if (details) details.style.display = 'none';
            const methodSelect = document.getElementById('newContraceptiveMethod');
            const dateInput = document.getElementById('newContraceptiveAppliedDate');
            const durationInput = document.getElementById('newContraceptiveDurationDays');
            const medId = document.getElementById('newContraceptiveMedId');
            const medSearch = document.getElementById('newContraceptiveMedSearch');
            const medName = document.getElementById('newContraceptiveMedName');
            const medConcentration = document.getElementById('newContraceptiveMedConcentration');
            const qtyInput = document.getElementById('newContraceptiveQuantity');

            if (methodSelect) methodSelect.value = '';
            if (dateInput) dateInput.value = '';
            if (durationInput) durationInput.value = '';
            if (medId) medId.value = '';
            if (medSearch) medSearch.value = '';
            if (medName) medName.value = '';
            if (medConcentration) medConcentration.value = '';
            if (qtyInput) qtyInput.value = '';

            const stockRow = document.getElementById('newContraceptiveStockMedRow');
            if (stockRow) stockRow.style.display = 'none';
        }
        const section = document.getElementById('newContraceptiveSection');
        if (section) section.style.display = 'none';

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

        const builderPrescriberFields = [
            'builderPrescriberName', 'builderPrescriberCpf', 'builderPrescriberCouncil',
            'builderPrescriberCouncilUF', 'builderPrescriberCouncilNumber', 'builderPrescriptionDate'
        ];
        builderPrescriberFields.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });

        // Garante que a seção de programas volte a aparecer para o próximo cadastro
        const secaoProgramas = document.getElementById('secaoProgramasCadastro');
        if (secaoProgramas) secaoProgramas.style.display = 'block';

        if (typeof checkAndToggleBuilderLock === 'function') checkAndToggleBuilderLock(false);
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
        const isExt = document.getElementById('editExternal').checked;
        const secao = document.getElementById('secaoProgramasEdit');
        const acsContainer = document.getElementById('editPatientAcsContainer');
        
        if (acsContainer) {
            acsContainer.style.display = isExt ? 'none' : 'flex';
        }
        
        if (isExt) {
            const acsSelect = document.getElementById('editPatientAcs');
            if (acsSelect) acsSelect.value = "";
            const microareaInput = document.getElementById('editPatientMicroarea');
            if (microareaInput) microareaInput.value = "";
        }
        
        if (secao) {
            if (isExt) {
                secao.style.display = 'none';
                // Não limpa currentEditPatientPrograms para caso o usuário desmarque 'Externo'
            } else {
                secao.style.display = 'block';
            }
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
        const nameValidation = window.validateFullName(nomeInput);
        if (!nameValidation.valid) {
            errors.push({ message: nameValidation.message, type: 'warning' });
        } else {
            nomeInput = nameValidation.formattedName;
        }

        // 2. Documentos (Pelo menos um e validar se preenchido)
        if (!cpfInput && !cnsInput) {
            errors.push({ message: "É obrigatório informar pelo menos um documento (CPF ou CNS).", type: 'warning' });
        } else {
            if (cpfInput && !window.isValidCPF(cpfInput)) {
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
                const categoryPrograms = currentPatientPrograms.filter(p => p.category === category);
                const groupedByRx = {};

                categoryPrograms.forEach(p => {
                    const rx = p.prescription || {};
                    const rxKey = rx.prescriberName ? `${rx.prescriberName}_${rx.prescriberCouncilNumber}_${rx.prescriberCouncilUF}_${rx.prescriptionDate}` : 'no-prescription';
                    if (!groupedByRx[rxKey]) {
                        groupedByRx[rxKey] = {
                            prescription: rx.prescriberName ? rx : null,
                            items: []
                        };
                    }
                    groupedByRx[rxKey].items.push({
                        medicationId: p.medicationId,
                        medicationName: p.medicationName,
                        concentration: p.concentration,
                        quantity: p.quantity,
                        doseQuantity: p.doseQuantity,
                        doseUnit: p.doseUnit,
                        frequency: p.frequency,
                        timesPerDay: p.timesPerDay,
                        administrationInstructions: p.administrationInstructions
                    });
                });

                enrollments.push({
                    category: category,
                    medications: Object.values(groupedByRx)
                });
            });
        }

        let contraceptiveInfo = null;
        const usesContraceptive = document.getElementById('newUsesContraceptive') && document.getElementById('newUsesContraceptive').checked;
        if (usesContraceptive) {
            const methodSelect = document.getElementById('newContraceptiveMethod');
            const selectedOption = methodSelect.options[methodSelect.selectedIndex];
            const unit = selectedOption ? selectedOption.getAttribute('data-unit') : 'days';
            const rawDuration = parseInt(document.getElementById('newContraceptiveDurationDays').value) || 0;
            
            let durationInDays = rawDuration;
            if (unit === 'years') {
                durationInDays = rawDuration * 365;
            } else if (unit === 'months') {
                durationInDays = rawDuration * 30;
            }

            const method = methodSelect.value;
            const appliedDate = document.getElementById('newContraceptiveAppliedDate').value;
            const medId = document.getElementById('newContraceptiveMedId').value || null;
            const medName = document.getElementById('newContraceptiveMedName').value || null;
            const medConcentration = document.getElementById('newContraceptiveMedConcentration').value || null;
            const quantity = parseInt(document.getElementById('newContraceptiveQuantity').value) || null;

            contraceptiveInfo = {
                active: true,
                medicationId: medId,
                medicationName: medId ? `${medName} (${medConcentration})` : method,
                appliedDate: appliedDate ? new Date(appliedDate + 'T00:00:00').toISOString() : null,
                durationDays: durationInDays,
                quantity: quantity
            };
        }

        const payload = {
            name: nomeInput,
            cpf: cpfInput.trim() === "" ? null : cpfInput.replace(/\D/g, ''),
            cns: cnsInput.trim() === "" ? null : cnsInput.replace(/\D/g, ''),
            birthDate: new Date(birthDateInput + 'T00:00:00').toISOString(),
            external: isExternalInput,
            phones: phonesList,
            enrollments: enrollments,
            acsId: isExternalInput ? null : (document.getElementById('newPatientAcs').value || null),
            gender: document.getElementById('newGender').value || 'IGNORADO',
            contraceptiveInfo: contraceptiveInfo
        };

        setLoading('btnSaveNewPatient', true);
        try {
            const response = await window.apiClient.post('/patients', payload);
            showToast('Paciente cadastrado com sucesso!');
            window.dispatchEvent(new Event('patientsChanged'));
            clearNewPatientForm();

            const tabs = document.querySelectorAll('.tab');
            if (tabs.length > 0) {
                switchTab('tab-busca', tabs[0]);
            }
            searchPatients();
        } catch (error) {
            const status = error.status;
            if (status === 422 && error.data) {
                const errorData = error.data;
                if (errorData.errors && errorData.errors.length > 0) {
                    showToast(errorData.errors[0].message, 'error');
                } else {
                    showToast(errorData.message || 'Existem campos inválidos no formulário.', 'error');
                }
            } else if (error.data && error.data.message) {
                showToast(error.data.message, 'error');
            } else {
                showToast('Erro ao cadastrar. Verifique se o CPF ou CNS já estão cadastrados no sistema ou se há erro de conexão.', 'error');
            }
        } finally {
            setLoading('btnSaveNewPatient', false);
        }
    }

    function checkAndToggleBuilderLock(isEdit) {
        const prefix = isEdit ? 'editBuilder' : 'builder';
        const dateEl = document.getElementById(`${prefix}PrescriptionDate`);
        const councilEl = document.getElementById(`${prefix}PrescriberCouncil`);
        const ufEl = document.getElementById(`${prefix}PrescriberCouncilUF`);
        const numEl = document.getElementById(`${prefix}PrescriberCouncilNumber`);

        if (!dateEl || !councilEl || !ufEl || !numEl) return;

        const medFields = [
            `${prefix}Category`,
            `${prefix}MedSearch`,
            `${prefix}Quantity`,
            `${prefix}DoseQty`,
            `${prefix}DoseUnit`,
            `${prefix}Frequency`,
            `${prefix}Instructions`
        ];

        const hasDate = !!dateEl.value;
        const hasCouncil = !!councilEl.value;
        const hasUf = !!ufEl.value;
        const hasNum = !!numEl.value.trim();

        const isLocked = !(hasDate && hasCouncil && hasUf && hasNum);

        medFields.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.disabled = isLocked;
        });

        const btn = document.getElementById(isEdit ? 'editBuilderAddBtn' : 'builderAddBtn');
        if (btn) btn.disabled = isLocked;

        const freqSelect = document.getElementById(`${prefix}Frequency`);
        const customInput = document.getElementById(`${prefix}FrequencyCustom`);
        if (customInput) {
            if (isLocked) {
                customInput.disabled = true;
            } else {
                customInput.disabled = freqSelect ? freqSelect.value !== 'custom' : true;
            }
        }
    }

    // --- INICIALIZAÇÃO DA PÁGINA ---
    window.initPatientModule = function () {
        loadMedications();
        loadAcsList();

        // Resetar estado de busca
        currentPatients = [];
        const searchInput = document.getElementById('searchInput');
        if (searchInput) searchInput.value = '';
        
        const pageInfoEl = document.getElementById('patientPageInfo');
        const currentPgEl = document.getElementById('patientCurrentPage');
        const btnPrev = document.getElementById('btnPrevPatient');
        const btnNext = document.getElementById('btnNextPatient');
        
        if (pageInfoEl) pageInfoEl.innerText = '0-0 de 0';
        if (currentPgEl) currentPgEl.innerText = 'Pág 1 de 1';
        if (btnPrev) btnPrev.disabled = true;
        if (btnNext) btnNext.disabled = true;

        // Listeners para atualização de microárea do ACS
        const newSelect = document.getElementById('newPatientAcs');
        if (newSelect) {
            newSelect.addEventListener('change', function () {
                const selectedAcs = acsList.find(acs => acs.id === this.value);
                const microareaInput = document.getElementById('newPatientMicroarea');
                if (microareaInput) {
                    microareaInput.value = selectedAcs ? `Microárea ${selectedAcs.microarea}` : '';
                }
            });
        }

        const editSelect = document.getElementById('editPatientAcs');
        if (editSelect) {
            editSelect.addEventListener('change', function () {
                const selectedAcs = acsList.find(acs => acs.id === this.value);
                const microareaInput = document.getElementById('editPatientMicroarea');
                if (microareaInput) {
                    microareaInput.value = selectedAcs ? `Microárea ${selectedAcs.microarea}` : '';
                }
            });
        }

        setupMedicationAutocomplete('builderMedSearch', 'builderMedSuggestions', 'builderMedId', 'builderMedName', 'builderMedConcentration');
        setupMedicationAutocomplete('editBuilderMedSearch', 'editBuilderMedSuggestions', 'editBuilderMedId', 'editBuilderMedName', 'editBuilderMedConcentration');
        setupMedicationAutocomplete('newContraceptiveMedSearch', 'newContraceptiveMedSuggestions', 'newContraceptiveMedId', 'newContraceptiveMedName', 'newContraceptiveMedConcentration');
        setupMedicationAutocomplete('editContraceptiveMedSearch', 'editContraceptiveMedSuggestions', 'editContraceptiveMedId', 'editContraceptiveMedName', 'editContraceptiveMedConcentration');

        // Listeners para travar campos de medicamentos até preenchimento da receita
        const dateEl = document.getElementById('builderPrescriptionDate');
        const councilEl = document.getElementById('builderPrescriberCouncil');
        const ufEl = document.getElementById('builderPrescriberCouncilUF');
        const numEl = document.getElementById('builderPrescriberCouncilNumber');
        if (dateEl) dateEl.addEventListener('input', () => checkAndToggleBuilderLock(false));
        if (councilEl) councilEl.addEventListener('change', () => checkAndToggleBuilderLock(false));
        if (ufEl) ufEl.addEventListener('change', () => checkAndToggleBuilderLock(false));
        if (numEl) numEl.addEventListener('input', () => checkAndToggleBuilderLock(false));

        const editDateEl = document.getElementById('editBuilderPrescriptionDate');
        const editCouncilEl = document.getElementById('editBuilderPrescriberCouncil');
        const editUfEl = document.getElementById('editBuilderPrescriberCouncilUF');
        const editNumEl = document.getElementById('editBuilderPrescriberCouncilNumber');
        if (editDateEl) editDateEl.addEventListener('input', () => checkAndToggleBuilderLock(true));
        if (editCouncilEl) editCouncilEl.addEventListener('change', () => checkAndToggleBuilderLock(true));
        if (editUfEl) editUfEl.addEventListener('change', () => checkAndToggleBuilderLock(true));
        if (editNumEl) editNumEl.addEventListener('input', () => checkAndToggleBuilderLock(true));

        checkAndToggleBuilderLock(false);
        checkAndToggleBuilderLock(true);

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
        if (newCpfEl) newCpfEl.addEventListener('input', e => e.target.value = window.applyCpfMask(e.target.value));

        const newCnsEl = document.getElementById('newCns');
        if (newCnsEl) newCnsEl.addEventListener('input', e => e.target.value = applyCnsMask(e.target.value));

        const editCpfEl = document.getElementById('editCpf');
        if (editCpfEl) editCpfEl.addEventListener('input', e => e.target.value = window.applyCpfMask(e.target.value));

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
            const { data: pageData } = await window.apiClient.get(`/patients?query=${encodeURIComponent(cleanQuery)}&status=${statusFiltro}&program=${encodeURIComponent(programFiltro)}&page=${patientCurrentPage}&size=${pageSize}`);
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
        } catch (error) {
            console.error("Erro ao carregar dados dos pacientes:", error);
            tbody.innerHTML = '<tr><td colspan="5" class="empty-msg" style="color: red;">Erro ao buscar pacientes.</td></tr>';
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

            let cpfFormatado = p.cpf ? window.applyCpfMask(p.cpf) : '-';
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
                        const items = m.items || [];
                        items.forEach(item => {
                            patient.programs.push({
                                category: e.category,
                                medicationId: item.medicationId,
                                medicationName: item.medicationName,
                                concentration: item.concentration,
                                quantity: item.quantity,
                                doseQuantity: item.doseQuantity,
                                doseUnit: item.doseUnit,
                                frequency: item.frequency,
                                timesPerDay: item.timesPerDay,
                                prescription: m.prescription || null,
                                administrationInstructions: item.administrationInstructions
                            });
                        });
                    });
                }
            });
        }

        // Preenchimento dos dados básicos
        const patientAge = formatPatientAge(patient.birthDate);
        document.getElementById('viewPatientNameHeader').innerHTML = `<span class="patient-header-name">${escapeHTML(patient.name)}</span><br><span class="patient-header-age">${patientAge}</span>`;
        
        document.getElementById('viewCpf').innerText = patient.cpf ? window.applyCpfMask(patient.cpf) : '-';

        // CORREÇÃO 1: Atribuição do CNS que estava solta
        document.getElementById('viewCns').innerText = patient.cns ? applyCnsMask(patient.cns) : '-';

        let birthDateFormatted = 'Não informada';
        if (patient.birthDate) {
            const dateObj = new Date(patient.birthDate);
            // Usamos UTC para evitar que o fuso horário mude o dia do nascimento
            birthDateFormatted = dateObj.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
        }
        document.getElementById('viewBirthDate').innerText = birthDateFormatted;

        const genderLabels = {
            'MASCULINO': 'Masculino',
            'FEMININO': 'Feminino',
            'IGNORADO': 'Ignorado'
        };
        const viewGenderEl = document.getElementById('viewGender');
        if (viewGenderEl) {
            viewGenderEl.innerText = genderLabels[patient.gender] || 'Ignorado';
        }

        const contraceptiveBox = document.getElementById('viewContraceptiveBox');
        if (contraceptiveBox) {
            const info = patient.contraceptiveInfo;
            if (info && info.active) {
                contraceptiveBox.style.display = 'block';
                document.getElementById('viewContraceptiveMethod').innerText = info.medicationName || '-';
                
                let appDateFormatted = '-';
                let expDateFormatted = '-';
                if (info.appliedDate) {
                    const appDate = new Date(info.appliedDate);
                    appDateFormatted = appDate.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
                    if (info.durationDays) {
                        const expDate = new Date(appDate);
                        expDate.setDate(expDate.getDate() + info.durationDays);
                        expDateFormatted = expDate.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
                    }
                }
                
                document.getElementById('viewContraceptiveAppliedDate').innerText = appDateFormatted;
                document.getElementById('viewContraceptiveDuration').innerText = info.durationDays 
                    ? `${info.durationDays} dias (Vence em ${expDateFormatted})` 
                    : '-';

                const stockMedBox = document.getElementById('viewContraceptiveStockMedBox');
                if (stockMedBox) {
                    if (info.medicationId && info.quantity) {
                        stockMedBox.style.display = 'grid';
                        document.getElementById('viewContraceptiveMed').innerText = info.medicationName || '-';
                        document.getElementById('viewContraceptiveQuantity').innerText = `${info.quantity} ${info.quantity === 1 ? 'unidade' : 'unidades'}`;

                    } else {
                        stockMedBox.style.display = 'none';
                    }
                }
            } else {
                contraceptiveBox.style.display = 'none';
                const stockMedBox = document.getElementById('viewContraceptiveStockMedBox');
                if (stockMedBox) stockMedBox.style.display = 'none';
            }
        }
        
        document.getElementById('modalTitle').innerHTML = `<i class="fa-solid fa-id-card"></i> Prontuário do Paciente`;

        document.getElementById('viewStatus').innerHTML = patient.status
            ? '<span class="patient-status-active">Ativo</span>'
            : '<span class="patient-status-inactive">Inativo</span>';

        document.getElementById('viewExternal').innerHTML = patient.external
            ? '<span class="patient-origin-external">Externo</span>'
            : '<span class="patient-origin-local">UBS Local</span>';

        // ACS Responsável
        const viewAcsBox = document.getElementById('viewAcsBox');
        if (viewAcsBox) {
            if (patient.external) {
                viewAcsBox.style.display = 'none';
            } else {
                viewAcsBox.style.display = 'block';
                document.getElementById('viewAcs').innerHTML = patient.acsName
                    ? `${escapeHTML(patient.acsName)}<br><span class="patient-acs-meta">Microárea ${patient.microarea}</span>`
                    : 'Não associado';
            }
        }

        // Telefones
        if (patient.phones && patient.phones.length > 0) {
            const formattedPhones = patient.phones.map(tel => formatPhone(tel));
            document.getElementById('viewPhones').innerHTML = formattedPhones.join('<br>');
        } else {
            document.getElementById('viewPhones').innerText = 'Nenhum contato salvo';
        }

        // Programas de Saúde e Medicamentos
        const viewProgramsEl = document.getElementById('viewPrograms');
        let programsHtml = '';

        const labels = {
            "DIABETES": "Diabetes",
            "HYPERTENSION": "Hipertensão",
            "WOMENS_HEALTH": "Saúde da Mulher",
            "MENTAL_HEALTH": "Saúde Mental",
            "BASIC_PHARMACY": "Farmácia Básica",
            // Fallback
            "HIPERTENSAO": "Hipertensão",
            "SAUDE_DA_MULHER": "Saúde da Mulher",
            "SAUDE_MENTAL": "Saúde Mental",
            "FARMACIA_BASICA": "Farmácia Básica"
        };

        // 1. Mostrar Programas Inscritos
        if (patient.programCategories && patient.programCategories.length > 0) {
            const catNames = patient.programCategories
                .filter(cat => cat !== 'FARMACIA_BASICA' && cat !== 'BASIC_PHARMACY') // Remove redundância
                .map(cat => labels[cat] || cat)
                .join(', ');

            if (catNames) {
                programsHtml += `<div class="patient-enrolled-program-badge">
                <i class="fa-solid fa-check-circle"></i> <b>Inscrito em:</b> ${catNames}
            </div>`;
            }
        }

        // 2. Mostrar Medicamentos
        if (patient.programs && patient.programs.length > 0) {
            patient.programs.forEach(prog => {
                const progKey = prog.category || prog.name || prog;
                const catName = labels[progKey] || progKey;

                let posologiaHtml = '';
                if (prog.doseQuantity || prog.doseUnit || prog.frequency) {
                    posologiaHtml += `<div class="patient-medication-details">`;
                    let parts = [];
                    if (prog.doseQuantity && prog.doseUnit) {
                        parts.push(`Dose: <b>${prog.doseQuantity} ${prog.doseUnit}</b>`);
                    }
                    if (prog.frequency) {
                        parts.push(`Frequência: <b>${prog.frequency}</b>`);
                    }
                    posologiaHtml += parts.join(' | ');

                    const prescription = prog.prescription || {};
                    if (prescription.prescriptionDate) {
                        const pDate = new Date(prescription.prescriptionDate);
                        const expiryDate = new Date(pDate.getTime());
                        expiryDate.setDate(pDate.getDate() + 180);

                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        const isExpired = today > expiryDate;

                        const pDateStr = pDate.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
                        const expiryStr = expiryDate.toLocaleDateString('pt-BR', { timeZone: 'UTC' });

                        const badge = isExpired
                            ? `<span class="prescription-badge-expired"><i class="fa-solid fa-circle-xmark"></i> RECEITA VENCIDA (Venceu em ${expiryStr})</span>`
                            : `<span class="prescription-badge-valid"><i class="fa-solid fa-circle-check"></i> Receita Válida até ${expiryStr}</span>`;

                        const prescriberStr = prescription.prescriberName ? `${prescription.prescriberName} (${prescription.prescriberCouncil}/${prescription.prescriberCouncilUF} ${prescription.prescriberCouncilNumber})` : 'Não informado';

                        posologiaHtml += `<br><span class="prescription-meta-text">Prescritor: <b>${escapeHTML(prescriberStr)}</b></span>`;
                        posologiaHtml += `<br><span class="prescription-meta-text">Receita de: ${pDateStr}</span> ${badge}`;
                    }

                    if (prog.administrationInstructions) {
                        posologiaHtml += `<br><span class="prescription-instructions"><i class="fa-solid fa-info-circle"></i> Instruções: ${escapeHTML(prog.administrationInstructions)}</span>`;
                    }
                    posologiaHtml += `</div>`;
                }

                programsHtml += `<div class="patient-medication-block">
                <b class="patient-medication-category">${catName}</b><br>
                <span class="patient-medication-name">
                    <i class="fa-solid fa-pills"></i> <b>${escapeHTML(prog.medicationName)} (${escapeHTML(prog.concentration)})</b> - <b>${prog.quantity} un</b>
                </span>
                ${posologiaHtml}
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
        document.getElementById('editCpf').value = patient.cpf ? window.applyCpfMask(patient.cpf) : '';
        document.getElementById('editCns').value = patient.cns ? applyCnsMask(patient.cns) : '';
        document.getElementById('editBirthDate').value = patient.birthDate ? patient.birthDate.split('T')[0] : '';

        const pList = patient.phones || [];
        document.getElementById('editPhone1').value = pList[0] ? formatPhone(pList[0]) : '';
        document.getElementById('editPhone2').value = pList[1] ? formatPhone(pList[1]) : '';
        document.getElementById('editPhone3').value = pList[2] ? formatPhone(pList[2]) : '';
        document.getElementById('editPhone4').value = pList[3] ? formatPhone(pList[3]) : '';

        document.getElementById('editGender').value = patient.gender || '';

        const info = patient.contraceptiveInfo;
        const usesCheckbox = document.getElementById('editUsesContraceptive');
        if (usesCheckbox) {
            if (info && info.active) {
                usesCheckbox.checked = true;
                document.getElementById('editContraceptiveDetails').style.display = 'block';
                
                let detectedMethod = '';
                let detectedUnit = 'days';
                if (info.medicationId) {
                    if (info.durationDays === 28) {
                        detectedMethod = 'Pílula Oral';
                    } else if (info.durationDays === 30) {
                        detectedMethod = 'Injetável Mensal';
                    } else if (info.durationDays === 90) {
                        detectedMethod = 'Injetável Trimestral';
                        detectedUnit = 'months';
                    } else {
                        detectedMethod = 'Outro';
                    }
                    
                    document.getElementById('editContraceptiveMethod').value = detectedMethod;
                    document.getElementById('editContraceptiveMedId').value = info.medicationId || '';
                    document.getElementById('editContraceptiveMedSearch').value = info.medicationName || '';
                    
                    const match = info.medicationName ? info.medicationName.match(/^(.*?)\s*\((.*?)\)$/) : null;
                    if (match) {
                        document.getElementById('editContraceptiveMedName').value = match[1] || '';
                        document.getElementById('editContraceptiveMedConcentration').value = match[2] || '';
                    } else {
                        document.getElementById('editContraceptiveMedName').value = info.medicationName || '';
                        document.getElementById('editContraceptiveMedConcentration').value = '';
                    }
                    document.getElementById('editContraceptiveQuantity').value = info.quantity || '';
                    
                    const stockRow = document.getElementById('editContraceptiveStockMedRow');
                    if (stockRow) stockRow.style.display = 'flex';
                } else {
                    document.getElementById('editContraceptiveMethod').value = info.medicationName || '';
                    
                    const method = info.medicationName;
                    if (['DIU de Cobre', 'DIU Mirena', 'Implante Contraceptivo (Implanon)'].includes(method)) {
                        detectedUnit = 'years';
                    } else if (method === 'Injetável Trimestral') {
                        detectedUnit = 'months';
                    }
                    
                    document.getElementById('editContraceptiveMedId').value = '';
                    document.getElementById('editContraceptiveMedSearch').value = '';
                    document.getElementById('editContraceptiveMedName').value = '';
                    document.getElementById('editContraceptiveMedConcentration').value = '';
                    document.getElementById('editContraceptiveQuantity').value = '';
                    
                    const stockRow = document.getElementById('editContraceptiveStockMedRow');
                    if (stockRow) stockRow.style.display = 'none';
                }
                
                const labelEl = document.getElementById('editContraceptiveDurationLabel');
                const durationInput = document.getElementById('editContraceptiveDurationDays');
                if (labelEl && durationInput) {
                    if (detectedUnit === 'years') {
                        labelEl.innerText = 'Duração (em anos)';
                        durationInput.placeholder = 'Ex: 5';
                        durationInput.value = info.durationDays ? Math.round(info.durationDays / 365) : '';
                    } else if (detectedUnit === 'months') {
                        labelEl.innerText = 'Duração (em meses)';
                        durationInput.placeholder = 'Ex: 3';
                        durationInput.value = info.durationDays ? Math.round(info.durationDays / 30) : '';
                    } else {
                        labelEl.innerText = 'Duração (em dias)';
                        durationInput.placeholder = 'Ex: 30';
                        durationInput.value = info.durationDays || '';
                    }
                }
                
                document.getElementById('editContraceptiveAppliedDate').value = info.appliedDate ? info.appliedDate.split('T')[0] : '';
                updateContraceptiveExpiryPreview('edit');
            } else {
                usesCheckbox.checked = false;
                document.getElementById('editContraceptiveDetails').style.display = 'none';
                document.getElementById('editContraceptiveMethod').value = '';
                document.getElementById('editContraceptiveAppliedDate').value = '';
                document.getElementById('editContraceptiveDurationDays').value = '';
                document.getElementById('editContraceptiveMedId').value = '';
                document.getElementById('editContraceptiveMedSearch').value = '';
                document.getElementById('editContraceptiveMedName').value = '';
                document.getElementById('editContraceptiveMedConcentration').value = '';
                document.getElementById('editContraceptiveQuantity').value = '';
                
                const stockRow = document.getElementById('editContraceptiveStockMedRow');
                if (stockRow) stockRow.style.display = 'none';
            }
        }

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
                    quantity: prog.quantity,
                    doseQuantity: prog.doseQuantity,
                    doseUnit: prog.doseUnit,
                    frequency: prog.frequency,
                    timesPerDay: prog.timesPerDay,
                    prescription: prog.prescription || null,
                    administrationInstructions: prog.administrationInstructions
                });
            });
        }
        
        const editPrescriberFields = [
            'editBuilderPrescriberName', 'editBuilderPrescriberCpf', 'editBuilderPrescriberCouncil',
            'editBuilderPrescriberCouncilUF', 'editBuilderPrescriberCouncilNumber', 'editBuilderPrescriptionDate',
            'editBuilderInstructions'
        ];
        editPrescriberFields.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        renderEditBuilderPrograms();

        document.getElementById('viewMode').classList.add('d-none');
        document.getElementById('editMode').classList.remove('d-none');

        toggleProgramasEdit();
        if (typeof toggleContraceptiveFields === 'function') {
            toggleContraceptiveFields('edit');
        }

        if (typeof checkAndToggleBuilderLock === 'function') checkAndToggleBuilderLock(true);
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
        const nameValidation = window.validateFullName(nomeEdit);
        if (!nameValidation.valid) {
            errors.push({ message: nameValidation.message, type: 'warning' });
        } else {
            nomeEdit = nameValidation.formattedName;
        }

        // 2. Documentos (Pelo menos um e validar se preenchido)
        if (!cpfEdit && !cnsEdit) {
            errors.push({ message: "É obrigatório informar pelo menos um documento (CPF ou CNS).", type: 'warning' });
        } else {
            if (cpfEdit && !window.isValidCPF(cpfEdit)) {
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
            const domCategories = Array.from(document.querySelectorAll('input[id^="editProg"]')).map(cb => cb.value);
            const checkedCategories = Array.from(document.querySelectorAll('input[id^="editProg"]:checked')).map(cb => cb.value);
            const allCategories = [...new Set(currentEditPatientPrograms.map(p => p.category))];

            allCategories.forEach(category => {
                // Pula categorias que estão no DOM mas o usuário desmarcou
                if (domCategories.includes(category) && !checkedCategories.includes(category)) {
                    return;
                }
                
                const categoryPrograms = currentEditPatientPrograms.filter(p => p.category === category);
                const groupedByRx = {};

                categoryPrograms.forEach(p => {
                    const rx = p.prescription || {};
                    const rxKey = rx.prescriberName ? `${rx.prescriberName}_${rx.prescriberCouncilNumber}_${rx.prescriberCouncilUF}_${rx.prescriptionDate}` : 'no-prescription';
                    if (!groupedByRx[rxKey]) {
                        groupedByRx[rxKey] = {
                            prescription: rx.prescriberName ? rx : null,
                            items: []
                        };
                    }
                    groupedByRx[rxKey].items.push({
                        medicationId: p.medicationId,
                        medicationName: p.medicationName,
                        concentration: p.concentration,
                        quantity: p.quantity,
                        doseQuantity: p.doseQuantity,
                        doseUnit: p.doseUnit,
                        frequency: p.frequency,
                        timesPerDay: p.timesPerDay,
                        administrationInstructions: p.administrationInstructions
                    });
                });

                const medications = Object.values(groupedByRx);

                if (medications.length > 0) {
                    enrollments.push({
                        category: category,
                        medications: medications
                    });
                }
            });

            // Inclui as categorias checadas que não têm nenhum medicamento ainda
            checkedCategories.forEach(category => {
                if (!allCategories.includes(category)) {
                    enrollments.push({ category: category, medications: [] });
                }
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

        let contraceptiveInfo = null;
        const usesContraceptive = document.getElementById('editUsesContraceptive') && document.getElementById('editUsesContraceptive').checked;
        if (usesContraceptive) {
            const methodSelect = document.getElementById('editContraceptiveMethod');
            const selectedOption = methodSelect.options[methodSelect.selectedIndex];
            const unit = selectedOption ? selectedOption.getAttribute('data-unit') : 'days';
            const rawDuration = parseInt(document.getElementById('editContraceptiveDurationDays').value) || 0;
            
            let durationInDays = rawDuration;
            if (unit === 'years') {
                durationInDays = rawDuration * 365;
            } else if (unit === 'months') {
                durationInDays = rawDuration * 30;
            }

            const method = methodSelect.value;
            const appliedDate = document.getElementById('editContraceptiveAppliedDate').value;
            const medId = document.getElementById('editContraceptiveMedId').value || null;
            const medName = document.getElementById('editContraceptiveMedName').value || null;
            const medConcentration = document.getElementById('editContraceptiveMedConcentration').value || null;
            const quantity = parseInt(document.getElementById('editContraceptiveQuantity').value) || null;

            contraceptiveInfo = {
                active: true,
                medicationId: medId,
                medicationName: medId ? `${medName} (${medConcentration})` : method,
                appliedDate: appliedDate ? new Date(appliedDate + 'T00:00:00').toISOString() : null,
                durationDays: durationInDays,
                quantity: quantity
            };
        }

        const payload = {
            name: nomeEdit,
            cpf: cpfEdit === "" ? null : cpfEdit.replace(/\D/g, ''),
            cns: cnsEdit === "" ? null : cnsEdit.replace(/\D/g, ''),
            birthDate: birthDateISO,
            external: isExternal,
            status: document.getElementById('editStatus').checked,
            phones: phonesList,
            enrollments: enrollments,
            acsId: isExternal ? null : (document.getElementById('editPatientAcs').value || null),
            gender: document.getElementById('editGender').value || 'IGNORADO',
            contraceptiveInfo: contraceptiveInfo
        };

        setLoading('btnUpdatePatient', true);
        try {
            await window.apiClient.put(`/patients/${id}`, payload);
            showToast('Prontuário atualizado com sucesso!');
            window.dispatchEvent(new Event('patientsChanged'));
            closeModal();
            searchPatients();
        } catch (error) {
            const status = error.status;
            if (status === 422 && error.data) {
                const errorData = error.data;
                if (errorData.errors && errorData.errors.length > 0) {
                    showToast(errorData.errors[0].message, 'error');
                } else {
                    showToast(errorData.message || 'Existem campos inválidos no formulário.', 'error');
                }
            } else if (error.data && error.data.message) {
                showToast(error.data.message, 'error');
            } else {
                showToast('Erro ao atualizar. Verifique se o CPF ou CNS já estão em uso por outro paciente ou se há erro de conexão.', 'error');
            }
        } finally {
            setLoading('btnUpdatePatient', false);
        }
    }

    async function toggleStatus(id) {
        if (!confirm('Tem a certeza que deseja alterar o status deste paciente?')) return;

        try {
            await window.apiClient.patch(`/patients/${id}/status`);
            showToast('Status atualizado com sucesso!');
            window.dispatchEvent(new Event('patientsChanged'));
            searchPatients();
        } catch (error) {
            console.error(error);
            showToast('Erro ao alterar o status no servidor.', 'error');
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

    var floatingSearchTimeout;
    var suggestionsList;

    document.addEventListener('input', function (e) {
        if (e.target.id === 'searchInput') {
            let val = e.target.value;
            
            clearTimeout(floatingSearchTimeout);
            suggestionsList = document.getElementById('patientPageSuggestions');
            
            if (val.length >= 3) {
                floatingSearchTimeout = setTimeout(() => fetchFloatingSuggestions(val), 400);
            } else {
                if (suggestionsList) suggestionsList.style.display = 'none';
            }
        }
    });

    async function fetchFloatingSuggestions(query) {
        if (!suggestionsList) return;

        const statusFilter = document.getElementById('statusFilter');
        const statusFiltro = statusFilter ? statusFilter.value : 'ativos';

        try {
            const cleanQuery = /^[\d.\-]+$/.test(query) ? query.replace(/\D/g, '') : query;
            const { data: pageData } = await window.apiClient.get(`/patients?query=${encodeURIComponent(cleanQuery)}&status=${statusFiltro}`);
            const patients = pageData.content || [];
            suggestionsList.innerHTML = '';

            if (patients.length === 0) {
                suggestionsList.innerHTML = '<li class="floating-suggestion-empty">Nenhum paciente encontrado.</li>';
            } else {
                patients.forEach(p => {
                    const li = document.createElement('li');
                    li.className = 'floating-suggestion-item';

                    const cpfBonito = p.cpf ? window.applyCpfMask(p.cpf) : 'Sem CPF';

                    li.innerHTML = `
                    <span class="floating-suggestion-name">${escapeHTML(p.name)}</span>
                    <span class="floating-suggestion-cpf">CPF: ${escapeHTML(cpfBonito)}</span>
                `;

                    li.onclick = () => {
                        document.getElementById('searchInput').value = p.name;
                        suggestionsList.style.display = 'none';

                        currentPatients = [p];
                        
                        // Update pagination UI explicitly for single selection
                        const pageInfoEl = document.getElementById('patientPageInfo');
                        const currentPgEl = document.getElementById('patientCurrentPage');
                        const btnPrev = document.getElementById('btnPrevPatient');
                        const btnNext = document.getElementById('btnNextPatient');
                        
                        if (pageInfoEl) pageInfoEl.innerText = `1-1 de 1`;
                        if (currentPgEl) currentPgEl.innerText = `Pág 1 de 1`;
                        if (btnPrev) btnPrev.disabled = true;
                        if (btnNext) btnNext.disabled = true;

                        renderPatientTable();
                        openPatientModal(String(p.id));
                    };
                    suggestionsList.appendChild(li);
                });
            }
            suggestionsList.style.display = 'block';
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
    window.toggleBuilderFrequencyInput = toggleBuilderFrequencyInput;
    window.toggleBuilderDuration = toggleBuilderDuration;

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
    window.applyCnsMask = applyCnsMask;
    window.applyMultiPhoneMask = applyMultiPhoneMask;
    window.fetchFloatingSuggestions = fetchFloatingSuggestions;
    window.isValidCNS = isValidCNS;
    window.updateContraceptiveExpiryPreview = function (prefix) {
        const methodSelect = document.getElementById(`${prefix}ContraceptiveMethod`);
        const dateInput = document.getElementById(`${prefix}ContraceptiveAppliedDate`);
        const durationInput = document.getElementById(`${prefix}ContraceptiveDurationDays`);
        const previewDiv = document.getElementById(`${prefix}ContraceptiveExpiryPreview`);
        
        if (!methodSelect || !dateInput || !durationInput || !previewDiv) return;

        const selectedOption = methodSelect.options[methodSelect.selectedIndex];
        const unit = selectedOption ? selectedOption.getAttribute('data-unit') : 'days';
        const dateVal = dateInput.value;
        const durationVal = parseInt(durationInput.value);

        if (!dateVal || isNaN(durationVal) || durationVal <= 0) {
            previewDiv.style.display = 'none';
            return;
        }

        if (unit !== 'years' && unit !== 'months') {
            previewDiv.style.display = 'none';
            return;
        }

        const baseDate = new Date(dateVal + 'T00:00:00');
        const expiryDate = new Date(baseDate);

        if (unit === 'years') {
            expiryDate.setFullYear(expiryDate.getFullYear() + durationVal);
        } else if (unit === 'months') {
            expiryDate.setMonth(expiryDate.getMonth() + durationVal);
        }

        const dateStr = expiryDate.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
        previewDiv.innerText = `Fim da eficácia: ${dateStr}`;
        previewDiv.style.display = 'block';
    };

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
            await window.apiClient.delete(`/patients/${id}`);
            showToast(`Paciente "${name}" excluído com sucesso!`);
            closeModal();
            window.dispatchEvent(new Event('patientsChanged'));
            searchPatients(); // Recarrega a lista de pacientes
        } catch (error) {
            console.error(error);
            if (error.data && error.data.message) {
                showToast(error.data.message, 'error');
            } else {
                showToast('Erro ao excluir paciente. Verifique sua conexão com o servidor.', 'error');
            }
        }
    };

    window.toggleContraceptiveFields = function (prefix) {
        const genderSelect = document.getElementById(prefix === 'new' ? 'newGender' : 'editGender');
        const progMulher = document.getElementById(prefix === 'new' ? 'regProgMulher' : 'editProgMulher');
        const isMulherChecked = progMulher ? progMulher.checked : false;
        const section = document.getElementById(`${prefix}ContraceptiveSection`);
        
        if (!genderSelect || !section) return;

        if (genderSelect.value === 'FEMININO' && isMulherChecked) {
            section.style.display = 'block';
        } else {
            section.style.display = 'none';
            const usesCheckbox = document.getElementById(`${prefix}UsesContraceptive`);
            if (usesCheckbox) {
                usesCheckbox.checked = false;
                toggleContraceptiveDetails(prefix);
            }
        }
    };

    window.toggleContraceptiveDetails = function (prefix) {
        const usesCheckbox = document.getElementById(`${prefix}UsesContraceptive`);
        const details = document.getElementById(`${prefix}ContraceptiveDetails`);
        if (!usesCheckbox || !details) return;

        if (usesCheckbox.checked) {
            details.style.display = 'block';
        } else {
            details.style.display = 'none';
            const methodSelect = document.getElementById(`${prefix}ContraceptiveMethod`);
            const dateInput = document.getElementById(`${prefix}ContraceptiveAppliedDate`);
            const durationInput = document.getElementById(`${prefix}ContraceptiveDurationDays`);
            if (methodSelect) methodSelect.value = '';
            if (dateInput) dateInput.value = '';
            if (durationInput) durationInput.value = '';
        }
    };

    window.autoFillContraceptiveDuration = function (prefix) {
        const methodSelect = document.getElementById(`${prefix}ContraceptiveMethod`);
        const durationInput = document.getElementById(`${prefix}ContraceptiveDurationDays`);
        const labelEl = document.getElementById(`${prefix}ContraceptiveDurationLabel`);
        
        if (!methodSelect || !durationInput || !labelEl) return;

        const selectedOption = methodSelect.options[methodSelect.selectedIndex];
        const days = selectedOption.getAttribute('data-days');
        const unit = selectedOption.getAttribute('data-unit') || 'days';

        if (unit === 'years') {
            labelEl.innerText = 'Duração (em anos)';
            durationInput.placeholder = 'Ex: 5';
            if (days) durationInput.value = Math.round(parseInt(days) / 365);
        } else if (unit === 'months') {
            labelEl.innerText = 'Duração (em meses)';
            durationInput.placeholder = 'Ex: 3';
            if (days) durationInput.value = Math.round(parseInt(days) / 30);
        } else {
            labelEl.innerText = 'Duração (em dias)';
            durationInput.placeholder = 'Ex: 30';
            if (days) durationInput.value = days;
        }

        if (!days) {
            durationInput.value = '';
        }

        const stockRow = document.getElementById(`${prefix}ContraceptiveStockMedRow`);
        if (stockRow) {
            const method = methodSelect.value;
            if (['Pílula Oral', 'Injetável Trimestral', 'Injetável Mensal', 'Outro'].includes(method)) {
                stockRow.style.display = 'flex';
            } else {
                stockRow.style.display = 'none';
                const medSearch = document.getElementById(`${prefix}ContraceptiveMedSearch`);
                const medId = document.getElementById(`${prefix}ContraceptiveMedId`);
                const medName = document.getElementById(`${prefix}ContraceptiveMedName`);
                const medConcentration = document.getElementById(`${prefix}ContraceptiveMedConcentration`);
                const qty = document.getElementById(`${prefix}ContraceptiveQuantity`);
                if (medSearch) medSearch.value = '';
                if (medId) medId.value = '';
                if (medName) medName.value = '';
                if (medConcentration) medConcentration.value = '';
                if (qty) qty.value = '';
            }
        }

        updateContraceptiveExpiryPreview(prefix);
    };

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

