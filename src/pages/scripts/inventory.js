(function() {
// API_URL vem do config.js

// Estado global da página
let currentMode = 'medicamentos'; // pode ser 'insumos' ou 'medicamentos'
let insumosList = [];
let medicamentosList = [];

// --- INICIALIZAÇÃO E SEGURANÇA ---
let isInventoryModuleInitialized = false;
window.initInventoryModule = async function() {
    // Sempre executa para o HTML recém-injetado pelo SPA
    setupAutocomplete();
    handleQueryParams();

    // Carrega dados do servidor na primeira carga de script
    if (!isInventoryModuleInitialized) {
        isInventoryModuleInitialized = true;
        // Não usar await para não bloquear o resto da UI
        loadAllData();
    }

    // Trava de validade (permitir apenas datas a partir de amanhã)
    const lotExpiration = document.getElementById('lotExpiration');
    if (lotExpiration) {
        const amanhã = new Date();
        amanhã.setDate(amanhã.getDate() + 1);
        lotExpiration.min = amanhã.toISOString().split('T')[0];
    }
};

function handleQueryParams() {
    const params = new URLSearchParams(window.location.search);
    const mode = params.get('mode');
    const id = params.get('id');

    if (mode && ['medicamentos', 'insumos'].includes(mode)) {
        setMode(mode);
    } else {
        setMode(currentMode);
    }

    if (id) {
        // Pequeno delay para garantir que os selects foram populados após setMode
        setTimeout(() => {
            const lotSelect = document.getElementById('lotSelect');
            if (lotSelect) {
                lotSelect.value = id;
                // Ativa a aba de Entrada de Lote (caso o usuário tenha caído em outra por restrição)
                const entryTab = document.getElementById('tab-link-lote');
                if (entryTab) entryTab.click();
                
                const card = lotSelect.closest('.card');
                if (card) {
                    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    card.style.ring = "2px solid var(--color-primary)"; // Destaque visual temporário
                    setTimeout(() => card.style.ring = "none", 2000);
                }
            }
        }, 100);
    }
}

// --- SEGMENTED CONTROL & UI ---
function setMode(mode) {
    currentMode = mode;
    
    // Atualiza classes ativas nos segmentos
    document.getElementById('segMedicamentos').classList.toggle('active-medicamentos', mode === 'medicamentos');
    document.getElementById('segInsumos').classList.toggle('active-insumos', mode === 'insumos');

    // Atualiza tema do body para transição de cores CSS
    document.body.classList.remove('theme-insumos', 'theme-medicamentos');
    document.body.classList.add(`theme-${mode}`);

    updateUILabels();
    populateSelects(); // Recarrega os dados do seletor conforme o contexto
    closeEditCard();   // Fecha edição se estiver aberta para não cruzar dados
    
    // Limpa campos de busca
    document.getElementById('inventorySearchInput').value = '';
    document.getElementById('searchSuggestions').style.display = 'none';

    // Sincroniza o seletor da entrada unificada com o modo atual (opcional, para conveniência)
    const entryTypeSelect = document.getElementById('entryItemType');
    if (entryTypeSelect) {
        entryTypeSelect.value = mode;
        populateEntryItems();
    }
}

function updateUILabels() {
    const isMed = currentMode === 'medicamentos';
    
    let title = 'Gestão de Insumos';
    let desc = 'Controle de estoque e cadastro de insumos em geral (Médico e Sanitário)';
    let editLabel = 'Editar Insumo';
    let searchLbl = 'Nome do Insumo';
    let placeholder = 'Ex: Seringa, Sabão...';
    let icon = 'fa-solid fa-boxes-stacked';

    if (isMed) {
        title = 'Entrada de Medicamentos';
        desc = 'Central de recebimento de lotes do catálogo de remédios';
        editLabel = 'Editar Medicamento';
        searchLbl = 'Nome do Medicamento';
        placeholder = 'Ex: Amoxicilina, Dipirona...';
        icon = 'fa-solid fa-pills';
    }

    // Header
    const h1 = document.getElementById('page-title-h1');
    const p = document.getElementById('page-title-p');
    if (h1) h1.innerText = title;
    if (p) p.innerText = desc;

    // Abas
    document.getElementById('tabEditLabel').innerText = editLabel;
    
    // Card Pesquisar
    document.getElementById('lblSearchName').innerText = searchLbl;
    document.getElementById('inventorySearchInput').placeholder = placeholder;
    
    // Card Editar
    document.getElementById('lblEditName').innerText = searchLbl;
    document.getElementById('btnSaveEditLabel').innerText = `Atualizar ${isMed ? 'Medicamento' : 'Insumo'} e Lotes`;

    // Card Entrada Lote (Unificado - mantemos o título fixo ou atualizamos apenas se necessário)
    // A lógica de itens agora é gerada por populateEntryItems()

    // Card Novo Cadastro
    document.getElementById('registerCardTitle').innerText = `Cadastrar Novo ${isMed ? 'Medicamento' : 'Insumo'} no Catálogo`;
    document.getElementById('lblRegisterName').innerText = `Nome do ${isMed ? 'Medicamento' : 'Insumo'}`;
    document.getElementById('newItemName').placeholder = placeholder;
    document.getElementById('registerIcon').className = icon;
    
    // Toggle form fields
    const insumoFields = document.getElementById('insumoFields');
    const medicationFields = document.getElementById('medicationFields');
    if (insumoFields && medicationFields) {
        if (isMed) {
            insumoFields.style.display = 'none';
            medicationFields.style.display = 'block';
        } else {
            insumoFields.style.display = 'block';
            medicationFields.style.display = 'none';
        }
    }
}

// --- 1. CARREGAR DADOS ---
async function loadAllData() {
    try {
        const [suppliesRes, materialsRes, medsRes] = await Promise.all([
            window.apiClient.get('/supplies'),
            window.apiClient.get('/supply-facilities'),
            window.apiClient.get('/medications')
        ]);

        insumosList = [];
        if (suppliesRes.data) {
            const list = suppliesRes.data;
            list.forEach(i => i.supplyType = 'medical');
            insumosList.push(...list);
        }
        if (materialsRes.data) {
            const list = materialsRes.data;
            list.forEach(i => i.supplyType = 'facility');
            insumosList.push(...list);
        }
        if (medsRes.data) medicamentosList = medsRes.data;

        populateSelects();
    } catch (error) {
        console.error("Erro ao carregar os dados:", error);
    }
}

function getActiveList() {
    if (currentMode === 'insumos') return insumosList;
    if (currentMode === 'medicamentos') return medicamentosList;
    return insumosList;
}

function getActiveEndpoint(supplyType = null) {
    if (currentMode === 'medicamentos') return 'medications';
    if (supplyType === 'facility') return 'supply-facilities';
    return 'supplies';
}

function populateSelects() {
    // Esta função agora foca apenas na aba de Consulta/Edição
    const selectEdit = document.getElementById('lotSelect'); // Legado se necessário, mas vamos garantir o seletor correto
    populateEntryItems();
}

function populateEntryItems() {
    const searchInput = document.getElementById('lotSelectSearch');
    const hiddenId = document.getElementById('lotSelectId');
    const typeSelect = document.getElementById('entryItemType');
    
    if (searchInput) searchInput.value = '';
    if (hiddenId) hiddenId.value = '';

    const selectedType = typeSelect ? typeSelect.value : 'medicamentos';
    const isMed = selectedType === 'medicamentos';

    const lblSelect = document.getElementById('lblEntrySelect');
    if (lblSelect) {
        lblSelect.innerText = `Selecione o ${isMed ? 'Medicamento' : 'Insumo'}`;
    }
}

function searchEntryItems() {
    const input = document.getElementById('lotSelectSearch');
    const listEl = document.getElementById('lotSelectSuggestions');
    const hiddenId = document.getElementById('lotSelectId');
    const typeSelect = document.getElementById('entryItemType');
    
    if (!input || !listEl) return;
    
    if (hiddenId) hiddenId.value = '';

    const query = input.value.toLowerCase();
    if (query.length < 2) { 
        listEl.style.display = 'none'; 
        return; 
    }

    const selectedType = typeSelect ? typeSelect.value : 'medicamentos';
    const isMed = selectedType === 'medicamentos';
    const list = isMed ? medicamentosList : insumosList;

    const filtered = list.filter(i => {
        const nameToSearch = isMed ? i.activeIngredient : i.name;
        return nameToSearch && nameToSearch.toLowerCase().includes(query);
    });

    listEl.innerHTML = '';

    filtered.forEach(item => {
        const li = document.createElement('li');
        li.style.cssText = 'padding: 10px 15px; border-bottom: 1px solid #f3f4f6; cursor: pointer; transition: background 0.2s;';
        
        let mainText = item.name;
        let subTexts = [];
        if (item.unit) subTexts.push(item.unit);
        let subText = subTexts.join(' - ');
        
        if (isMed) {
            mainText = `${item.activeIngredient} ${item.concentration}`;
            subText = getFriendlyPharmForm(item.pharmaceuticalForm || '');
        }

        let subTextHtml = subText ? ` <small style="color: #6b7280;">(${escapeHTML(subText)})</small>` : '';
        li.innerHTML = `<span style="font-weight: 600; color: #1f2937;">${escapeHTML(mainText)}</span>${subTextHtml}`;

        li.onclick = () => {
            input.value = mainText;
            if (hiddenId) hiddenId.value = item.id;
            listEl.style.display = 'none';
        };
        listEl.appendChild(li);
    });
    
    listEl.style.display = filtered.length > 0 ? 'block' : 'none';
    listEl.classList.remove('d-none');
}

document.addEventListener('click', function(e) {
    const input = document.getElementById('lotSelectSearch');
    const listEl = document.getElementById('lotSelectSuggestions');
    if (input && listEl && !input.contains(e.target) && !listEl.contains(e.target)) {
        listEl.style.display = 'none';
    }
});

// --- 2. CONSULTAR E EDITAR ---
function setupAutocomplete() {
    const input = document.getElementById('inventorySearchInput');
    const listEl = document.getElementById('searchSuggestions');
    if (!input) return;

    input.addEventListener('input', function (e) {
        const query = e.target.value.toLowerCase();
        if (query.length < 2) { listEl.style.display = 'none'; return; }

        const activeList = getActiveList();
        const isMed = currentMode === 'medicamentos';
        
        const filtered = activeList.filter(i => {
            const nameToSearch = isMed ? i.activeIngredient : i.name;
            return nameToSearch && nameToSearch.toLowerCase().includes(query);
        });

        listEl.innerHTML = '';

        filtered.forEach(item => {
            const li = document.createElement('li');
            li.style.cssText = 'padding: 10px 15px; border-bottom: 1px solid #f3f4f6; cursor: pointer; transition: background 0.2s;';
            
            let mainText = item.name;
            let subTexts = [];
            if (item.unit) subTexts.push(item.unit);
            let subText = subTexts.join(' - ');
            
            if (isMed) {
                mainText = `${item.activeIngredient} ${item.concentration}`;
                subText = getFriendlyPharmForm(item.pharmaceuticalForm || '');
            }

            let subTextHtml = subText ? ` <small style="color: #6b7280;">(${escapeHTML(subText)})</small>` : '';
            li.innerHTML = `<span style="font-weight: 600; color: #1f2937;">${escapeHTML(mainText)}</span>${subTextHtml}`;

            li.onclick = () => {
                selectItemToEdit(item.id);
                listEl.style.display = 'none';
                input.value = '';
            };
            listEl.appendChild(li);
        });
        listEl.style.display = filtered.length > 0 ? 'block' : 'none';
    });
}

let currentEditingItem = null;

async function selectItemToEdit(id) {
    const isMed = currentMode === 'medicamentos';
    const activeList = getActiveList();
    const localItem = activeList.find(i => i.id === id);
    const supplyType = localItem ? localItem.supplyType : null;
    const endpoint = getActiveEndpoint(supplyType);
    
    try {
        const { data: item } = await window.apiClient.get(`/${endpoint}/${id}`);
        currentEditingItem = item; // Guardamos para uso no saveEdit

        document.getElementById('editItemId').value = item.id;
        
        let mainText = item.name || '';
        
        const editItemName = document.getElementById('editStockItemName');
        const lblEditName = document.getElementById('lblEditName');
        const editMedFields = document.getElementById('medicationFieldsEdit');
        const insumoFieldsEdit = document.getElementById('insumoFieldsEdit');

        if (isMed) {
            mainText = item.activeIngredient || ''; // Exibe apenas o princípio ativo no campo principal
            
            if (editItemName && editItemName.parentElement) {
                editItemName.parentElement.style.display = 'block';
                editItemName.value = mainText;
            }
            if (lblEditName) lblEditName.innerText = 'Princípio Ativo';

            if (insumoFieldsEdit) insumoFieldsEdit.style.display = 'none';
            if (editMedFields) editMedFields.style.display = 'block';

            // Preenche os campos do formulário
            const editConcValue = document.getElementById('editConcentrationValue');
            const editConcUnit = document.getElementById('editConcentrationUnit');
            if (editConcValue && editConcUnit) {
                const concStr = (item.concentration || '').trim();
                const match = concStr.match(/^([\d.,]+)\s*(.*)$/);
                if (match) {
                    editConcValue.value = match[1];
                    const unit = match[2].trim() || 'mg';
                    let found = false;
                    Array.from(editConcUnit.options).forEach(opt => {
                        if (opt.value.toLowerCase() === unit.toLowerCase()) {
                            editConcUnit.value = opt.value;
                            found = true;
                        }
                    });
                    if (!found) editConcUnit.value = 'mg';
                } else {
                    editConcValue.value = '';
                    editConcUnit.value = 'mg';
                }
            }
            
            // PharmaceuticalForm é retornado pelo backend
            document.getElementById('editPharmaceuticalForm').value = item.pharmaceuticalForm || '';
            document.getElementById('editAdministrationRoute').value = item.administrationRoute || '';
            
            if (item.programCategory) {
                document.getElementById('editProgramCategory').value = item.programCategory;
            } else if (item.programCategories && item.programCategories.length > 0) {
                document.getElementById('editProgramCategory').value = item.programCategories[0];
            } else {
                document.getElementById('editProgramCategory').value = 'BASIC_PHARMACY';
            }
        } else {
            // Exibe os campos genéricos e oculta os de medicamento
            if (editItemName && editItemName.parentElement) {
                editItemName.parentElement.style.display = 'block';
                editItemName.value = mainText;
            }
            if (insumoFieldsEdit) insumoFieldsEdit.style.display = 'block';
            if (editMedFields) editMedFields.style.display = 'none';
            
            if (lblEditName) lblEditName.innerText = 'Nome do Insumo';
            
            const supplyTypeInput = document.getElementById('editSupplyType');
            if (supplyTypeInput && localItem) {
                supplyTypeInput.value = localItem.supplyType === 'facility' ? 'facility' : 'medical';
            }
            
            const editInsumoUnit = document.getElementById('editInsumoUnit');
            if (editInsumoUnit) editInsumoUnit.value = item.unit || '';

            const editInsumoProg = document.getElementById('editInsumoProgramCategory');
            if (editInsumoProg) editInsumoProg.value = item.programCategory || 'BASIC_PHARMACY';
        }

        document.getElementById('displayItemName').innerText = mainText;

        const thQty1 = document.getElementById('thQty1');
        const thQty2 = document.getElementById('thQty2');
        if (thQty1 && thQty2) {
            if (isMed) {
                thQty1.innerText = 'Qtd. Inicial';
                thQty2.style.display = 'table-cell';
            } else {
                thQty1.innerText = 'Quantidade';
                thQty2.style.display = 'none'; // Insumos não têm qtd restante rastreada dessa forma
            }
        }

        const tbody = document.getElementById('editLotsBody');
        tbody.innerHTML = '';

        if (item.lots && item.lots.length > 0) {
            const fragment = document.createDocumentFragment();
            item.lots.forEach((lot, index) => {
                let dateValue = '';
                if (lot.expirationDate && typeof lot.expirationDate === 'string') {
                    dateValue = lot.expirationDate.split('T')[0];
                }
                const qtyValue = isMed ? lot.initialQuantity : lot.receivedQuantity;
                const curQtyValue = isMed ? lot.currentQuantity : null;
                
                const tr = document.createElement('tr');
                let cols = `
                    <td style="padding: 8px;">
                        <input type="text" id="editLotCode_${index}" value="${escapeHTML(lot.lotCode || '')}" 
                            class="edit-inline-input" style="text-align: center;" title="Clique para editar o código">
                    </td>
                    <td style="padding: 8px;">
                        <input type="date" id="editLotExp_${index}" value="${dateValue}" 
                            class="edit-inline-input" style="text-align: center;" title="Clique para editar a data de validade">
                    </td>
                    <td style="padding: 8px;">
                        <input type="number" id="editLotQty_${index}" value="${qtyValue !== undefined && qtyValue !== null ? qtyValue : 0}" 
                            class="edit-inline-input" style="text-align: center; font-weight: 600;" 
                            title="Clique para editar a quantidade recebida">
                        <input type="hidden" id="editLotCurQty_${index}" value="${curQtyValue !== undefined && curQtyValue !== null ? curQtyValue : qtyValue || 0}">
                        <input type="hidden" id="editLotOldQty_${index}" value="${qtyValue !== undefined && qtyValue !== null ? qtyValue : 0}">
                    </td>
                `;
                
                if (isMed) {
                    cols += `
                    <td style="padding: 8px; text-align: center; color: #64748b; font-weight: 600;">
                        ${curQtyValue !== undefined && curQtyValue !== null ? curQtyValue : '-'}
                    </td>`;
                }

                tr.innerHTML = cols;
                fragment.appendChild(tr);
            });
            tbody.appendChild(fragment);
        } else {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; padding: 20px; color: #6b7280;">Nenhum lote registrado.</td></tr>';
        }

        const editCard = document.getElementById('editCard');
        if (editCard) {
            editCard.classList.remove('d-none');
        }

        // Mostra botão excluir apenas para roles com acesso total
        const btnDelete = document.getElementById('btnDeleteItem');
        if (btnDelete) {
            if (isPrivileged()) {
                btnDelete.classList.remove('d-none');
                btnDelete.style.display = 'inline-flex';
            } else {
                btnDelete.classList.add('d-none');
            }
        }
    } catch (e) { 
        console.error("Erro no selectItemToEdit:", e);
        if (typeof showToast === 'function') {
            showToast("Erro ao abrir edição: " + e.message, "error");
        } else {
            alert("Erro ao abrir edição: " + e.message);
        }
    }
}

function closeEditCard() {
    const editCard = document.getElementById('editCard');
    if (editCard) {
        editCard.classList.add('d-none');
    }
}

async function deleteItem() {
    const id = document.getElementById('editItemId').value;
    const name = document.getElementById('displayItemName').innerText;
    const isMed = currentMode === 'medicamentos';
    const activeList = getActiveList();
    const localItem = activeList.find(i => i.id === id);
    const supplyType = localItem ? localItem.supplyType : null;
    const endpoint = getActiveEndpoint(supplyType);
    const tipo = isMed ? 'medicamento' : 'insumo';

    if (!confirm(`⚠️ Tem certeza que deseja EXCLUIR o ${tipo} "${name}"?\n\nEsta ação é irreversível e removerá todos os lotes associados.`)) {
        return;
    }

    try {
        await window.apiClient.delete(`/${endpoint}/${id}`);
        showToast(`${tipo.charAt(0).toUpperCase() + tipo.slice(1)} "${name}" excluído com sucesso.`);
        closeEditCard();
        loadAllData();
    } catch (e) {
        console.error(e);
        showToast(`Erro ao excluir. Verifique se o ${tipo} não está vinculado a registros ativos.`, 'error');
    }
}

async function saveEdit() {
    const id = document.getElementById('editItemId').value;
    const isMed = currentMode === 'medicamentos';
    const activeList = getActiveList();
    const localItem = activeList.find(i => i.id === id);
    const supplyType = localItem ? localItem.supplyType : null;
    const endpoint = getActiveEndpoint(supplyType);
    const updatedLots = [];

    document.querySelectorAll('#editLotsBody tr').forEach((row, index) => {
        const codeInput = document.getElementById(`editLotCode_${index}`);
        const expInput = document.getElementById(`editLotExp_${index}`);
        const qtyInput = document.getElementById(`editLotQty_${index}`);
        const curQtyInput = document.getElementById(`editLotCurQty_${index}`);

        if (codeInput && expInput && qtyInput) {
            const expDateISO = expInput.value ? new Date(expInput.value + 'T12:00:00Z').toISOString() : null;

            let lotObj = {
                expirationDate: expDateISO,
                lotCode: codeInput.value.trim()
            };
            if (isMed) {
                const newInitialQty = parseInt(qtyInput.value) || 0;
                lotObj.quantity = newInitialQty;
                if (curQtyInput) {
                    const oldCurQty = parseInt(curQtyInput.value) || 0;
                    const oldQtyInput = document.getElementById(`editLotOldQty_${index}`);
                    const oldInitialQty = oldQtyInput ? parseInt(oldQtyInput.value) || 0 : newInitialQty;
                    
                    const dispensed = oldInitialQty - oldCurQty;
                    const newCurQty = newInitialQty - dispensed;
                    
                    // Garante que não fique negativo caso o usuário diminua a qtde abaixo do que já foi dispensado
                    lotObj.curQuantity = Math.max(0, newCurQty);
                }
            } else {
                lotObj.quantity = parseInt(qtyInput.value);
            }
            updatedLots.push(lotObj);
        }
    });

    let payload = {};

    if (isMed) {
        const editItemName = document.getElementById('editStockItemName');
        let activeIngredient = editItemName ? editItemName.value.trim() : '';
        if (activeIngredient) {
            activeIngredient = activeIngredient.toLowerCase().replace(/(?:^|\s)\S/g, a => a.toUpperCase());
        }
        
        const editConcValue = document.getElementById('editConcentrationValue');
        const editConcUnit = document.getElementById('editConcentrationUnit');
        let concentration = (editConcValue && editConcValue.value.trim()) 
            ? `${editConcValue.value.trim()} ${editConcUnit ? editConcUnit.value : 'mg'}` 
            : '';
        concentration = formatConcentration(concentration);

        const editMedPharmForm = document.getElementById('editPharmaceuticalForm');
        const editMedAdminRoute = document.getElementById('editAdministrationRoute');
        const programCategory = document.getElementById('editProgramCategory').value;

        if (!programCategory) {
            showToast("O medicamento deve estar vinculado a um Programa Clínico.", 'warning');
            return;
        }

        payload = {
            activeIngredient: activeIngredient,
            concentration: concentration,
            pharmaceuticalForm: editMedPharmForm ? editMedPharmForm.value : '',
            administrationRoute: editMedAdminRoute ? editMedAdminRoute.value : '',
            programCategory: programCategory,
            lots: updatedLots
        };
    } else {
        const editItemName = document.getElementById('editStockItemName');
        const editSupplyType = document.getElementById('editSupplyType');
        
        let itemName = editItemName ? editItemName.value.trim() : '';
        if (itemName) {
            itemName = itemName.toLowerCase().replace(/(?:^|\s)\S/g, a => a.toUpperCase());
        }
        
        let supplyTypeStr = editSupplyType ? editSupplyType.value : 'medical';
        let uppercaseType = supplyTypeStr === 'facility' ? 'FACILITY' : 'MEDICAL';
        
        const editInsumoUnit = document.getElementById('editInsumoUnit');
        const editInsumoProg = document.getElementById('editInsumoProgramCategory');
        
        payload = {
            name: itemName,
            type: uppercaseType,
            unit: editInsumoUnit ? editInsumoUnit.value.trim() : '',
            programCategory: editInsumoProg ? editInsumoProg.value : 'BASIC_PHARMACY',
            lots: updatedLots
        };
    }

    setLoading('btnUpdateItem', true);
    try {
        await window.apiClient.put(`/${endpoint}/${id}`, payload);
        showToast("Atualização salva com sucesso!");
        closeEditCard();
        loadAllData();
    } catch (e) { 
        showToast("Erro de conexão.", 'error'); 
    } finally {
        setLoading('btnUpdateItem', false);
    }
}


// --- 3. ENTRADA DE LOTE ---
async function saveLot() {
    const itemId = document.getElementById('lotSelectId').value;
    const lote = document.getElementById('lotCode').value.trim();
    const quantidade = parseInt(document.getElementById('lotQuantity').value);
    let validade = document.getElementById('lotExpiration').value;
    
    // Obtém o tipo do seletor unificado para definir o endpoint
    const selectedType = document.getElementById('entryItemType').value;
    let endpoint = 'supplies';
    if (selectedType === 'medicamentos') {
        endpoint = 'medications';
    } else {
        const activeList = insumosList;
        const localItem = activeList.find(i => i.id === itemId);
        const supplyType = localItem ? localItem.supplyType : null;
        endpoint = supplyType === 'facility' ? 'supply-facilities' : 'supplies';
    }

    if (!itemId || !lote || !quantidade || !validade) {
        showToast("Preencha todos os campos do lote!");
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
        await window.apiClient.post(`/${endpoint}/${itemId}/lots`, [lotPayload]);
        showToast(`Lote ${lote} registrado com sucesso.`);
        document.getElementById('lotSelectId').value = "";
        document.getElementById('lotSelectSearch').value = "";
        document.getElementById('lotCode').value = "";
        document.getElementById('lotQuantity').value = "";
        document.getElementById('lotExpiration').value = "";
        loadAllData();
    } catch (error) {
        showToast("Erro ao registrar lote no servidor.", 'error');
    } finally {
        setLoading('btnSaveLot', false);
    }
}

// --- FUNÇÕES AUXILIARES DE FORMATAÇÃO ---
function formatEnum(value) {
    if (!value) return '';
    return value.replace(/_/g, ' ').toLowerCase().replace(/(?:^|\s)\S/g, a => a.toUpperCase());
}

function getFriendlyPharmForm(form) {
    if (!form) return "";
    const mapping = {
        // Chaves em Inglês
        "TABLET": "Comprimido",
        "CAPSULE": "Cápsula",
        "SYRUP": "Xarope",
        "SUSPENSION": "Suspensão Oral",
        "DROPS": "Gotas",
        "OINTMENT": "Pomada",
        "CREAM": "Creme",
        "INJECTABLE": "Injetável",
        "SUPPOSITORY": "Supositório",
        "TRANSDERMAL_PATCH": "Adesivo Transdérmico",
        "LOTION": "Loção",
        "SOLUTION": "Solução Oral",
        "ELIXIR": "Elixir",
        "GEL": "Gel",
        "PASTE": "Pasta",
        "POWDER": "Pó",
        "INHALER": "Inalatório",
        "AMPOULE": "Ampola",
        "BOTTLE_PREGNANT": "Frasco (P/ Gestantes)",
        "TABLET_PREGNANT": "Comprimido (P/ Gestantes)",

        // Fallback em Português
        "COMPRIMIDO": "Comprimido",
        "AMPOLA": "Ampola",
        "FRASCO_GESTANTES": "Frasco (P/ Gestantes)",
        "COMPRIMIDO_GESTANTES": "Comprimido (P/ Gestantes)",
        "CAPSULA": "Cápsula",
        "SOLUCAO": "Solução Oral",
        "SUSPENSAO": "Suspensão Oral",
        "INJETAVEL": "Injetável",
        "POMADA": "Pomada",
        "CREME": "Creme",
        "XAROPE": "Xarope",
        "GOTAS": "Gotas",
        "INALATORIO": "Inalatório",
        "PO": "Pó"
    };
    return mapping[form] || formatEnum(form);
}

function formatConcentration(conc) {
    if (!conc) return "";
    let formatted = conc.toLowerCase().trim();
    // Reemplaza mg/ml com mg/mL
    formatted = formatted.replace(/mg\/ml/g, "mg/mL");
    formatted = formatted.replace(/g\/ml/g, "g/mL");
    formatted = formatted.replace(/ui/g, "UI"); // UI is uppercase
    
    // Adiciona espaço entre o número e a unidade
    formatted = formatted.replace(/(\d)\s*(mg|g|mcg|ml|ui)/gi, "$1 $2");
    
    return formatted;
}

// --- 4. NOVO CADASTRO ---
async function saveNewItem() {
    const isMed = currentMode === 'medicamentos';
    let endpoint = 'supplies';
    let payload = {};
    let itemTitle = "";

    if (isMed) {
        endpoint = 'medications';
        const activeInput = document.getElementById('newMedActiveIngredient') || document.getElementById('newItemName');
        let activeIngredient = activeInput ? activeInput.value.trim() : '';
        
        const concValue = document.getElementById('newMedConcentrationValue');
        const concUnit = document.getElementById('newMedConcentrationUnit');
        let concentration = (concValue && concValue.value.trim()) 
            ? `${concValue.value.trim()} ${concUnit ? concUnit.value : 'mg'}`
            : '';
        
        if (!activeIngredient || !concentration) {
            showToast("Princípio Ativo e Concentração são obrigatórios.", 'warning');
            return;
        }

        activeIngredient = activeIngredient.toLowerCase().replace(/(?:^|\s)\S/g, a => a.toUpperCase());
        concentration = formatConcentration(concentration);
        itemTitle = `${activeIngredient} ${concentration}`;

        const programCategory = document.getElementById('newProgramCategory').value;

        if (!programCategory) {
            showToast("O medicamento deve estar vinculado a um Programa Clínico.", 'warning');
            return;
        }

        payload = {
            activeIngredient: activeIngredient,
            concentration: concentration,
            pharmaceuticalForm: document.getElementById('newMedForm').value,
            administrationRoute: document.getElementById('newMedRoute').value,
            programCategory: programCategory,
            lots: []
        };
    } else {
        const supplyType = document.getElementById('newInsumoType').value;
        endpoint = supplyType === 'facility' ? 'supply-facilities' : 'supplies';
        
        let nome = document.getElementById('newItemName').value.trim();
        if (!nome) {
            showToast("O Nome é obrigatório.", 'warning');
            return;
        }
        nome = nome.toLowerCase().replace(/(?:^|\s)\S/g, a => a.toUpperCase());
        const unitInput = document.getElementById('newInsumoUnit');
        const unit = unitInput ? unitInput.value.trim() : '';
        const programCategoryInput = document.getElementById('newInsumoProgramCategory');
        const programCategory = programCategoryInput ? programCategoryInput.value : 'BASIC_PHARMACY';
        
        itemTitle = nome;

        payload = {
            name: nome,
            unit: unit || null,
            programCategory: programCategory,
            lots: []
        };
    }

    setLoading('btnSaveNewCatalogItem', true);
    try {
        await window.apiClient.post(`/${endpoint}`, payload);
        showToast(`'${itemTitle}' cadastrado com sucesso.`);
        if (isMed) {
            if (document.getElementById('newItemName')) document.getElementById('newItemName').value = "";
            if (document.getElementById('newMedConcentrationValue')) document.getElementById('newMedConcentrationValue').value = "";
            // Selects voltam para a primeira opção
            if (document.getElementById('newMedForm')) document.getElementById('newMedForm').selectedIndex = 0;
            if (document.getElementById('newMedRoute')) document.getElementById('newMedRoute').selectedIndex = 0;
            document.querySelectorAll('input[id^="newMedProg"]').forEach(cb => cb.checked = false);
        } else {
            if (document.getElementById('newItemName')) document.getElementById('newItemName').value = "";
            if (document.getElementById('newInsumoUnit')) document.getElementById('newInsumoUnit').value = "";
        }
        loadAllData();
    } catch (error) {
        showToast("Erro ao cadastrar os dados.", 'error');
    } finally {
        setLoading('btnSaveNewCatalogItem', false);
    }
}

// --- CONTROLE DE ABAS ---
function switchTab(tabId, element) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-section').forEach(s => {
        s.classList.remove('active-section');
        s.style.display = 'none';
    });

    element.classList.add('active');
    const secaoAtiva = document.getElementById(tabId);
    if (secaoAtiva) {
        secaoAtiva.classList.add('active-section');
        secaoAtiva.style.display = 'block';
    }
}

// --- EXPORTAÇÕES ---
window.setMode = setMode;
window.saveEdit = saveEdit;
window.closeEditCard = closeEditCard;
window.saveNewItem = saveNewItem;
window.saveLot = saveLot;
window.switchTab = switchTab;
window.selectItemToEdit = selectItemToEdit;

// --- UTILS ---
function formatConcentration(val) {
    if (!val) return val;
    let formatted = val.toLowerCase();
    formatted = formatted.replace(/(^|\d|\s|\/)ml(\s|$)/g, '$1mL$2');
    formatted = formatted.replace(/(^|\d|\s|\/)ui(\s|$)/g, '$1UI$2');
    return formatted;
}

// Novos Exports do IIFE
window.handleQueryParams = handleQueryParams;
window.updateUILabels = updateUILabels;
window.loadAllData = loadAllData;
window.getActiveList = getActiveList;
window.getActiveEndpoint = getActiveEndpoint;
window.populateSelects = populateSelects;
window.populateEntryItems = populateEntryItems;
window.searchEntryItems = searchEntryItems;
window.setupAutocomplete = setupAutocomplete;
window.deleteItem = deleteItem;
window.formatConcentration = formatConcentration;

})();
