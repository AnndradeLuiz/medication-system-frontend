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

            const items = Array.from(list.children).filter(li => !li.style.color || !li.style.color.includes('ef4444'));
            if (items.length === 0) return;

            let activeIndex = items.findIndex(li => li.classList.contains('focused'));

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (activeIndex !== -1) {
                    items[activeIndex].classList.remove('focused');
                    items[activeIndex].style.backgroundColor = 'transparent';
                    items[activeIndex].removeAttribute('aria-selected');
                }
                activeIndex = (activeIndex + 1) % items.length;
                items[activeIndex].classList.add('focused');
                items[activeIndex].style.backgroundColor = '#f0fdf4';
                items[activeIndex].setAttribute('aria-selected', 'true');
                items[activeIndex].scrollIntoView({ block: 'nearest' });
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (activeIndex !== -1) {
                    items[activeIndex].classList.remove('focused');
                    items[activeIndex].style.backgroundColor = 'transparent';
                    items[activeIndex].removeAttribute('aria-selected');
                }
                activeIndex = (activeIndex - 1 + items.length) % items.length;
                items[activeIndex].classList.add('focused');
                items[activeIndex].style.backgroundColor = '#f0fdf4';
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
            const response = await fetch(`${API_URL}/medications`, {
                headers: getAuthHeaders(),
                cache: 'no-store'
            });
            if (response.ok) {
                medicationList = await response.json();
                populateSelects();
                console.log("Estoque atualizado.");
            }
        } catch (error) {
            console.error("Erro ao carregar medicamentos:", error);
        }
    }

    async function loadDispensations() {
        try {
            const response = await fetch(`${API_URL}/dispensations?size=200`, {
                headers: getAuthHeaders(),
                cache: 'no-store'
            });
            if (response.ok) {
                const pageData = await response.json();
                dispensationList = pageData.content || [];
                console.log("Dispensações carregadas do banco:", dispensationList);
                setupEditDispensationAutocomplete();
            } else {
                console.error("Erro na resposta do servidor:", response.status);
            }
        } catch (error) {
            console.error("Erro ao carregar histórico de dispensações:", error);
        }
    }

    let isDispensacaoModuleInitialized = false;
    window.initDispensacaoModule = function () {
        if (isDispensacaoModuleInitialized) return;
        isDispensacaoModuleInitialized = true;

        loggedpractitionerName = localStorage.getItem('sgdm_userName');
        loggedpractitionerId = localStorage.getItem('sgdm_practitionerId');

        const patientInput = document.getElementById('dispensePatientInput');
        if (patientInput) {
            patientInput.addEventListener('input', function (e) {
                let val = e.target.value;
                if (/^\d/.test(val)) {
                    e.target.value = applyCpfMask(val);
                }
                clearTimeout(searchTimeout);
                if (val.length >= 3) {
                    searchTimeout = setTimeout(() => fetchPatientSuggestions(val), 400);
                } else {
                    document.getElementById('patientSuggestions').style.display = 'none';
                }
            });
        }

        const tpDocInput = document.getElementById('tpDocument');
        if (tpDocInput) {
            tpDocInput.addEventListener('input', e => e.target.value = applyCpfMask(e.target.value));
        }

        loadDispensations();
        toggleThirdPartySection();
        toggleThirdPartySection();

        setupKeyboardNavigation('dispensePatientInput', 'patientSuggestions');
        setupKeyboardNavigation('inputBuscaMedEdicao', 'editDispAddMedSuggestions');
    };

    async function fetchPatientSuggestions(query) {
        const list = document.getElementById('patientSuggestions');
        try {
            const response = await fetch(`${API_URL}/patients?query=${encodeURIComponent(query)}&status=ativos`, {
                headers: getAuthHeaders(),
                cache: 'no-store'
            });
            if (response.ok) {
                const pageData = await response.json();
                const patients = pageData.content || [];
                list.innerHTML = '';

                if (patients.length === 0) {
                    list.innerHTML = '<li style="padding: 12px 15px; color: #ef4444; font-size: 14px;">Nenhum paciente ativo encontrado.</li>';
                } else {
                    patients.forEach(p => {
                        const li = document.createElement('li');
                        li.setAttribute('role', 'option');
                        li.style.cssText = 'padding: 12px 15px; border-bottom: 1px solid #f3f4f6; cursor: pointer; display: flex; justify-content: space-between; align-items: center; transition: background 0.2s;';

                        const cpfBonito = p.cpf ? applyCpfMask(p.cpf) : 'Sem CPF';

                        li.innerHTML = `
                        <div class="d-flex flex-column">
                            <span class="fw-600 text-main fs-15">${escapeHTML(p.name)}</span>
                            <span class="text-muted fs-13">CPF: ${escapeHTML(cpfBonito)}</span>
                        </div>
                    `;

                        li.onmouseover = () => li.style.backgroundColor = '#f0fdf4';
                        li.onmouseout = () => li.style.backgroundColor = 'transparent';

                        li.onclick = () => {
                            document.getElementById('dispensePatientId').value = p.id;
                            document.getElementById('selectedPatientInfo').innerHTML = `
                            <span style="font-weight: 600; color: #1f2937; font-size: 15px;">${p.name}</span>
                            <span style="font-size: 13px; color: #6b7280; background: #e5e7eb; padding: 3px 8px; border-radius: 4px;">CPF: ${cpfBonito}</span>
                        `;
                            document.getElementById('dispensePatientInput').style.display = 'none';
                            list.style.display = 'none';
                            document.getElementById('selectedPatientCard').style.display = 'flex';

                            selectedPatientIsExternal = p.external === true;
                            currentDispensePatientData = p;

                            let countMeds = 0;
                            if (p.enrollments && p.enrollments.length > 0) {
                                p.enrollments.forEach(enr => {
                                    if (enr.medications) countMeds += enr.medications.length;
                                });
                            }

                            const containerAutoFill = document.getElementById('autoFillProgramsContainer');
                            const countSpan = document.getElementById('autoFillMedCount');
                            if (containerAutoFill && countSpan) {
                                if (countMeds > 0) {
                                    countSpan.innerText = countMeds;
                                    containerAutoFill.style.display = 'block';
                                } else {
                                    containerAutoFill.style.display = 'none';
                                }
                            }
                        };
                        list.appendChild(li);
                    });
                }
                list.style.display = 'block';
            }
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

    const medInput = document.getElementById('dispenseMedInput');
    if (medInput) {
        medInput.addEventListener('input', function (e) {
            const query = e.target.value.toLowerCase();
            const list = document.getElementById('medSuggestions');

            if (query.length < 2) {
                list.style.display = 'none';
                return;
            }

            const filtered = medicationList.filter(m =>
                m.activeIngredient && m.activeIngredient.toLowerCase().includes(query)
            );

            list.innerHTML = '';

            if (filtered.length === 0) {
                list.innerHTML = '<li style="padding: 10px 15px; color: #ef4444; font-size: 14px;">Medicamento não encontrado.</li>';
            } else {
                filtered.forEach(m => {
                    const li = document.createElement('li');
                    li.style.cssText = 'padding: 10px 15px; border-bottom: 1px solid #f3f4f6; cursor: pointer; transition: background 0.2s;';

                    li.innerHTML = `<span style="font-weight: 600; color: #1f2937;">${escapeHTML(m.activeIngredient)}</span> <span style="font-size: 13px; color: #6b7280;">(${escapeHTML(m.concentration)})</span>`;

                    li.onmouseover = () => li.style.backgroundColor = '#e0e7ff';
                    li.onmouseout = () => li.style.backgroundColor = 'transparent';

                    li.onclick = () => {
                        document.getElementById('dispenseMedInput').value = `${m.activeIngredient} (${m.concentration})`;
                        document.getElementById('dispenseMedId').value = m.id;
                        list.style.display = 'none';
                    };
                    list.appendChild(li);
                });
            }
            list.style.display = 'block';
        });
    }

    document.addEventListener('click', function (e) {
        if (e.target.id !== 'dispenseMedInput') {
            const medList = document.getElementById('medSuggestions');
            if (medList) medList.style.display = 'none';
        }
    });

    async function fetchMedicationDetails(id) {
        try {
            const response = await fetch(`${API_URL}/medications/${id}`, {
                headers: getAuthHeaders()
            });
            if (response.ok) {
                const med = await response.json();
                const index = medicationList.findIndex(m => m.id === id);
                if (index !== -1) {
                    medicationList[index] = med;
                } else {
                    medicationList.push(med);
                }
                return med;
            }
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

        if (selectedPatientIsExternal && (!med.programCategories || (!med.programCategories.includes('FARMACIA_BASICA') && !med.programCategories.includes('BASIC_PHARMACY')))) {
            const catStr = med.programCategories ? med.programCategories.join(', ') : 'Nenhuma';
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

    window.autoFillPatientPrograms = async function () {
        if (!currentDispensePatientData || !currentDispensePatientData.enrollments) return;

        let totalAdded = 0;
        let missingMeds = [];

        const btnAutoFill = document.querySelector('#autoFillProgramsContainer button');
        if (btnAutoFill) btnAutoFill.disabled = true;

        for (const enr of currentDispensePatientData.enrollments) {
            if (!enr.medications) continue;
            for (const enrMed of enr.medications) {
                const medId = enrMed.medicationId;
                const quantity = enrMed.quantity;

                if (!medId || !quantity || quantity <= 0) continue;

                const med = await fetchMedicationDetails(medId) || medicationList.find(m => m.id === medId);

                if (!med) {
                    missingMeds.push(`Medicamento (ID: ${medId}) não encontrado`);
                    continue;
                }

                if (selectedPatientIsExternal && (!med.programCategories || (!med.programCategories.includes('FARMACIA_BASICA') && !med.programCategories.includes('BASIC_PHARMACY')))) {
                    missingMeds.push(`'${med.activeIngredient} ${med.concentration}' (Bloqueado para paciente externo)`);
                    continue;
                }

                const fefoResult = calculateFEFOPreview(med, quantity);

                if (!fefoResult.success) {
                    missingMeds.push(`'${med.activeIngredient} ${med.concentration}' (Estoque: ${fefoResult.stock}, Precisa: ${quantity})`);
                    continue;
                }

                const alreadyAdded = requestItems.find(item => item.medicationId === medId);
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
            const response = await fetch(`${API_URL}/dispensations`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(payload)
            });

            if (response.ok || response.status === 201) {
                const responseData = await response.json();
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
            } else if (response.status === 422) {
                try {
                    const errorData = await response.json();
                    if (errorData.errors && errorData.errors.length > 0) {
                        showToast(errorData.errors[0].message, 'error');
                    } else {
                        showToast(errorData.message || "Erro de validação na dispensação.", 'error');
                    }
                } catch (e) {
                    showToast("Erro de validação no servidor.", 'error');
                }
            } else {
                try {
                    const errorData = await response.json();
                    showToast(errorData.message || "Erro ao registrar no servidor. Verifique se o paciente tem permissão para este medicamento.", 'error');
                } catch (e) {
                    showToast("Erro ao registrar no servidor. Verifique o console.", 'error');
                }
            }
        } catch (error) {
            showToast("Erro de comunicação com o servidor. O Java está rodando?", 'error');
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
                <td style="vertical-align: middle;">
                    <div style="display: flex; align-items: center; justify-content: center; gap: 12px; text-align: left;">
                        <div style="width: 32px; height: 32px; border-radius: 50%; background: #e0f2fe; display: flex; align-items: center; justify-content: center; color: #0284c7;">
                            <i class="fa-solid fa-pills"></i>
                        </div>
                        <div>
                            <div style="font-weight: 600; color: var(--color-text-main);">${escapeHTML(item.medicationName)}</div>
                            <div style="font-size: 13px; color: var(--color-text-light);">${escapeHTML(item.concentration)}</div>
                        </div>
                    </div>
                </td>
                <td class="text-center" style="font-family: var(--font-data); font-size: 13px; vertical-align: middle;">
                    ${escapeHTML(item.lotCode || '-')}
                </td>
                <td class="text-center" style="vertical-align: middle;">
                    <span style="font-weight: 700; color: #166534; background-color: #dcfce7; border-radius: 12px; padding: 4px 8px; display: inline-block;">
                        ${item.quantity} unidades
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
            const response = await fetch(`${API_URL}/reports/dispensations/${id}/receipt`, {
                headers: getAuthHeaders()
            });

            if (!response.ok) throw new Error("Falha ao gerar PDF no servidor");

            const blob = await response.blob();
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
                li.style.cssText = 'padding: 10px 15px; border-bottom: 1px solid #f3f4f6; cursor: pointer; transition: background 0.2s;';
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
            const response = await fetch(`${API_URL}/dispensations/${id}`, {
                headers: getAuthHeaders()
            });
            if (!response.ok) return;
            const disp = await response.json();

            document.getElementById('editDispensationId').value = disp.id;
            currentEditDispPatientId = disp.targetPatient ? (disp.targetPatient.id || disp.targetPatient.patientId) : null;
            const practObj = disp.practitioner || disp.Practitioner || null;
            currentEditDisppractitionerId = practObj ? (practObj.id || practObj.practitionerId) : null;
            currentEditDispPatientData = null;

            if (currentEditDispPatientId) {
                try {
                    const patientResp = await fetch(`${API_URL}/patients/${currentEditDispPatientId}`, {
                        headers: getAuthHeaders()
                    });
                    if (patientResp.ok) {
                        currentEditDispPatientData = await patientResp.json();
                    }
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
                const doc = disp.thirdPerson.cpf ? applyCpfMask(disp.thirdPerson.cpf) : "N/D";
                thirdPartyText = `Sim - ${disp.thirdPerson.name}`;
                thirdPartyTitle = `Documento: ${doc}\nVínculo/Obs: ${disp.thirdPerson.observation || 'Nenhuma'}`;
            }

            const thirdPartyInput = document.getElementById('editDispThirdParty');
            if (thirdPartyInput) {
                thirdPartyInput.value = thirdPartyText;
                thirdPartyInput.title = thirdPartyTitle;
            }

            const itemsResponse = await fetch(`${API_URL}/dispensations/${id}/items`, {
                headers: getAuthHeaders()
            });
            let itemsData = [];
            if (itemsResponse.ok) {
                itemsData = await itemsResponse.json();
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
                        lotsDisplay: `${item.lotCode} (${item.quantity} unidades)`
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
                ? `<span style="color: #6b7280; font-style: italic; font-size: 13px;">${item.lotsDisplay}</span>`
                : `<span style="color: #0f766e; font-weight: 500; font-size: 14px;">${item.lotsDisplay}</span>`;

            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid #f3f4f6';
            tr.innerHTML = `
            <td class="text-main text-left">
                <span class="d-block fw-600 fs-15">${escapeHTML(item.name)}</span>
                <span class="text-muted fs-13 fw-400">${escapeHTML(item.concentration || '')}</span>
            </td>
            <td class="fw-500 text-center">${loteFormatado}</td>
            <td class="text-center">${item.quantity} unidades</td>
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
                li.style.cssText = 'padding: 10px 15px; border-bottom: 1px solid #f3f4f6; cursor: pointer; transition: background 0.2s;';
                li.innerHTML = `<span style="font-weight: 600;">${escapeHTML(m.activeIngredient)}</span> <small>(${escapeHTML(m.concentration)})</small>`;

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

        if (!medId || !medName) { showToast("Selecione um medicamento válido."); return; }
        if (isNaN(qtyToAdd) || qtyToAdd <= 0) { showToast("Informe uma quantidade válida."); return; }

        const selectedMed = medicationList.find(m => m.id === medId);
        if (!selectedMed) {
            showToast("Medicamento não encontrado no estoque atual.");
            return;
        }

        const categories = selectedMed.programCategories || (selectedMed.programCategory ? [selectedMed.programCategory] : []);

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
                lotsDisplay: newLotsDisplay
            });
        }

        document.getElementById('inputOcultoMedIdEdicao').value = "";
        document.getElementById('inputBuscaMedEdicao').value = "";
        document.getElementById('inputNovaQuantidadeEdicao').value = "1";

        updateEditDispensationTable();
    }

    async function saveDispensationEdit() {
        const id = document.getElementById('editDispensationId').value;

        if (currentEditDispItems.length === 0) {
            showToast("A dispensação precisa ter pelo menos um medicamento.");
            return;
        }

        const payload = {
            practitionerId: currentEditDisppractitionerId,
            patientId: currentEditDispPatientId,
            thirdPerson: currentEditDispThirdPerson,
            items: currentEditDispItems.map(item => ({
                medicationId: item.medicationId,
                quantity: item.quantity
            }))
        };

        setLoading('btnUpdateDispensation', true);
        try {
            const response = await fetch(`${API_URL}/dispensations/${id}`, {
                method: 'PUT',
                headers: getAuthHeaders(),
                body: JSON.stringify(payload)
            });

            if (response.ok) {
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
            } else {
                const errorText = await response.text();
                console.error("Erro recebido do Spring Boot:", errorText);

                try {
                    const errorJson = JSON.parse(errorText);
                    showToast("O Servidor recusou a atualização: " + (errorJson.message || errorJson.error), 'error');
                } catch (e) {
                    showToast("Erro no backend! Verifique o terminal do seu Java. Status: " + response.status, 'error');
                }
            }
        } catch (error) {
            console.error("Erro interno do Front-end:", error);
            showToast("Falha ao tentar se comunicar com o servidor. O Spring Boot está ligado?", 'error');
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
            const response = await fetch(`${API_URL}/reports/dispensations/${id}/receipt`, {
                headers: getAuthHeaders()
            });

            if (!response.ok) throw new Error("Falha ao gerar PDF no servidor");

            const blob = await response.blob();
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
