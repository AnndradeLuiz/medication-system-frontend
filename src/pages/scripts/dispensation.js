(function () {
    let loggedpractitionerName = '';
    let loggedpractitionerId = '';
    let searchTimeout = null;
    let medicationList = [];
    let requestItems = [];
    let dispensationList = [];
    let currentEditDispItems = [];
    let originalEditDispQuantities = {};
    let currentEditDispPatientId = "";
    let currentEditDisppractitionerId = "";
    let currentEditDispThirdPerson = null;
    let currentEditDispPatientData = null;
    let currentDispensePatientData = null;
    let lastDispensationResponse = null;

    let selectedPatientIsExternal = false;

    function setupKeyboardNavigation(inputId, suggestionsId) {
        const input = document.getElementById(inputId);
        const list = document.getElementById(suggestionsId);
        if (!input || !list) return;

        input.setAttribute('role', 'combobox');
        input.setAttribute('aria-autocomplete', 'list');
        input.setAttribute('aria-expanded', 'false');
        input.setAttribute('aria-controls', suggestionsId);
        list.setAttribute('role', 'listbox');

        const observer = new MutationObserver(() => {
            const isVisible = list.style.display !== 'none';
            input.setAttribute('aria-expanded', isVisible ? 'true' : 'false');
        });
        observer.observe(list, { attributes: true, attributeFilter: ['style'] });

        input.addEventListener('keydown', function (e) {
            if (list.style.display === 'none' || !list.children.length) return;

            const items = Array.from(list.children).filter(li => !li.classList.contains('floating-suggestion-empty') && !li.classList.contains('medication-not-found-item') && !li.classList.contains('patient-not-found-item'));
            if (items.length === 0) return;

            let activeIndex = items.findIndex(li => li.classList.contains('focused'));

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (activeIndex !== -1) {
                    items[activeIndex].classList.remove('focused');
                    items[activeIndex].removeAttribute('aria-selected');
                }
                activeIndex = (activeIndex + 1) % items.length;
                items[activeIndex].classList.add('focused');
                items[activeIndex].setAttribute('aria-selected', 'true');
                items[activeIndex].scrollIntoView({ block: 'nearest' });
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (activeIndex !== -1) {
                    items[activeIndex].classList.remove('focused');
                    items[activeIndex].removeAttribute('aria-selected');
                }
                activeIndex = (activeIndex - 1 + items.length) % items.length;
                items[activeIndex].classList.add('focused');
                items[activeIndex].setAttribute('aria-selected', 'true');
                items[activeIndex].scrollIntoView({ block: 'nearest' });
            } else if (e.key === 'Enter') {
                if (activeIndex !== -1) {
                    e.preventDefault();
                    items[activeIndex].click();
                }
            }
        });
    }

    async function loadMedications() {
        try {
            const { data } = await window.apiClient.get('/medications');
            medicationList = data || [];
            populateSelects();
            console.log("Estoque atualizado.");
        } catch (error) {
            console.error("Erro ao carregar medicamentos:", error);
        }
    }

    async function loadDispensations() {
        try {
            const { data: pageData } = await window.apiClient.get('/dispensations?size=200');
            dispensationList = pageData.content || [];
            console.log("Dispensações carregadas do banco:", dispensationList);
            setupEditDispensationAutocomplete();
        } catch (error) {
            console.error("Erro ao carregar histórico de dispensações:", error);
        }
    }

    let isDispensationModuleInitialized = false;
    window.initDispensationModule = function () {
        if (isDispensationModuleInitialized) return;
        isDispensationModuleInitialized = true;

        loggedpractitionerName = sessionStorage.getItem('sgdm_userName');
        loggedpractitionerId = sessionStorage.getItem('sgdm_practitionerId');

        loadDispensations();
        toggleThirdPartySection();
        toggleThirdPartySection();

        setupKeyboardNavigation('dispensePatientInput', 'patientSuggestions');
        setupKeyboardNavigation('inputBuscaMedEdicao', 'editDispAddMedSuggestions');
    };

    document.addEventListener('input', function (e) {
        if (e.target.id === 'dispensePatientInput') {
            let val = e.target.value;
            if (/^\d/.test(val)) {
                e.target.value = window.applyCpfMask(val);
                val = e.target.value;
            }
            clearTimeout(searchTimeout);
            if (val.length >= 3) {
                searchTimeout = setTimeout(() => fetchPatientSuggestions(val), 400);
            } else {
                const sugg = document.getElementById('patientSuggestions');
                if (sugg) sugg.style.display = 'none';
            }
        } else if (e.target.id === 'tpDocument') {
            e.target.value = window.applyCpfMask(e.target.value);
        } else if (e.target.id === 'dispenseMedInput') {
            const query = e.target.value.toLowerCase();
            const list = document.getElementById('medSuggestions');

            if (query.length < 2) {
                if (list) list.style.display = 'none';
                return;
            }

            let allowedCategories = null;
            if (currentDispensePatientData) {
                allowedCategories = new Set(['BASIC_PHARMACY', 'FARMACIA_BASICA']);
                if (currentDispensePatientData.enrollments) {
                    currentDispensePatientData.enrollments.forEach(enr => {
                        if (enr.category) allowedCategories.add(enr.category);
                    });
                }
            }

            const filtered = medicationList.filter(m => {
                if (!m.activeIngredient || !m.activeIngredient.toLowerCase().includes(query)) return false;

                if (!allowedCategories) return true;

                if (selectedPatientIsExternal) {
                    return m.programCategory && (m.programCategory === 'FARMACIA_BASICA' || m.programCategory === 'BASIC_PHARMACY');
                }

                if (!m.programCategory) return true;

                return allowedCategories.has(m.programCategory);
            });

            if (list) {
                list.innerHTML = '';

                if (filtered.length === 0) {
                    list.innerHTML = '<li class="medication-not-found-item">Medicamento não encontrado.</li>';
                } else {
                    filtered.forEach(m => {
                        const li = document.createElement('li');
                        li.className = 'medication-suggestion-li';
                        li.innerHTML = `<span class="medication-suggestion-name">${escapeHTML(m.activeIngredient)}</span> <span class="medication-suggestion-concentration">(${escapeHTML(m.concentration)})</span>`;

                        li.onclick = () => {
                            document.getElementById('dispenseMedInput').value = `${m.activeIngredient} (${m.concentration})`;
                            document.getElementById('dispenseMedId').value = m.id;
                            list.style.display = 'none';
                        };
                        list.appendChild(li);
                    });
                }
                list.style.display = 'block';
            }
        }
    });

    async function fetchPatientSuggestions(query) {
        const list = document.getElementById('patientSuggestions');
        try {
            const { data: pageData } = await window.apiClient.get(`/patients?query=${encodeURIComponent(query)}&status=ativos`);
            const patients = pageData.content || [];
            list.innerHTML = '';

            if (patients.length === 0) {
                list.innerHTML = '<li class="patient-not-found-item">Nenhum paciente ativo encontrado.</li>';
            } else {
                patients.forEach(p => {
                    const li = document.createElement('li');
                    li.setAttribute('role', 'option');
                    li.className = 'patient-suggestion-li';

                    const cpfBonito = p.cpf ? window.applyCpfMask(p.cpf) : 'Sem CPF';

                    li.innerHTML = `
                    <div class="d-flex flex-column">
                        <span class="fw-600 text-main fs-15">${escapeHTML(p.name)}</span>
                        <span class="text-muted fs-13">CPF: ${escapeHTML(cpfBonito)}</span>
                    </div>
                `;

                    li.onclick = () => {
                        document.getElementById('dispensePatientId').value = p.id;
                        document.getElementById('selectedPatientInfo').innerHTML = `
                        <span class="patient-card-info-title">${p.name}</span>
                        <span class="patient-card-info-cpf">CPF: ${cpfBonito}</span>
                    `;
                        document.getElementById('dispensePatientInput').style.display = 'none';
                        list.style.display = 'none';
                        document.getElementById('selectedPatientCard').style.display = 'flex';

                        selectedPatientIsExternal = p.external === true;
                        currentDispensePatientData = p;

                        // Agrupar receitas recorrentes
                        let uniqueRecipes = [];
                        if (p.enrollments && p.enrollments.length > 0) {
                            p.enrollments.forEach(enr => {
                                if (enr.medications) {
                                    enr.medications.forEach(med => {
                                        const prescription = med.prescription;
                                        if (prescription && prescription.prescriptionDate) {
                                            const key = `${prescription.prescriberName || ''}_${prescription.prescriberCouncilNumber || ''}_${prescription.prescriberCouncilUF || ''}_${prescription.prescriptionDate}`;
                                            let existing = uniqueRecipes.find(r => r.key === key);
                                            if (!existing) {
                                                existing = {
                                                    key: key,
                                                    prescription: prescription,
                                                    medications: []
                                                };
                                                uniqueRecipes.push(existing);
                                            }
                                            if (med.items) {
                                                med.items.forEach(item => {
                                                    existing.medications.push({
                                                        medicationId: item.medicationId,
                                                        medicationName: item.medicationName,
                                                        concentration: item.concentration,
                                                        quantity: item.quantity,
                                                        doseQuantity: item.doseQuantity,
                                                        doseUnit: item.doseUnit,
                                                        frequency: item.frequency,
                                                        timesPerDay: item.timesPerDay,
                                                        administrationInstructions: item.administrationInstructions
                                                    });
                                                });
                                            }
                                        }
                                    });
                                }
                            });
                        }

                        // Adicionar anticoncepcional ativo de estoque como receita recorrente
                        if (p.contraceptiveInfo && p.contraceptiveInfo.active && p.contraceptiveInfo.medicationId) {
                            const rxDate = p.contraceptiveInfo.appliedDate || new Date().toISOString();
                            const key = `ANTICONCEPCIONAL_${p.contraceptiveInfo.medicationId}_${rxDate}`;
                            
                            let medName = p.contraceptiveInfo.medicationName || 'Anticoncepcional';
                            let concentration = '';
                            const match = medName.match(/^(.*?)\s*\((.*?)\)$/);
                            if (match) {
                                medName = match[1];
                                concentration = match[2];
                            }

                            uniqueRecipes.push({
                                key: key,
                                prescription: {
                                    prescriptionDate: rxDate,
                                    prescriberName: "Saúde da Mulher (UBS)",
                                    prescriberCpf: "",
                                    prescriberCouncil: "CRM",
                                    prescriberCouncilUF: "UF",
                                    prescriberCouncilNumber: "12345"
                                },
                                medications: [{
                                    medicationId: p.contraceptiveInfo.medicationId,
                                    medicationName: medName,
                                    concentration: concentration,
                                    quantity: p.contraceptiveInfo.quantity || 1,
                                    doseQuantity: 1,
                                    doseUnit: "comprimido(s)",
                                    frequency: "1 vez ao dia",
                                    timesPerDay: 1,
                                    administrationInstructions: "Uso contínuo (Anticoncepcional)"
                                }]
                            });
                        }

                        const recurrentContainer = document.getElementById('autoFillRecurrentContainer');
                        const recurrentSelect = document.getElementById('selectRecurrentPrescription');
                        if (recurrentContainer && recurrentSelect) {
                            recurrentSelect.innerHTML = '<option value="">Selecione uma receita...</option>';
                            if (uniqueRecipes.length > 0) {
                                window.currentPatientRecipes = uniqueRecipes;
                                uniqueRecipes.forEach((recipe, idx) => {
                                    const rx = recipe.prescription;
                                    const rxDate = new Date(rx.prescriptionDate).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
                                    const opt = document.createElement('option');
                                    opt.value = idx;
                                    if (rx.prescriberName === "Saúde da Mulher (UBS)") {
                                        opt.innerText = `Método Contraceptivo: ${recipe.medications[0].medicationName} (${recipe.medications[0].concentration}) - Qtd: ${recipe.medications[0].quantity} un`;
                                    } else {
                                        opt.innerText = `Dr(a). ${rx.prescriberName} - ${rx.prescriberCouncil}/${rx.prescriberCouncilUF} ${rx.prescriberCouncilNumber} (Receita de ${rxDate})`;
                                    }
                                    recurrentSelect.appendChild(opt);
                                });
                                recurrentContainer.style.display = 'block';
                            } else {
                                recurrentContainer.style.display = 'none';
                                window.currentPatientRecipes = [];
                            }
                        }

                        // Habilita os campos de medicamento
                        document.getElementById('dispenseMedInput').disabled = false;
                        document.getElementById('dispenseMedInput').placeholder = "Digite o nome do medicamento...";
                        document.getElementById('medQuantity').disabled = false;
                        document.getElementById('medDuration').disabled = false;
                        document.getElementById('medInstructions').disabled = false;
                        document.getElementById('btnAddItem').disabled = false;
                    };
                    list.appendChild(li);
                });
            }
            list.style.display = 'block';
        } catch (error) {
            console.error("Erro no autocompletar:", error);
        }
    }

    document.addEventListener('click', function (e) {
        if (e.target.id !== 'dispensePatientInput') {
            const list = document.getElementById('patientSuggestions');
            if (list) list.style.display = 'none';
        }
    });

    function clearPatientSelection() {
        document.getElementById('dispensePatientId').value = '';
        document.getElementById('dispensePatientInput').value = '';
        document.getElementById('selectedPatientCard').style.display = 'none';
        document.getElementById('dispensePatientInput').style.display = 'block';
        document.getElementById('dispensePatientInput').focus();
        selectedPatientIsExternal = false;
        currentDispensePatientData = null;
        const containerAutoFill = document.getElementById('autoFillProgramsContainer');
        if (containerAutoFill) containerAutoFill.style.display = 'none';
        const recurrentContainer = document.getElementById('autoFillRecurrentContainer');
        const recurrentSelect = document.getElementById('selectRecurrentPrescription');
        if (recurrentContainer) recurrentContainer.style.display = 'none';
        if (recurrentSelect) recurrentSelect.innerHTML = '<option value="">Selecione uma receita...</option>';
        window.currentPatientRecipes = [];

        // Desabilita e limpa os campos de medicamento
        document.getElementById('dispenseMedInput').disabled = true;
        document.getElementById('dispenseMedInput').value = '';
        document.getElementById('dispenseMedId').value = '';
        document.getElementById('dispenseMedInput').placeholder = "Selecione um paciente primeiro...";
        document.getElementById('medQuantity').disabled = true;
        document.getElementById('medDuration').disabled = true;
        document.getElementById('medInstructions').disabled = true;
        document.getElementById('btnAddItem').disabled = true;
    }

    function toggleThirdPartySection() {
        const isChecked = document.getElementById('isThirdParty').checked;
        const section = document.getElementById('thirdPartySection');

        if (section) {
            if (isChecked) {
                section.classList.remove('d-none');
            } else {
                section.classList.add('d-none');
                const tpName = document.getElementById('tpName');
                const tpDoc = document.getElementById('tpDocument');
                const tpObs = document.getElementById('tpObservation');
                if (tpName) tpName.value = '';
                if (tpDoc) tpDoc.value = '';
                if (tpObs) tpObs.value = '';
            }
        }
    }

    function populateSelects() {
        const selectLot = document.getElementById('medicationSelectLot');
        let options = '<option value="">Selecione o medicamento no estoque...</option>';

        medicationList.forEach(med => {
            options += `<option value="${med.id}">${med.activeIngredient} (${med.concentration})</option>`;
        });

        if (selectLot) selectLot.innerHTML = options;
    }



    document.addEventListener('click', function (e) {
        if (e.target.id !== 'dispenseMedInput') {
            const medList = document.getElementById('medSuggestions');
            if (medList) medList.style.display = 'none';
        }
    });

    async function fetchMedicationDetails(id) {
        try {
            const { data } = await window.apiClient.get(`/medications/${id}`);
            const med = data;
            const index = medicationList.findIndex(m => m.id === id);
            if (index !== -1) {
                medicationList[index] = med;
            } else {
                medicationList.push(med);
            }
            return med;
        } catch (error) {
            console.error("Erro ao procurar detalhes no banco:", error);
        }
        return null;
    }

    function calculateFEFOPreview(med, quantity) {
        let amountNeeded = quantity;
        let selectedLots = [];
        let totalStock = 0;

        if (!med.lots || med.lots.length === 0) {
            return { success: false, stock: 0 };
        }

        const sortedLots = [...med.lots].sort((a, b) => new Date(a.expirationDate) - new Date(b.expirationDate));

        for (let lot of sortedLots) {
            let quantidadeNoLote = lot.currentQuantity || 0;
            totalStock += quantidadeNoLote;

            if (amountNeeded <= 0) break;
            if (quantidadeNoLote === 0) continue;

            let taken = Math.min(quantidadeNoLote, amountNeeded);
            selectedLots.push(`${lot.lotCode} (${taken} unidades)`);
            amountNeeded -= taken;
        }

        if (amountNeeded > 0) {
            return { success: false, stock: totalStock };
        }

        return { success: true, previewString: selectedLots.join("<br>") };
    }

    async function addItemDispensation() {
        const medId = document.getElementById('dispenseMedId').value;
        const quantity = parseInt(document.getElementById('medQuantity').value);
        const duration = document.getElementById('medDuration').value;
        const instructions = document.getElementById('medInstructions').value;

        if (!medId) {
            showToast("Pesquise e selecione um medicamento na lista sugerida.", "error");
            return;
        }
        if (isNaN(quantity) || quantity <= 0) {
            showToast("Informe uma quantidade maior que zero.", "error");
            return;
        }

        const med = await fetchMedicationDetails(medId) || medicationList.find(m => m.id === medId);

        if (!med) {
            showToast("Erro: Medicamento não encontrado no servidor.", 'error');
            return;
        }

        if (selectedPatientIsExternal && (!med.programCategory || (med.programCategory !== 'FARMACIA_BASICA' && med.programCategory !== 'BASIC_PHARMACY'))) {
            const catStr = med.programCategory || 'Nenhuma';
            showToast(`BLOQUEADO: Este paciente é de outra UBS.\nEle só tem permissão para retirar itens da Farmácia Básica.\n\nO medicamento '${med.activeIngredient} ${med.concentration}' pertence às categorias: ${catStr}.`, 'error');
            return;
        }

        const fefoResult = calculateFEFOPreview(med, quantity);

        if (!fefoResult.success) {
            showToast(`Estoque insuficiente! Temos apenas ${fefoResult.stock} unidades de ${med.activeIngredient} ${med.concentration}.`, 'error');
            return;
        }

        requestItems.push({
            medicationId: medId,
            medicationActiveIngredient: med.activeIngredient,
            medicationConcentration: med.concentration,
            quantity: quantity,
            previewLots: fefoResult.previewString,
            duration: duration,
            instructions: instructions
        });

        document.getElementById('dispenseMedId').value = "";
        document.getElementById('dispenseMedInput').value = "";
        document.getElementById('medQuantity').value = "1";
        document.getElementById('medDuration').value = "";
        document.getElementById('medInstructions').value = "";

        updateTable();
    }

    function updateTable() {
        const tbody = document.getElementById('itemsBody');
        const btnFinalize = document.getElementById('btnFinalize');

        if (!tbody) return;

        tbody.innerHTML = '';

        if (requestItems.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" class="empty-msg text-center" style="vertical-align: middle;">Nenhum medicamento adicionado à lista ainda.</td></tr>`;
            if (btnFinalize) btnFinalize.classList.add('d-none');
        } else {
            if (btnFinalize) btnFinalize.classList.remove('d-none');
            const fragment = document.createDocumentFragment();

            requestItems.forEach((item, index) => {
                const tr = document.createElement('tr');
                let posologyHtml = '';
                if (item.duration || item.instructions) {
                    posologyHtml = `<div class="mt-5" style="font-size: 11px; color: #64748b; background: #f8fafc; padding: 4px; border-radius: 4px; border: 1px dashed #cbd5e1;">`;
                    if (item.duration) posologyHtml += `<i class="fa-regular fa-clock"></i> ${escapeHTML(item.duration)} dias `;
                    if (item.instructions) posologyHtml += `<br><i class="fa-solid fa-notes-medical"></i> ${escapeHTML(item.instructions)}`;
                    posologyHtml += `</div>`;
                }

                tr.innerHTML = `
                <td class="text-main text-left">
                    <span class="d-block fw-600 fs-15">${escapeHTML(item.medicationActiveIngredient)}</span>
                    <span class="text-muted fs-13 fw-400">${escapeHTML(item.medicationConcentration)}</span>
                    ${posologyHtml}
                </td>
                <td class="text-success fw-500 fs-14 text-center">
                    ${item.previewLots}
                </td>
                <td class="text-center">
                    ${item.quantity} unidades
                </td>
                <td class="text-center">
                    <button type="button" class="btn-danger-icon" onclick="removeItem(${index})" title="Remover item">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>
            `;
                fragment.appendChild(tr);
            });
            tbody.appendChild(fragment);
        }
    }

    window.removeItem = function (index) {
        requestItems.splice(index, 1);
        updateTable();
    }

    window.autoFillRecurrentPrescription = async function () {
        const select = document.getElementById('selectRecurrentPrescription');
        if (!select || select.value === "") return;

        const recipeIdx = parseInt(select.value);
        if (isNaN(recipeIdx) || !window.currentPatientRecipes || !window.currentPatientRecipes[recipeIdx]) return;

        const selectedRecipe = window.currentPatientRecipes[recipeIdx];
        const rx = selectedRecipe.prescription;

        // Preenche dados do prescritor
        if (rx.prescriptionDate) {
            document.getElementById('prescriptionDate').value = rx.prescriptionDate.substring(0, 10);
        } else {
            document.getElementById('prescriptionDate').value = '';
        }
        document.getElementById('prescriberName').value = rx.prescriberName || '';
        document.getElementById('prescriberCpf').value = rx.prescriberCpf ? window.applyCpfMask(rx.prescriberCpf) : '';
        document.getElementById('prescriberCouncil').value = rx.prescriberCouncil || '';
        document.getElementById('prescriberCouncilUF').value = rx.prescriberCouncilUF || '';
        document.getElementById('prescriberCouncilNumber').value = rx.prescriberCouncilNumber || '';

        // Limpa a lista de itens atual
        requestItems = [];
        let totalAdded = 0;
        let missingMeds = [];

        for (const enrMed of selectedRecipe.medications) {
            const medId = enrMed.medicationId;
            const quantity = enrMed.quantity;

            if (!medId || !quantity || quantity <= 0) continue;

            const med = await fetchMedicationDetails(medId) || medicationList.find(m => m.id === medId);

            if (!med) {
                missingMeds.push(`Medicamento (ID: ${medId}) não encontrado`);
                continue;
            }

            if (selectedPatientIsExternal && (!med.programCategory || (med.programCategory !== 'FARMACIA_BASICA' && med.programCategory !== 'BASIC_PHARMACY'))) {
                missingMeds.push(`'${med.activeIngredient} ${med.concentration}' (Bloqueado para paciente externo)`);
                continue;
            }

            const fefoResult = calculateFEFOPreview(med, quantity);

            if (!fefoResult.success) {
                missingMeds.push(`'${med.activeIngredient} ${med.concentration}' (Estoque: ${fefoResult.stock}, Precisa: ${quantity})`);
                continue;
            }

            requestItems.push({
                medicationId: medId,
                medicationActiveIngredient: med.activeIngredient,
                medicationConcentration: med.concentration,
                quantity: quantity,
                previewLots: fefoResult.previewString,
                instructions: enrMed.administrationInstructions || ""
            });
            totalAdded++;
        }

        updateTable();

        if (totalAdded > 0) {
            showToast(`${totalAdded} medicamento(s) da receita de uso contínuo carregado(s) com sucesso.`);
        }

        if (missingMeds.length > 0) {
            showToast(`Alguns itens não puderam ser carregados:\n` + missingMeds.join('\n'), 'error');
        }
    }

    window.autoFillPatientPrograms = async function () {
        if (!currentDispensePatientData || !currentDispensePatientData.enrollments) return;

        let totalAdded = 0;
        let missingMeds = [];

        const btnAutoFill = document.querySelector('#autoFillProgramsContainer button');
        if (btnAutoFill) btnAutoFill.disabled = true;

        for (const enr of currentDispensePatientData.enrollments) {
            if (!enr.medications) continue;
            for (const enrMed of enr.medications) {
                const items = enrMed.items || [];
                for (const item of items) {
                    const medId = item.medicationId;
                    const quantity = item.quantity;

                    if (!medId || !quantity || quantity <= 0) continue;

                    const med = await fetchMedicationDetails(medId) || medicationList.find(m => m.id === medId);

                    if (!med) {
                        missingMeds.push(`Medicamento (ID: ${medId}) não encontrado`);
                        continue;
                    }

                    if (selectedPatientIsExternal && (!med.programCategory || (med.programCategory !== 'FARMACIA_BASICA' && med.programCategory !== 'BASIC_PHARMACY'))) {
                        missingMeds.push(`'${med.activeIngredient} ${med.concentration}' (Bloqueado para paciente externo)`);
                        continue;
                    }

                    const fefoResult = calculateFEFOPreview(med, quantity);

                    if (!fefoResult.success) {
                        missingMeds.push(`'${med.activeIngredient} ${med.concentration}' (Estoque: ${fefoResult.stock}, Precisa: ${quantity})`);
                        continue;
                    }

                    const alreadyAdded = requestItems.find(it => it.medicationId === medId);
                    if (alreadyAdded) continue;

                    requestItems.push({
                        medicationId: medId,
                        medicationActiveIngredient: med.activeIngredient,
                        medicationConcentration: med.concentration,
                        quantity: quantity,
                        previewLots: fefoResult.previewString
                    });
                    totalAdded++;
                }
            }
        }

        if (totalAdded > 0) {
            updateTable();
            showToast(`${totalAdded} medicamento(s) do programa inserido(s) com sucesso.`);
        }

        if (missingMeds.length > 0) {
            showToast(`Alguns itens não puderam ser inseridos:\n` + missingMeds.join('\n'), 'error');
        } else if (totalAdded === 0) {
            showToast("Nenhum item válido para inserir.", 'error');
        }

        if (btnAutoFill) btnAutoFill.disabled = false;
    }

    async function finalizeDispensation() {
        const patientId = document.getElementById('dispensePatientId').value;
        const isThirdParty = document.getElementById('isThirdParty').checked;

        if (!patientId) {
            showToast("Por favor, pesquise e clique no nome do paciente na lista de sugestões.");
            return;
        }

        if (requestItems.length === 0) {
            showToast("Adicione pelo menos um medicamento à lista de dispensação.");
            return;
        }

        let thirdPersonData = null;
        if (isThirdParty) {
            const tpName = document.getElementById('tpName').value.trim();
            const tpDoc = document.getElementById('tpDocument').value.replace(/\D/g, '');

            if (!tpName || !tpDoc) {
                showToast("Preencha o Nome e o Documento (CPF) do retirante responsável.");
                return;
            }

            if (typeof window.isValidCPF === 'function' && !window.isValidCPF(tpDoc)) {
                showToast("CPF do retirante inválido.", "error");
                return;
            }

            thirdPersonData = {
                name: tpName,
                cpf: tpDoc,
                observation: document.getElementById('tpObservation').value.trim()
            };
        }

        const itemsForBackend = requestItems.map(item => {
            let backendItem = {
                medicationId: item.medicationId,
                quantity: item.quantity
            };
            if (item.duration) backendItem.duration = parseInt(item.duration) || null;
            if (item.instructions) backendItem.instructions = item.instructions;
            return backendItem;
        });

        let prescriptionData = null;
        const pDate = document.getElementById('prescriptionDate').value;
        const pName = document.getElementById('prescriberName').value.trim();
        const pCpf = document.getElementById('prescriberCpf').value.replace(/\D/g, '');
        const pCouncil = document.getElementById('prescriberCouncil').value;
        const pCouncilUF = document.getElementById('prescriberCouncilUF').value;
        const pCouncilNum = document.getElementById('prescriberCouncilNumber').value.trim();

        if (pDate || pName || pCouncil || pCouncilUF || pCouncilNum) {
            prescriptionData = {
                prescriptionDate: pDate ? new Date(pDate + 'T00:00:00').toISOString() : null,
                prescriberName: pName || null,
                prescriberCpf: pCpf || null,
                prescriberCouncil: pCouncil || null,
                prescriberCouncilUF: pCouncilUF || null,
                prescriberCouncilNumber: pCouncilNum || null
            };
        }

        const payload = {
            practitionerId: loggedpractitionerId,
            patientId: patientId,
            thirdPerson: thirdPersonData,
            prescription: prescriptionData,
            items: itemsForBackend
        };

        setLoading('btnFinalize', true);
        try {
            const { data: responseData } = await window.apiClient.post('/dispensations', payload);
            responseData.patient = {
                name: currentDispensePatientData ? currentDispensePatientData.name : "Não Informado",
                cpf: currentDispensePatientData && currentDispensePatientData.cpf ? currentDispensePatientData.cpf : "Não Informado",
                cns: currentDispensePatientData && currentDispensePatientData.cns ? currentDispensePatientData.cns : "Não Informado"
            };
            showDispensationSummary(responseData);
            showToast("Sucesso! Dispensação registrada e estoques atualizados.");
            clearPatientSelection();
            document.getElementById('isThirdParty').checked = false;
            toggleThirdPartySection();

            document.getElementById('prescriptionDate').value = "";
            document.getElementById('prescriberName').value = "";
            document.getElementById('prescriberCpf').value = "";
            document.getElementById('prescriberCouncil').value = "";
            document.getElementById('prescriberCouncilUF').value = "";
            document.getElementById('prescriberCouncilNumber').value = "";

            requestItems = [];
            updateTable();
            loadMedications();
            loadDispensations();
            window.dispatchEvent(new Event('dispensationsChanged'));
        } catch (error) {
            const status = error.status;
            if (status === 422 && error.data) {
                const errorData = error.data;
                if (errorData.errors && errorData.errors.length > 0) {
                    showToast(errorData.errors[0].message, 'error');
                } else {
                    showToast(errorData.message || "Erro de validação na dispensação.", 'error');
                }
            } else if (error.data && error.data.message) {
                showToast(error.data.message, 'error');
            } else {
                showToast("Erro ao registrar a dispensação no servidor. Verifique se há estoque suficiente ou permissão.", 'error');
            }
        } finally {
            setLoading('btnFinalize', false);
        }
    }

    function showDispensationSummary(data) {
        lastDispensationResponse = data;
        const body = document.getElementById('dispensationSummaryBody');
        if (!body) return;

        body.innerHTML = '';

        if (data.items && data.items.length > 0) {
            data.items.forEach(item => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                <td>
                    <div class="summary-medication-container">
                        <div class="summary-medication-icon-wrapper">
                            <i class="fa-solid fa-pills"></i>
                        </div>
                        <div>
                            <div class="summary-medication-name">${escapeHTML(item.medicationName)}</div>
                            <div class="summary-medication-concentration">${escapeHTML(item.concentration)}</div>
                        </div>
                    </div>
                </td>
                <td class="text-center">
                    ${escapeHTML(item.lotCode || '-')}
                </td>
                <td class="text-center">
                    <span class="summary-medication-qty-badge">
                        ${item.quantity} ${Number(item.quantity) === 1 ? 'unidade' : 'unidades'}
                    </span>
                </td>
            `;
                body.appendChild(tr);
            });
        } else {
            body.innerHTML = '<tr><td colspan="3" class="text-center text-muted">Nenhum item processado.</td></tr>';
        }

        document.getElementById('dispensationSummaryModal').classList.add('active');
    }

    function closeDispensationSummary() {
        document.getElementById('dispensationSummaryModal').classList.remove('active');
    }

    window.printDispensationReceipt = async function () {
        if (!lastDispensationResponse || !lastDispensationResponse.id) {
            showToast("Nenhum dado de dispensação encontrado para imprimir.", "error");
            return;
        }

        const id = lastDispensationResponse.id;

        try {
            setLoading('btnFinalize', true);
            const response = await window.apiClient.get(`/reports/dispensations/${id}/receipt`, { responseType: 'blob' });

            const blob = response.data;
            const url = window.URL.createObjectURL(blob);
            window.open(url, '_blank');

            setTimeout(() => window.URL.revokeObjectURL(url), 60000);
        } catch (e) {
            console.error("Erro ao imprimir recibo:", e);
            showToast("Erro ao gerar o recibo da dispensação.", "error");
        } finally {
            setLoading('btnFinalize', false);
        }
    };

    function setupEditDispensationAutocomplete() {
        const input = document.getElementById('searchEditDispensationInput');
        const list = document.getElementById('editDispensationSuggestions');
        if (!input || !list) return;

        input.addEventListener('input', function (e) {
            const query = e.target.value.toLowerCase();
            if (query.length < 2) { list.style.display = 'none'; return; }

            const filtered = dispensationList.filter(d => {
                const dateStr = new Date(d.moment).toLocaleString('pt-BR');
                const patientName = d.targetPatient ? d.targetPatient.name.toLowerCase() : "";
                const practObj = d.practitioner || d.Practitioner || null;
                const practitionerName = practObj && practObj.name ? practObj.name.toLowerCase() : "";

                return dateStr.includes(query) || patientName.includes(query) || practitionerName.includes(query);
            });

            list.innerHTML = '';
            filtered.forEach(d => {
                const dateObj = new Date(d.moment);
                const dateStr = dateObj.toLocaleDateString('pt-BR');
                const timeStr = dateObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

                const patientName = d.targetPatient ? d.targetPatient.name : "Paciente Desconhecido";
                const practObj = d.practitioner || d.Practitioner || null;
                const practitionerName = practObj && practObj.name ? practObj.name : "N/A";

                const li = document.createElement('li');
                li.className = 'medication-suggestion-li';
                li.innerHTML = `
                <div class="d-flex flex-column">
                    <div class="d-flex justify-between w-full">
                        <span class="fw-600 text-main fs-14">${escapeHTML(patientName)}</span>
                        <span class="fw-600 text-primary fs-14">${escapeHTML(dateStr)} - ${escapeHTML(timeStr)}</span>
                    </div>
                    <span class="text-muted fs-12">Responsável: ${escapeHTML(practitionerName)}</span>
                </div>
            `;

                li.onclick = () => {
                    selectDispensationToEdit(d.id);
                    list.style.display = 'none';
                    input.value = '';
                };
                list.appendChild(li);
            });
            list.style.display = filtered.length > 0 ? 'block' : 'none';
        });
    }

    async function selectDispensationToEdit(id) {
        try {
            const { data: disp } = await window.apiClient.get(`/dispensations/${id}`);

    document.getElementById('editDispensationId').value = disp.id;
    currentEditDispPatientId = disp.targetPatient ? (disp.targetPatient.id || disp.targetPatient.patientId) : null;
    const practObj = disp.practitioner || disp.Practitioner || null;
    currentEditDisppractitionerId = practObj ? (practObj.id || practObj.practitionerId || practObj.PractitionerId) : null;
    currentEditDispPatientData = null;

    if (currentEditDispPatientId) {
        try {
            const { data: patientData } = await window.apiClient.get(`/patients/${currentEditDispPatientId}`);
            currentEditDispPatientData = patientData;
        } catch (e) {
            console.error("Erro ao carregar dados do paciente para validação de programa:", e);
        }
    }

    const patientName = disp.targetPatient ? disp.targetPatient.name : "N/A";
    document.getElementById('displayDispensationPatient').innerText = patientName;
    document.getElementById('editDisppractitioner').value = practObj && practObj.name ? practObj.name : "N/A";
    const dateObj = new Date(disp.moment);
    const dateStr = dateObj.toLocaleDateString('pt-BR');
    const timeStr = dateObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    document.getElementById('editDispDate').value = `${dateStr} às ${timeStr}`;

    let thirdPartyText = "Não (Próprio Paciente)";
    let thirdPartyTitle = "";
    currentEditDispThirdPerson = null;

    if (disp.thirdPerson) {
        currentEditDispThirdPerson = disp.thirdPerson;
        const doc = disp.thirdPerson.cpf ? window.applyCpfMask(disp.thirdPerson.cpf) : "N/D";
        thirdPartyText = `Sim - ${disp.thirdPerson.name}`;
        thirdPartyTitle = `Documento: ${doc}\nVínculo/Obs: ${disp.thirdPerson.observation || 'Nenhuma'}`;
    }

    const thirdPartyInput = document.getElementById('editDispThirdParty');
    if (thirdPartyInput) {
        thirdPartyInput.value = thirdPartyText;
        thirdPartyInput.title = thirdPartyTitle;
    }

    // Preencher dados da prescrição, se existir
    if (disp.prescription) {
        if (disp.prescription.prescriptionDate) {
            const pd = new Date(disp.prescription.prescriptionDate);
            document.getElementById('editPrescriptionDate').value = pd.toISOString().split('T')[0];
        } else {
            document.getElementById('editPrescriptionDate').value = '';
        }
        document.getElementById('editPrescriberName').value = disp.prescription.prescriberName || '';
        document.getElementById('editPrescriberCpf').value = disp.prescription.prescriberCpf ? window.applyCpfMask(disp.prescription.prescriberCpf) : '';
        document.getElementById('editPrescriberCouncil').value = disp.prescription.prescriberCouncil || '';
        document.getElementById('editPrescriberCouncilUF').value = disp.prescription.prescriberCouncilUF || '';
        document.getElementById('editPrescriberCouncilNumber').value = disp.prescription.prescriberCouncilNumber || '';
    } else {
        document.getElementById('editPrescriptionDate').value = '';
        document.getElementById('editPrescriberName').value = '';
        document.getElementById('editPrescriberCpf').value = '';
        document.getElementById('editPrescriberCouncil').value = '';
        document.getElementById('editPrescriberCouncilUF').value = '';
        document.getElementById('editPrescriberCouncilNumber').value = '';
    }

    let itemsData = [];
    try {
        const { data } = await window.apiClient.get(`/dispensations/${id}/items`);
        itemsData = data || [];
    } catch (err) {
        console.error("Erro ao buscar itens da dispensação:", err);
    }

    currentEditDispItems = [];
    originalEditDispQuantities = {};
    itemsData.forEach(item => {
        if (originalEditDispQuantities[item.medicationId]) {
            originalEditDispQuantities[item.medicationId] += item.quantity;
        } else {
            originalEditDispQuantities[item.medicationId] = item.quantity;
        }

        let existing = currentEditDispItems.find(i => i.medicationId === item.medicationId);

        if (existing) {
            existing.quantity += item.quantity;
            existing.lotsDisplay += `<br>${item.lotCode} (${item.quantity} unidades)`;
        } else {
            currentEditDispItems.push({
                medicationId: item.medicationId,
                name: item.medicationName || item.activeIngredient || 'Medicamento',
                concentration: item.concentration || '',
                quantity: item.quantity,
                lotCode: item.lotCode,
                lotsDisplay: `${item.lotCode} (${item.quantity} unidades)`,
                duration: item.duration || '',
                instructions: item.instructions || ''
            });
        }
    });

    updateEditDispensationTable();
    document.getElementById('editDispensationCard').classList.remove('d-none');
    setupEditDispAddMedSearch();
} catch (e) {
    console.error(e);
    showToast("Erro ao buscar detalhes da dispensação.", 'error');
}
    }

function updateEditDispensationTable() {
    const tbody = document.getElementById('editDispensationItemsBody');
    tbody.innerHTML = '';

    if (currentEditDispItems.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="empty-msg text-center" style="vertical-align: middle;">Nenhum medicamento adicionado à lista ainda.</td></tr>`;
        return;
    }

    const fragment = document.createDocumentFragment();

    currentEditDispItems.forEach((item, index) => {
        const isRecalculado = item.lotsDisplay.includes("Automático") || item.lotsDisplay.includes("recalculado");

        const loteFormatado = isRecalculado
            ? `<span class="medication-lots-recalculated">${item.lotsDisplay}</span>`
            : `<span class="medication-lots-normal">${item.lotsDisplay}</span>`;

        let posologyHtml = '';
        if (item.duration || item.instructions) {
            posologyHtml = `<div class="mt-5" style="font-size: 11px; color: #64748b; background: #f8fafc; padding: 4px; border-radius: 4px; border: 1px dashed #cbd5e1;">`;
            if (item.duration) posologyHtml += `<i class="fa-regular fa-clock"></i> ${escapeHTML(item.duration)} dias `;
            if (item.instructions) posologyHtml += `<br><i class="fa-solid fa-notes-medical"></i> ${escapeHTML(item.instructions)}`;
            posologyHtml += `</div>`;
        }

        const tr = document.createElement('tr');
        tr.className = 'edit-dispensation-row';
        tr.innerHTML = `
            <td class="text-main text-left">
                <span class="d-block fw-600 fs-15">${escapeHTML(item.name)}</span>
                <span class="text-muted fs-13 fw-400">${escapeHTML(item.concentration || '')}</span>
                ${posologyHtml}
            </td>
            <td class="fw-500 text-center">${loteFormatado}</td>
            <td class="text-center">
                <input type="number" class="form-input text-center edit-dispensation-qty-input" min="1" value="${item.quantity}" onchange="window.updateEditItemQuantity(${index}, this.value)">
            </td>
            <td class="text-center">
                <button type="button" class="btn-danger-icon" onclick="removeEditDispItem(${index})" title="Remover item">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </td>
        `;
        fragment.appendChild(tr);
    });
    tbody.appendChild(fragment);
}

function removeEditDispItem(index) {
    currentEditDispItems.splice(index, 1);
    updateEditDispensationTable();
}

window.updateEditItemQuantity = function (index, newQtyStr) {
    const newQty = parseInt(newQtyStr);
    if (isNaN(newQty) || newQty <= 0) {
        showToast("Quantidade inválida.", "error");
        updateEditDispensationTable(); // revert UI
        return;
    }

    const item = currentEditDispItems[index];
    const medId = item.medicationId;
    const selectedMed = medicationList.find(m => m.id === medId);

    if (!selectedMed) {
        // Can't recalculate FEFO preview without medication data, but we can update quantity and let backend handle it
        item.quantity = newQty;
        item.lotsDisplay = "(Automático/Recalculado no Servidor)";
        updateEditDispensationTable();
        return;
    }

    const availableLots = (selectedMed.lots || [])
        .filter(lot => lot.currentQuantity > 0)
        .sort((a, b) => new Date(a.expirationDate) - new Date(b.expirationDate));

    const originalQty = originalEditDispQuantities[medId] || 0;
    const totalAvailable = availableLots.reduce((sum, lot) => sum + lot.currentQuantity, 0) + originalQty;

    if (newQty > totalAvailable) {
        showToast(`Estoque insuficiente! Só restam ${totalAvailable} un disponíveis no estoque.`);
        updateEditDispensationTable(); // revert UI
        return;
    }

    let remainingToFulfill = newQty;
    let newLotsUsed = [];

    for (const lot of availableLots) {
        if (remainingToFulfill <= 0) break;
        const takeFromLot = Math.min(lot.currentQuantity, remainingToFulfill);
        newLotsUsed.push(`${lot.lotCode} (${takeFromLot} un)`);
        remainingToFulfill -= takeFromLot;
    }

    item.quantity = newQty;
    item.lotsDisplay = newLotsUsed.join(' + ');
    if (!item.lotsDisplay) item.lotsDisplay = "(Recalculado)";
    updateEditDispensationTable();
};

function setupEditDispAddMedSearch() {
    const input = document.getElementById('inputBuscaMedEdicao');
    const list = document.getElementById('editDispAddMedSuggestions');
    if (!input || !list) return;

    if (input.dataset.listenerAttached === 'true') return;
    input.dataset.listenerAttached = 'true';

    input.addEventListener('input', function (e) {
        document.getElementById('inputOcultoMedIdEdicao').value = "";

        const query = e.target.value.toLowerCase();
        if (query.length < 2) { list.style.display = 'none'; return; }

        const filtered = medicationList.filter(m => m.activeIngredient && m.activeIngredient.toLowerCase().includes(query));
        list.innerHTML = '';

        const fragment = document.createDocumentFragment();
        filtered.forEach(m => {
            const li = document.createElement('li');
            li.setAttribute('role', 'option');
            li.className = 'medication-suggestion-li';
            li.innerHTML = `<span>${escapeHTML(m.activeIngredient)}</span> <small>(${escapeHTML(m.concentration)})</small>`;

            li.onclick = () => {
                document.getElementById('inputOcultoMedIdEdicao').value = m.id;
                input.value = `${m.activeIngredient} ${m.concentration}`;
                list.style.display = 'none';
            };
            fragment.appendChild(li);
        });
        list.appendChild(fragment);
        list.style.display = filtered.length > 0 ? 'block' : 'none';
    });
}

function addMedToEditDispensation() {
    const medId = document.getElementById('inputOcultoMedIdEdicao').value;
    const medName = document.getElementById('inputBuscaMedEdicao').value;
    const qtyToAdd = parseInt(document.getElementById('inputNovaQuantidadeEdicao').value);
    const duration = document.getElementById('inputNovaDuracaoEdicao').value;
    const instructions = document.getElementById('inputNovaInstrucaoEdicao').value;

    if (!medId || !medName) { showToast("Selecione um medicamento válido."); return; }
    if (isNaN(qtyToAdd) || qtyToAdd <= 0) { showToast("Informe uma quantidade válida."); return; }

    const selectedMed = medicationList.find(m => m.id === medId);
    if (!selectedMed) {
        showToast("Medicamento não encontrado no estoque atual.");
        return;
    }

    const categories = selectedMed.programCategory ? [selectedMed.programCategory] : [];

    const normalizeCategory = cat => {
        if (!cat) return '';
        const map = {
            'HIPERTENSAO': 'HYPERTENSION',
            'DIABETES': 'DIABETES',
            'SAUDE_MENTAL': 'MENTAL_HEALTH',
            'SAUDE_DA_MULHER': 'WOMENS_HEALTH',
            'FARMACIA_BASICA': 'BASIC_PHARMACY',
            'HYPERTENSION': 'HYPERTENSION',
            'WOMENS_HEALTH': 'WOMENS_HEALTH',
            'MENTAL_HEALTH': 'MENTAL_HEALTH',
            'BASIC_PHARMACY': 'BASIC_PHARMACY'
        };
        return map[cat.toUpperCase()] || cat.toUpperCase();
    };

    const normalizedCats = categories.map(normalizeCategory);
    const isUniversal = normalizedCats.includes('BASIC_PHARMACY');

    if (!isUniversal && currentEditDispPatientData && currentEditDispPatientData.programs) {
        const hasProgram = currentEditDispPatientData.programs.some(p => normalizedCats.includes(normalizeCategory(p.programCategory)));
        if (!hasProgram) {
            const formatMap = window.PROGRAM_LABELS || {};
            const friendlyCategories = categories.map(cat => formatMap[cat.toUpperCase()] || cat).join(', ');
            showToast(`O paciente não possui autorização para nenhum dos programas do medicamento: ${friendlyCategories}`, 'error');
            return;
        }
    }

    const availableLots = (selectedMed.lots || [])
        .filter(lot => lot.currentQuantity > 0)
        .sort((a, b) => new Date(a.expirationDate) - new Date(b.expirationDate));

    const originalQty = originalEditDispQuantities[medId] || 0;
    const totalAvailable = availableLots.reduce((sum, lot) => sum + lot.currentQuantity, 0) + originalQty;

    if (qtyToAdd > totalAvailable) {
        showToast(`Estoque insuficiente! Você tentou adicionar mais ${qtyToAdd} un, mas só restam ${totalAvailable} un disponíveis no estoque (incluindo o que já estava dispensado).`);
        return;
    }

    let remainingToFulfill = qtyToAdd;
    let newLotsUsed = [];

    for (const lot of availableLots) {
        if (remainingToFulfill <= 0) break;
        const takeFromLot = Math.min(lot.currentQuantity, remainingToFulfill);
        newLotsUsed.push(`${lot.lotCode} (${takeFromLot} un)`);
        remainingToFulfill -= takeFromLot;
    }

    const newLotsDisplay = newLotsUsed.join(' + ');
    const existingIndex = currentEditDispItems.findIndex(i => i.medicationId === medId);

    if (existingIndex >= 0) {
        currentEditDispItems[existingIndex].quantity += qtyToAdd;
        currentEditDispItems[existingIndex].lotsDisplay += ` + ${newLotsDisplay}`;
    } else {
        currentEditDispItems.push({
            medicationId: medId,
            name: medName,
            quantity: qtyToAdd,
            lotsDisplay: newLotsDisplay,
            duration: duration || '',
            instructions: instructions || ''
        });
    }

    document.getElementById('inputOcultoMedIdEdicao').value = "";
    document.getElementById('inputBuscaMedEdicao').value = "";
    document.getElementById('inputNovaQuantidadeEdicao').value = "1";
    document.getElementById('inputNovaDuracaoEdicao').value = "";
    document.getElementById('inputNovaInstrucaoEdicao').value = "";

    updateEditDispensationTable();
}

async function saveDispensationEdit() {
    const id = document.getElementById('editDispensationId').value;

    if (currentEditDispItems.length === 0) {
        showToast("A dispensação precisa ter pelo menos um medicamento.");
        return;
    }

    let prescriptionData = null;
    const pDate = document.getElementById('editPrescriptionDate').value;
    const pName = document.getElementById('editPrescriberName').value.trim();
    const pCpf = document.getElementById('editPrescriberCpf').value.replace(/\D/g, '');
    const pCouncil = document.getElementById('editPrescriberCouncil').value;
    const pCouncilUF = document.getElementById('editPrescriberCouncilUF').value;
    const pCouncilNum = document.getElementById('editPrescriberCouncilNumber').value.trim();

    if (pDate || pName || pCouncil || pCouncilUF || pCouncilNum) {
        prescriptionData = {
            prescriptionDate: pDate ? new Date(pDate + 'T00:00:00').toISOString() : null,
            prescriberName: pName || null,
            prescriberCpf: pCpf || null,
            prescriberCouncil: pCouncil || null,
            prescriberCouncilUF: pCouncilUF || null,
            prescriberCouncilNumber: pCouncilNum || null
        };
    }

    const payload = {
        practitionerId: currentEditDisppractitionerId,
        patientId: currentEditDispPatientId,
        thirdPerson: currentEditDispThirdPerson,
        prescription: prescriptionData,
        items: currentEditDispItems.map(item => {
            let backendItem = {
                medicationId: item.medicationId,
                quantity: item.quantity
            };
            if (item.duration) backendItem.duration = parseInt(item.duration) || null;
            if (item.instructions) backendItem.instructions = item.instructions;
            return backendItem;
        })
    };

    setLoading('btnUpdateDispensation', true);
    try {
        await window.apiClient.put(`/dispensations/${id}`, payload);

        showToast("Dispensação atualizada com sucesso! O estoque foi recalculado.");
        closeEditDispensation();

        window.dispatchEvent(new Event('dispensationsChanged'));

        if (typeof loadDispensations === "function") {
            loadDispensations();
        }

        if (typeof loadMedications === "function") {
            loadMedications();
        } else {
            console.warn("Lembre-se de recarregar a lista de dispensações ou a pesquisa não achará a nova edição!");
        }
    } catch (error) {
        console.error("Erro interno do Front-end ou rejeição pelo servidor:", error);
        if (error.data && error.data.message) {
            showToast("O Servidor recusou a atualização: " + error.data.message, 'error');
        } else {
            showToast("Erro ao tentar atualizar a dispensação. Verifique se o backend está ativo e o payload é válido.", 'error');
        }
    } finally {
        setLoading('btnUpdateDispensation', false);
    }
}

function closeEditDispensation() {
    document.getElementById('editDispensationCard').classList.add('d-none');
}

window.reprintDispensation = async function () {
    const id = document.getElementById('editDispensationId').value;
    if (!id) {
        showToast("Nenhuma dispensação selecionada.", "error");
        return;
    }

    try {
        const { data: blob } = await window.apiClient.get(`/reports/dispensations/${id}/receipt`, { responseType: 'blob' });

        const url = window.URL.createObjectURL(blob);
        window.open(url, '_blank');

        setTimeout(() => window.URL.revokeObjectURL(url), 60000);
    } catch (e) {
        console.error("Erro na reimpressão:", e);
        showToast("Erro ao buscar o recibo gerado pelo servidor.", "error");
    }
}

// ==========================================
// EXPORTS PÚBLICOS (API Global do Módulo)
// ==========================================

// Gerenciamento de Dispensações (Nova Dispensação)
window.addItemDispensation = addItemDispensation;
window.finalizeDispensation = finalizeDispensation;
window.reprintDispensation = reprintDispensation;
window.showDispensationSummary = showDispensationSummary;
window.closeDispensationSummary = closeDispensationSummary;

// Edição de Dispensações Existentes
window.setupEditDispensationAutocomplete = setupEditDispensationAutocomplete;
window.selectDispensationToEdit = selectDispensationToEdit;
window.updateEditDispensationTable = updateEditDispensationTable;
window.removeEditDispItem = removeEditDispItem;
window.setupEditDispAddMedSearch = setupEditDispAddMedSearch;
window.addMedToEditDispensation = addMedToEditDispensation;
window.saveDispensationEdit = saveDispensationEdit;
window.closeEditDispensation = closeEditDispensation;

window.loadMedications = loadMedications;
window.loadDispensations = loadDispensations;
window.fetchPatientSuggestions = fetchPatientSuggestions;
window.populateSelects = populateSelects;
window.fetchMedicationDetails = fetchMedicationDetails;
window.calculateFEFOPreview = calculateFEFOPreview;
window.updateTable = updateTable;
window.toggleThirdPartySection = toggleThirdPartySection;
window.clearPatientSelection = clearPatientSelection;

function initCpfMasks() {
    const prescriberCpfInput = document.getElementById('prescriberCpf');
    if (prescriberCpfInput) {
        prescriberCpfInput.addEventListener('input', (e) => {
            e.target.value = window.applyCpfMask(e.target.value);
        });
    }
    const tpDocumentInput = document.getElementById('tpDocument');
    if (tpDocumentInput) {
        tpDocumentInput.addEventListener('input', (e) => {
            e.target.value = window.applyCpfMask(e.target.value);
        });
    }
}
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initCpfMasks);
    } else {
        initCpfMasks();
    }
})();