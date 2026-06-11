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
            const response = await fetch(`${API_URL}/dispensations?size=1000`, {
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

    let isDashboardModuleInitialized = false;
    window.initDashboardModule = function () {
        if (isDashboardModuleInitialized) return;
        isDashboardModuleInitialized = true;

        loggedpractitionerName = localStorage.getItem('sgdm_userName');
        loggedpractitionerId = localStorage.getItem('sgdm_practitionerId');

        // As chamadas loadMedications() e loadDispensations() 
        // serão gerenciadas pelo router.js


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

        const searchEditMedInput = document.getElementById('searchEditMedInput');
        if (searchEditMedInput) {
            searchEditMedInput.addEventListener('input', function (e) {
                const query = e.target.value.toLowerCase();
                const list = document.getElementById('editMedSuggestions');

                if (query.length < 2) {
                    list.style.display = 'none';
                    return;
                }

                const filtered = medicationList.filter(m =>
                    m.activeIngredient && m.activeIngredient.toLowerCase().includes(query)
                );

                list.innerHTML = '';
                if (filtered.length === 0) {
                    list.innerHTML = '<li style="padding: 10px; color: #ef4444;">Nenhum medicamento encontrado.</li>';
                } else {
                    filtered.forEach(m => {
                        const li = document.createElement('li');
                        li.style.cssText = 'padding: 10px; border-bottom: 1px solid #f3f4f6; cursor: pointer;';
                        li.innerHTML = `
                    <div class="d-flex flex-column">
                        <span class="fw-600 text-main fs-14">${m.activeIngredient}</span>
                        <span class="text-muted fs-12">${m.concentration || ''}</span>
                    </div>
                `;
                        li.onclick = () => selectMedicationToEdit(m.id);
                        list.appendChild(li);
                    });
                }
                list.style.display = 'block';
            });
        }

        loadDispensations();
        toggleThirdPartySection();
        toggleThirdPartySection();
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

                            // Memoriza se o paciente é externo para barrarmos a medicação depois!
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
        selectedPatientIsExternal = false; // Reseta a memória de segurança
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
                // Limpar campos se desmarcar
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

            // CORREÇÃO: Filtrar apenas pelo activeIngredient
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

                    // CORREÇÃO: Exibir activeIngredient na lista
                    li.innerHTML = `<span style="font-weight: 600; color: #1f2937;">${escapeHTML(m.activeIngredient)}</span> <span style="font-size: 13px; color: #6b7280;">(${escapeHTML(m.concentration)})</span>`;

                    li.onmouseover = () => li.style.backgroundColor = '#e0e7ff';
                    li.onmouseout = () => li.style.backgroundColor = 'transparent';

                    li.onclick = () => {
                        // CORREÇÃO: Preencher o input com o nome correto
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

        // 1. Validações Iniciais
        if (!medId) {
            showToast("Pesquise e selecione um medicamento na lista sugerida.", "error");
            return;
        }
        if (isNaN(quantity) || quantity <= 0) {
            showToast("Informe uma quantidade maior que zero.", "error");
            return;
        }

        // 2. Busca os detalhes reais do medicamento (onde moram o Ingrediente e a Concentração)
        const med = await fetchMedicationDetails(medId) || medicationList.find(m => m.id === medId);

        if (!med) {
            showToast("Erro: Medicamento não encontrado no servidor.", 'error');
            return;
        }

        // 3. TRAVA DE SEGURANÇA: Paciente de Fora (UBS Externa)
        if (selectedPatientIsExternal && (!med.programCategories || (!med.programCategories.includes('FARMACIA_BASICA') && !med.programCategories.includes('BASIC_PHARMACY')))) {
            const catStr = med.programCategories ? med.programCategories.join(', ') : 'Nenhuma';
            showToast(`BLOQUEADO: Este paciente é de outra UBS.\nEle só tem permissão para retirar itens da Farmácia Básica.\n\nO medicamento '${med.activeIngredient} ${med.concentration}' pertence às categorias: ${catStr}.`, 'error');
            return;
        }

        // 4. Verificação de Estoque (FEFO)
        const fefoResult = calculateFEFOPreview(med, quantity);

        if (!fefoResult.success) {
            showToast(`Estoque insuficiente! Temos apenas ${fefoResult.stock} unidades de ${med.activeIngredient} ${med.concentration}.`, 'error');
            return;
        }

        // 5. Adiciona à lista de dispensação usando os dados confirmados do objeto 'med'
        requestItems.push({
            medicationId: medId,
            medicationActiveIngredient: med.activeIngredient, // Corrigido typo e pegando do objeto
            medicationConcentration: med.concentration,       // Agora a variável existe!
            quantity: quantity,
            previewLots: fefoResult.previewString
        });

        // 6. Limpa os campos para a próxima inclusão
        document.getElementById('dispenseMedId').value = "";
        document.getElementById('dispenseMedInput').value = "";
        document.getElementById('medQuantity').value = "0";

        updateTable();
    }

    function updateTable() {
        const tbody = document.getElementById('itemsBody');
        const emptyMsg = document.getElementById('emptyTableMsg');
        const btnFinalize = document.getElementById('btnFinalize');

        if (!tbody) return;

        tbody.innerHTML = '';

        if (requestItems.length === 0) {
            if (emptyMsg) emptyMsg.style.display = 'block';
            if (btnFinalize) btnFinalize.classList.add('d-none');
        } else {
            if (emptyMsg) emptyMsg.style.display = 'none';
            if (btnFinalize) btnFinalize.classList.remove('d-none');
            const fragment = document.createDocumentFragment();

            requestItems.forEach((item, index) => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                <td class="text-main">
                    <span class="d-block fw-600 fs-15">${escapeHTML(item.medicationActiveIngredient)}</span>
                    <span class="text-muted fs-13 fw-400">${escapeHTML(item.medicationConcentration)}</span>
                </td>
                <td class="text-success fw-500 fs-14">
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

        // Mostra indicador de loading se quiser (ou desabilita botão)
        const btnAutoFill = document.querySelector('#autoFillProgramsContainer button');
        if (btnAutoFill) btnAutoFill.disabled = true;

        for (const enr of currentDispensePatientData.enrollments) {
            if (!enr.medications) continue;
            for (const enrMed of enr.medications) {
                const medId = enrMed.medicationId;
                const quantity = enrMed.quantity; // Correction here

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

            thirdPersonData = {
                name: tpName,
                cpf: tpDoc,
                observation: document.getElementById('tpObservation').value.trim()
            };
        }

        const itemsForBackend = requestItems.map(item => {
            return {
                medicationId: item.medicationId,
                quantity: item.quantity
            };
        });

        const payload = {
            practitionerId: loggedpractitionerId,
            patientId: patientId,
            thirdPerson: thirdPersonData,
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

            // Limpa a URL da memória após 1 minuto
            setTimeout(() => window.URL.revokeObjectURL(url), 60000);
        } catch (e) {
            console.error("Erro ao imprimir recibo:", e);
            showToast("Erro ao gerar o recibo da dispensação.", "error");
        } finally {
            setLoading('btnFinalize', false);
        }
    };

    async function salvarLote() {
        const medId = document.getElementById('medicationSelectLot').value;
        const lote = document.getElementById('lotCode').value;
        const quantidade = parseInt(document.getElementById('lotQuantity').value);
        const validade = document.getElementById('lotExpiration').value;

        const errors = [];
        if (!medId) errors.push("Selecione o medicamento para entrada.");
        if (!lote) errors.push("O Código do Lote é obrigatório.");
        if (isNaN(quantidade) || quantidade <= 0) errors.push("A Quantidade deve ser um número válido maior que zero.");
        if (!validade) errors.push("A Data de Validade é obrigatória.");

        if (errors.length > 0) {
            errors.forEach(err => showToast(err, 'error'));
            return;
        }

        const dataValidade = new Date(validade + 'T00:00:00');
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);

        if (dataValidade < hoje) {
            showToast("Regra de Segurança: Não é permitido dar entrada em um lote com validade vencida!");
            return;
        }

        const expirationDateISO = new Date(validade + 'T12:00:00Z').toISOString();

        const lotPayload = {
            expirationDate: expirationDateISO,
            lotCode: lote,
            quantity: quantidade
        };

        setLoading('btnSaveLot', true);
        try {
            const response = await fetch(`${API_URL}/medications/${medId}/lots`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify([lotPayload])
            });

            if (response.ok || response.status === 201 || response.status === 204) {
                showToast(`Sucesso! Entrada do Lote ${lote} registrada no sistema.`);
                document.getElementById('medicationSelectLot').value = "";
                document.getElementById('lotCode').value = "";
                document.getElementById('lotQuantity').value = "";
                document.getElementById('lotExpiration').value = "";
                loadMedications();
            } else if (response.status === 422) {
                try {
                    const errorData = await response.json();
                    if (errorData.errors && errorData.errors.length > 0) {
                        showToast(errorData.errors[0].message, 'error');
                    } else {
                        showToast(errorData.message || "Dados de lote inválidos.", 'error');
                    }
                } catch (e) {
                    showToast("Erro de validação no servidor.", 'error');
                }
            } else {
                try {
                    const errorData = await response.json();
                    showToast(errorData.message || "Erro ao salvar lote no servidor.", 'error');
                } catch (e) {
                    showToast("Erro ao salvar lote no servidor.", 'error');
                }
            }
        } catch (error) {
            showToast("Não foi possível conectar ao servidor para salvar o lote.", 'error');
        } finally {
            setLoading('btnSaveLot', false);
        }
    }

    async function salvarNovoMedicamento() {
        let activePrinciple = document.getElementById('newMedActive').value.trim();
        // Capitaliza a primeira letra de cada palavra (ex: "ácido acetilsalicílico" -> "Ácido Acetilsalicílico")
        if (activePrinciple) {
            activePrinciple = activePrinciple.toLowerCase().replace(/(?:^|\s)\S/g, a => a.toUpperCase());
        }
        let concentration = document.getElementById('newMedConcentration').value.trim();
        const pharmaceuticalForm = document.getElementById('newMedForm').value;
        const administrationRoute = document.getElementById('newMedRoute').value;
        const programCategories = [];
        document.querySelectorAll('input[id^="newMedProg"]:checked').forEach(cb => {
            programCategories.push(cb.value);
        });

        const errors = [];
        if (!activePrinciple) errors.push("O Princípio Ativo é obrigatório.");
        if (!concentration) errors.push("A Concentração é obrigatória.");
        if (!pharmaceuticalForm) errors.push("Selecione a Forma Farmacêutica.");
        if (!administrationRoute) errors.push("Selecione a Via de Administração.");
        if (programCategories.length === 0) errors.push("Selecione pelo menos um Programa / Categoria.");

        if (errors.length > 0) {
            errors.forEach(err => showToast(err, 'error'));
            return;
        }

        // Padroniza a concentração: remove espaços, converte tudo para minúsculo ("MG" -> "mg") e ajusta "ml" para "mL"
        concentration = concentration.replace(/\s+/g, '').toLowerCase().replace(/ml/g, 'mL');

        // Impede o cadastro de medicamentos duplicados
        const isDuplicate = medicationList.some(med =>
            med.activeIngredient &&
            med.activeIngredient.toLowerCase() === activePrinciple.toLowerCase() &&
            med.concentration &&
            med.concentration.replace(/\s+/g, '').toLowerCase() === concentration.toLowerCase()
        );

        if (isDuplicate) {
            showToast("Erro: Este medicamento já está cadastrado com esta mesma concentração!", 'error');
            return;
        }

        const payload = {
            activeIngredient: activePrinciple,
            concentration: concentration,
            pharmaceuticalForm: pharmaceuticalForm,
            administrationRoute: administrationRoute,
            programCategories: programCategories,
            lots: []
        };

        setLoading('btnSaveNewMedication', true);
        try {
            const response = await fetch(`${API_URL}/medications`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(payload)
            });

            if (response.ok || response.status === 201) {
                showToast(`Sucesso! O medicamento '${activePrinciple} ${concentration}' foi adicionado.`);
                document.getElementById('newMedActive').value = "";
                document.getElementById('newMedConcentration').value = "";
                document.getElementById('newMedForm').value = "";
                document.getElementById('newMedRoute').value = "";
                document.querySelectorAll('input[id^="newMedProg"]').forEach(cb => cb.checked = false);
                loadMedications();
            } else if (response.status === 422) {
                try {
                    const errorData = await response.json();
                    if (errorData.errors && errorData.errors.length > 0) {
                        showToast(errorData.errors[0].message, 'error');
                    } else {
                        showToast(errorData.message || "Dados do medicamento inválidos.", 'error');
                    }
                } catch (e) {
                    showToast("Erro de validação no servidor.", 'error');
                }
            } else {
                try {
                    const errorData = await response.json();
                    showToast(errorData.message || "Erro ao salvar medicamento.", 'error');
                } catch (e) {
                    showToast("Erro ao salvar medicamento.", 'error');
                }
            }

        } catch (error) {
            showToast("Não foi possível conectar ao servidor. O Java está rodando?", 'error');
        } finally {
            setLoading('btnSaveNewMedication', false);
        }
    }

    const searchEditMedInput = document.getElementById('searchEditMedInput');
    if (searchEditMedInput) {
        searchEditMedInput.addEventListener('input', function (e) {
            const query = e.target.value.toLowerCase();
            const list = document.getElementById('editMedSuggestions');

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

                    li.innerHTML = `
                    <div class="d-flex flex-column">
                        <span class="fw-600 text-main fs-14">${escapeHTML(m.activeIngredient)}</span>
                        <span class="text-muted fs-12">${escapeHTML(m.concentration || '')}</span>
                    </div>
                `;

                    li.onmouseover = () => li.style.backgroundColor = '#e0e7ff';
                    li.onmouseout = () => li.style.backgroundColor = 'transparent';

                    li.onclick = () => {
                        selectMedicationToEdit(m.id);
                        list.style.display = 'none';
                    };
                    list.appendChild(li);
                });
            }
            list.style.display = 'block';
        });
    }

    async function selectMedicationToEdit(id) {
        const med = await fetchMedicationDetails(id);
        if (!med) return;

        document.getElementById('editMedSuggestions').style.display = 'none';
        document.getElementById('searchEditMedInput').value = '';

        document.getElementById('editMedId').value = med.id;
        document.getElementById('displayMedName').innerText = med.activeIngredient;
        document.getElementById('editMedActive').value = med.activeIngredient;
        document.getElementById('editMedConcentration').value = med.concentration;
        document.getElementById('editMedForm').value = med.pharmaceuticalForm;
        document.getElementById('editMedRoute').value = med.administrationRoute;
        // Marcar as checkboxes correspondentes aos programas do medicamento
        document.querySelectorAll('input[id^="editProg"]').forEach(cb => cb.checked = false);
        if (med.programCategories) {
            med.programCategories.forEach(cat => {
                const cb = document.querySelector(`input[id^="editProg"][value="${cat}"]`);
                if (cb) cb.checked = true;
            });
        } else if (med.programCategory) {
            const cb = document.querySelector(`input[id^="editProg"][value="${med.programCategory}"]`);
            if (cb) cb.checked = true;
        }

        // Renderização dos Lotes
        const lotsBody = document.getElementById('editLotsBody');
        lotsBody.innerHTML = '';

        if (med.lots && med.lots.length > 0) {
            const fragment = document.createDocumentFragment();
            med.lots.forEach((lot, index) => {
                const dateValue = lot.expirationDate ? lot.expirationDate.split('T')[0] : '';
                const quantidadeInicial = lot.initialQuantity !== undefined ? lot.initialQuantity : lot.quantity;

                const tr = document.createElement('tr');
                tr.innerHTML = `
                <td>
                    <input type="text" id="editLotCode_${index}" value="${lot.lotCode}" 
                        class="edit-inline-input" title="Clique para editar o código do lote">
                </td>
                <td>
                    <input type="date" id="editLotExp_${index}" value="${dateValue}" 
                        class="edit-inline-input" title="Clique para editar a data de validade">
                </td>
                <td class="fw-600 text-center color-muted">
                    ${quantidadeInicial} un
                    <input type="hidden" id="editLotQty_${index}" value="${quantidadeInicial}">
                </td>
                <td class="fw-bold text-center text-success">
                    ${lot.currentQuantity || 0} un
                </td>
            `;
                fragment.appendChild(tr);
            });
            lotsBody.appendChild(fragment);
        } else {
            lotsBody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: #6b7280; padding: 20px;">Sem lotes registrados para este item.</td></tr>';
        }

        document.getElementById('editMedCard').classList.remove('d-none');

        // Mostra o botão de exclusão apenas para roles com acesso total
        const btnDelete = document.getElementById('btnDeleteMed');
        if (btnDelete) {
            btnDelete.style.display = isPrivileged() ? 'inline-flex' : 'none';
        }
    }

    function closeEditMed() {
        document.getElementById('editMedCard').classList.add('d-none');
        document.getElementById('searchEditMedInput').focus();
    }

    async function deleteMedication() {
        const id = document.getElementById('editMedId').value;
        const name = document.getElementById('displayMedName').innerText;

        if (!confirm(`⚠️ Tem certeza que deseja EXCLUIR o medicamento "${name}"?\n\nEsta ação é irreversível e removerá todos os lotes associados.`)) {
            return;
        }

        try {
            const response = await fetch(`${API_URL}/medications/${id}`, {
                method: 'DELETE',
                headers: getAuthHeaders()
            });
            if (response.ok || response.status === 204) {
                showToast(`Medicamento "${name}" excluído com sucesso.`);
                closeEditMed();
                loadMedications();
            } else {
                showToast('Erro ao excluir. Verifique se o medicamento não possui dispensações ativas.', 'error');
            }
        } catch (e) {
            showToast('Erro de conexão ao tentar excluir.', 'error');
        }
    }

    async function saveMedicationEdit() {
        const id = document.getElementById('editMedId').value;
        let activePrinciple = document.getElementById('editMedActive').value.trim();
        // Capitaliza a primeira letra de cada palavra
        if (activePrinciple) {
            activePrinciple = activePrinciple.toLowerCase().replace(/(?:^|\s)\S/g, a => a.toUpperCase());
        }
        let concentration = document.getElementById('editMedConcentration').value.trim();

        // Padroniza a concentração: remove espaços, converte tudo para minúsculo e ajusta "ml" para "mL"
        concentration = concentration.replace(/\s+/g, '').toLowerCase().replace(/ml/g, 'mL');

        // Verifica se já existe outro medicamento (com ID diferente) com o mesmo nome e concentração
        const isDuplicate = medicationList.some(med =>
            String(med.id) !== String(id) &&
            med.activeIngredient &&
            med.activeIngredient.toLowerCase() === activePrinciple.toLowerCase() &&
            med.concentration &&
            med.concentration.replace(/\s+/g, '').toLowerCase() === concentration.toLowerCase()
        );

        if (isDuplicate) {
            showToast("Erro: Já existe outro medicamento cadastrado com este nome e concentração!", 'error');
            return;
        }

        const updatedLots = [];
        const rows = document.querySelectorAll('#editLotsBody tr');

        rows.forEach((row, index) => {
            const codeInput = document.getElementById(`editLotCode_${index}`);
            const expInput = document.getElementById(`editLotExp_${index}`);
            const qtyInput = document.getElementById(`editLotQty_${index}`); // Agora ele vai achar este campo!

            if (codeInput && expInput && qtyInput) {
                const expDateISO = expInput.value ? new Date(expInput.value + 'T12:00:00Z').toISOString() : null;

                updatedLots.push({
                    expirationDate: expDateISO,
                    lotCode: codeInput.value.trim(),
                    quantity: parseInt(qtyInput.value)
                });
            }
        });

        const programCategories = [];
        document.querySelectorAll('input[id^="editProg"]:checked').forEach(cb => {
            programCategories.push(cb.value);
        });

        const payload = {
            activeIngredient: activePrinciple,
            concentration: concentration,
            pharmaceuticalForm: document.getElementById('editMedForm').value,
            administrationRoute: document.getElementById('editMedRoute').value,
            programCategories: programCategories,
            lots: updatedLots
        };

        setLoading('btnUpdateMedication', true);
        try {
            const response = await fetch(`${API_URL}/medications/${id}`, {
                method: 'PUT',
                headers: getAuthHeaders(),
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                showToast("Medicamento e lotes atualizados com sucesso!");
                closeEditMed();
                loadMedications();
            } else {
                const err = await response.json();
                showToast(err.message || "Não foi possível atualizar os dados.", 'error');
            }
        } catch (error) {
            showToast("Erro de conexão com o servidor.", 'error');
        } finally {
            setLoading('btnUpdateMedication', false);
        }
    }

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
                const practitionerName = d.practitioner ? d.practitioner.name.toLowerCase() : "";

                return dateStr.includes(query) || patientName.includes(query) || practitionerName.includes(query);
            });

            list.innerHTML = '';
            filtered.forEach(d => {
                const dateObj = new Date(d.moment);
                const dateStr = dateObj.toLocaleDateString('pt-BR');
                const timeStr = dateObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

                const patientName = d.targetPatient ? d.targetPatient.name : "Paciente Desconhecido";
                const practitionerName = d.practitioner ? d.practitioner.name : "N/A";

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
            currentEditDisppractitionerId = disp.practitioner ? (disp.practitioner.id || disp.practitioner.practitionerId) : null;
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
            document.getElementById('editDisppractitioner').value = disp.practitioner ? disp.practitioner.name : "N/A";
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
            tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: #6b7280; padding: 20px;">Nenhum medicamento nesta dispensação.</td></tr>';
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
            <td class="text-main">
                <span class="d-block fw-600 fs-15">${escapeHTML(item.name)}</span>
                <span class="text-muted fs-13 fw-400">${escapeHTML(item.concentration || '')}</span>
            </td>
            <td class="fw-500">${loteFormatado}</td>
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
        const input = document.getElementById('inputBuscaMedEdicao'); // Novo ID
        const list = document.getElementById('editDispAddMedSuggestions');
        if (!input || !list) return;

        input.addEventListener('input', function (e) {
            // TRAVA: Limpa o ID oculto sempre que digitar algo novo
            document.getElementById('inputOcultoMedIdEdicao').value = "";

            const query = e.target.value.toLowerCase();
            if (query.length < 2) { list.style.display = 'none'; return; }

            const filtered = medicationList.filter(m => m.activeIngredient && m.activeIngredient.toLowerCase().includes(query));
            list.innerHTML = '';

            filtered.forEach(m => {
                const li = document.createElement('li');
                li.style.cssText = 'padding: 10px 15px; border-bottom: 1px solid #f3f4f6; cursor: pointer; transition: background 0.2s;';
                li.innerHTML = `<span style="font-weight: 600;">${escapeHTML(m.activeIngredient)}</span> <small>(${escapeHTML(m.concentration)})</small>`;

                li.onclick = () => {
                    document.getElementById('inputOcultoMedIdEdicao').value = m.id; // Novo ID
                    input.value = `${m.activeIngredient} ${m.concentration}`;
                    list.style.display = 'none';
                };
                list.appendChild(li);
            });
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

        // Validação de Programa (Ignora BASIC_PHARMACY pois é de livre acesso)
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
            thirdPerson: currentEditDispThirdPerson, // Mantém o original já que é apenas leitura
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

            // Limpa a URL da memória após 1 minuto
            setTimeout(() => window.URL.revokeObjectURL(url), 60000);
        } catch (e) {
            console.error("Erro na reimpressão:", e);
            showToast("Erro ao buscar o recibo gerado pelo servidor.", "error");
        }
    }

    window.switchTab = switchTab;
    window.clearPatientSelection = clearPatientSelection;
    window.toggleThirdPartySection = toggleThirdPartySection;
    window.addItemDispensation = addItemDispensation;
    window.finalizeDispensation = finalizeDispensation;
    window.salvarLote = salvarLote;
    window.salvarNovoMedicamento = salvarNovoMedicamento;
    window.saveMedicationEdit = saveMedicationEdit;
    window.closeEditMed = closeEditMed;

    // Novos exports de dashboard
    window.loadMedications = loadMedications;
    window.loadDispensations = loadDispensations;
    window.fetchPatientSuggestions = fetchPatientSuggestions;
    window.populateSelects = populateSelects;
    window.fetchMedicationDetails = fetchMedicationDetails;
    window.calculateFEFOPreview = calculateFEFOPreview;
    window.updateTable = updateTable;
    window.selectMedicationToEdit = selectMedicationToEdit;
    window.deleteMedication = deleteMedication;
    window.setupEditDispensationAutocomplete = setupEditDispensationAutocomplete;
    window.selectDispensationToEdit = selectDispensationToEdit;
    window.updateEditDispensationTable = updateEditDispensationTable;
    window.removeEditDispItem = removeEditDispItem;
    window.setupEditDispAddMedSearch = setupEditDispAddMedSearch;
    window.addMedToEditDispensation = addMedToEditDispensation;
    window.saveDispensationEdit = saveDispensationEdit;
    window.closeEditDispensation = closeEditDispensation;
    window.showDispensationSummary = showDispensationSummary;
    window.closeDispensationSummary = closeDispensationSummary;
    window.reprintDispensation = reprintDispensation;
})();
