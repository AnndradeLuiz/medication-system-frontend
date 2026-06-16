/**
 * js/pedidos.js — Controle do Módulo de Pedidos e Geração de PDF para Impressão
 * Gerencia as abas de Medicamentos, Insumos Médicos e Material de Limpeza.
 * Retém em memória as quantidades solicitadas digitadas pelo usuário para que não se percam.
 * Envia as listas unificadas e estruturadas para o backend em Java gerar o PDF oficial.
 */

(function() {
    let medicationsList = [];
    let suppliesList = [];      // Insumos médicos (/supplies)
    let cleaningList = [];      // Insumos de limpeza e outros (/supply-facilities)
    
    // Variáveis cruas para reter todo o catálogo em memória e evitar requisições redundantes
    let allMedsRaw = [];
    let allSuppliesRaw = [];
    let allCleaningRaw = [];
    
    // Objeto em memória para armazenar as quantidades solicitadas
    // Chave: {tipo}_{id} (Ex: "med_15", "supply_3", "cleaning_8")
    // Valor: Inteiro (Quantidade Solicitada)
    let solicitQuantities = {};
    
    let activeTab = 'medications'; // 'medications' | 'supplies' | 'cleaning'
    let isInitialized = false;

    window.initPedidosModule = function() {
        console.log("[Pedidos Module] Inicializando novo módulo de requisições por abas...");

        // Limpar o campo de busca ao inicializar
        const searchInput = document.getElementById('pedidosSearch');
        if (searchInput) searchInput.value = '';

        // Escutar a alteração do tipo de relatório para aplicar filtros imediatamente
        const reportTypeSelect = document.getElementById("pdfReportType");
        if (reportTypeSelect) {
            reportTypeSelect.onchange = () => {
                applyReportFiltering();
            };
        }

        // Carregar itens do backend e renderizar, ou usar o cache se já existirem
        if (allMedsRaw.length > 0 || allSuppliesRaw.length > 0 || allCleaningRaw.length > 0) {
            applyReportFiltering();
        } else {
            loadAllCatalogItems();
        }
    };

    /**
     * Alterna a aba ativa e re-renderiza a tabela correspondente.
     */
    window.switchPedidosTab = function(tabName) {
        if (tabName === activeTab) return;
        activeTab = tabName;

        // Atualizar classes 'active' nos botões de aba
        const tabs = ['medications', 'supplies', 'cleaning'];
        tabs.forEach(t => {
            const btn = document.getElementById(`tab-${t}`);
            if (btn) {
                if (t === tabName) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            }
        });

        // Limpar o input de busca ao mudar de aba
        const searchInput = document.getElementById('pedidosSearch');
        if (searchInput) searchInput.value = '';

        // Renderizar os itens da nova aba ativa
        renderActiveTabTable();
    };

    /**
     * Carrega as três listas de itens em paralelo a partir das APIs correspondentes.
     */
    async function loadAllCatalogItems() {
        const tbody = document.getElementById('pedidosItemsTableBody');
        tbody.innerHTML = `<tr><td colspan="4" class="text-center p-30 text-muted"><i class="fa-solid fa-spinner fa-spin mr-10"></i>Carregando medicamentos e insumos...</td></tr>`;

        try {
            // Buscas paralelas para máximo desempenho
            const [medsRes, suppliesRes, cleaningRes] = await Promise.all([
                fetch(`${API_URL}/medications`, { headers: getAuthHeaders() }),
                fetch(`${API_URL}/supplies`, { headers: getAuthHeaders() }),
                fetch(`${API_URL}/supply-facilities`, { headers: getAuthHeaders() })
            ]);

            allMedsRaw = medsRes.ok ? await medsRes.json() : [];
            allSuppliesRaw = suppliesRes.ok ? await suppliesRes.json() : [];
            allCleaningRaw = cleaningRes.ok ? await cleaningRes.json() : [];

            // Aplica a filtragem baseando-se no tipo de relatório selecionado
            applyReportFiltering();

        } catch (error) {
            console.error("[Pedidos] Erro ao carregar catálogo:", error);
            tbody.innerHTML = `<tr><td colspan="4" class="text-center p-30 text-danger"><i class="fa-solid fa-triangle-exclamation mr-10"></i>Erro ao carregar dados do catálogo. Verifique sua conexão.</td></tr>`;
            showToast("Erro ao carregar dados do catálogo.", "error");
        }
    }

    /**
     * Filtra e atualiza dinamicamente as tabelas com base no tipo de relatório selecionado.
     */
    function applyReportFiltering() {
        const reportTypeSelect = document.getElementById("pdfReportType");
        const reportType = reportTypeSelect ? reportTypeSelect.value : "estoque-geral";
        const cleaningTabBtn = document.getElementById('tab-cleaning');
        const suppliesTabBtn = document.getElementById('tab-supplies');

        // Insumos específicos e exclusivos da Saúde da Mulher / Rede Materna
        const saudeMulherInsumos = [
            "fixador de células", "kit papanicolau", "lençol descartável", 
            "preservativo feminino", "preservativo masculino", "gel condutor", 
            "teste rápido de gravidez", "teste rápido de proteinúria"
        ];

        if (reportType === 'saude-mulher') {
            // 1. Filtrar medicamentos específicos do programa SAUDE_DA_MULHER
            medicationsList = allMedsRaw.filter(med => 
                med.programCategories && (med.programCategories.includes('SAUDE_DA_MULHER') || med.programCategories.includes('WOMENS_HEALTH'))
            );
            
            // 2. Filtrar insumos específicos da Saúde da Mulher / Rede Materna
            suppliesList = allSuppliesRaw.filter(item => 
                item.name && saudeMulherInsumos.some(si => item.name.toLowerCase().includes(si))
            );
            
            // 3. Ocultar a aba de limpeza e exibir de insumos
            cleaningList = [];
            if (cleaningTabBtn) cleaningTabBtn.style.display = 'none';
            if (suppliesTabBtn) suppliesTabBtn.style.display = 'inline-flex';
            
            // Se o usuário estava na aba de limpeza, muda automaticamente para a aba de medicamentos
            if (activeTab === 'cleaning') {
                switchPedidosTab('medications');
            }
        } else if (reportType === 'saude-mental') {
            // 1. Filtrar medicamentos específicos do programa SAUDE_MENTAL
            medicationsList = allMedsRaw.filter(med => 
                med.programCategories && (med.programCategories.includes('SAUDE_MENTAL') || med.programCategories.includes('MENTAL_HEALTH'))
            );
            
            // 2. Não há insumos nem itens de limpeza na Saúde Mental
            suppliesList = [];
            cleaningList = [];
            if (suppliesTabBtn) suppliesTabBtn.style.display = 'none';
            if (cleaningTabBtn) cleaningTabBtn.style.display = 'none';
            
            // Força a aba ativa para ser a de medicamentos
            if (activeTab !== 'medications') {
                switchPedidosTab('medications');
            }
        } else if (reportType === 'hiperdia') {
            // 1. Filtrar medicamentos específicos de Hipertensão e Diabetes
            medicationsList = allMedsRaw.filter(med => 
                med.programCategories && (
                    med.programCategories.includes('HIPERTENSAO') || 
                    med.programCategories.includes('HYPERTENSION') || 
                    med.programCategories.includes('DIABETES')
                )
            );
            
            // 2. Não há insumos nem itens de limpeza no Hiperdia
            suppliesList = [];
            cleaningList = [];
            if (suppliesTabBtn) suppliesTabBtn.style.display = 'none';
            if (cleaningTabBtn) cleaningTabBtn.style.display = 'none';
            
            // Força a aba ativa para ser a de medicamentos
            if (activeTab !== 'medications') {
                switchPedidosTab('medications');
            }
        } else {
            // Farmácia Básica e Insumos (padrão)
            medicationsList = allMedsRaw.filter(med => 
                med.programCategories && (med.programCategories.includes('FARMACIA_BASICA') || med.programCategories.includes('BASIC_PHARMACY'))
            );
            
            // Exclui os insumos da Saúde da Mulher da lista da Farmácia Básica
            suppliesList = allSuppliesRaw.filter(item => 
                !item.name || !saudeMulherInsumos.some(si => item.name.toLowerCase().includes(si))
            );
            
            cleaningList = allCleaningRaw;
            
            if (suppliesTabBtn) suppliesTabBtn.style.display = 'inline-flex';
            if (cleaningTabBtn) cleaningTabBtn.style.display = 'inline-flex';
        }

        // Ordenação alfabética
        medicationsList.sort((a, b) => {
            const nameA = a.activeIngredient || a.name || '';
            const nameB = b.activeIngredient || b.name || '';
            return nameA.localeCompare(nameB);
        });
        suppliesList.sort((a, b) => a.name.localeCompare(b.name));
        cleaningList.sort((a, b) => a.name.localeCompare(b.name));

        renderActiveTabTable();
    }

    /**
     * Renderiza a tabela baseando-se na aba ativa
     */
    function renderActiveTabTable() {
        const tbody = document.getElementById('pedidosItemsTableBody');
        tbody.innerHTML = '';

        let items = [];
        let itemKeyPrefix = '';

        if (activeTab === 'medications') {
            items = medicationsList;
            itemKeyPrefix = 'med';
        } else if (activeTab === 'supplies') {
            items = suppliesList;
            itemKeyPrefix = 'supply';
        } else if (activeTab === 'cleaning') {
            items = cleaningList;
            itemKeyPrefix = 'cleaning';
        }

        if (items.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" class="text-center p-30 text-muted">Nenhum item cadastrado nesta categoria.</td></tr>`;
            return;
        }

        items.forEach((item, index) => {
            // Calcular o estoque atual somando a quantidade de lotes válidos
            let totalStock = 0;
            if (item.lots && item.lots.length > 0) {
                item.lots.forEach(lot => {
                    // Trata quantidade nula
                    totalStock += (lot.currentQuantity !== undefined ? lot.currentQuantity : (lot.quantity || 0));
                });
            }

            // Nome formatado
            let displayName = '';
            if (activeTab === 'medications') {
                const reportTypeSelect = document.getElementById("pdfReportType");
                const reportType = reportTypeSelect ? reportTypeSelect.value : "estoque-geral";
                let formFriendly = "";
                if (reportType === 'saude-mulher') {
                    formFriendly = getFriendlyPharmForm(item.pharmaceuticalForm || item.PharmaceuticalForm);
                }
                const formSuffix = formFriendly ? ` – ${formFriendly}.` : '';
                displayName = `${escapeHTML(item.activeIngredient)} ${escapeHTML(item.concentration)}${formSuffix}`;
            } else {
                const unit = item.unit ? ` (${item.unit})` : '';
                displayName = `${escapeHTML(item.name)}${unit}`;
            }

            const itemKey = `${itemKeyPrefix}_${item.id}`;
            const currentVal = solicitQuantities[itemKey] || 0;

            tbody.innerHTML += `
                <tr>
                    <td style="text-align: center; font-weight: bold;">${index + 1}</td>
                    <td style="font-weight: 500;">${displayName}</td>
                    <td style="text-align: center; font-weight: 700; font-family: var(--font-data); color: ${totalStock === 0 ? 'var(--color-danger)' : 'var(--color-text-main)'};">
                        ${totalStock}
                    </td>
                    <td style="text-align: center;">
                        <input type="number" class="input-solicitada" value="${currentVal}" min="0" 
                            data-key="${itemKey}" 
                            data-name="${displayName}" 
                            data-stock="${totalStock}"
                            oninput="updateQuantityState(this)">
                    </td>
                </tr>
            `;
        });
    }

    /**
     * Chamada via 'oninput' do input de quantidade.
     * Atualiza o estado das quantidades em memória para que não se percam na troca de abas.
     */
    window.updateQuantityState = function(inputEl) {
        const key = inputEl.getAttribute('data-key');
        const val = parseInt(inputEl.value) || 0;
        if (val < 0) {
            solicitQuantities[key] = 0;
            inputEl.value = 0;
        } else {
            solicitQuantities[key] = val;
        }
    };

    /**
     * Filtra a tabela local baseado no input de busca.
     * Filtra ocultando as linhas da aba ativa de forma rápida e fluida.
     */
    window.filterPedidosTable = function() {
        const input = document.getElementById('pedidosSearch');
        if (!input) return;
        const filter = input.value.toUpperCase();
        const tbody = document.getElementById('pedidosItemsTableBody');
        if (!tbody) return;
        const trs = tbody.getElementsByTagName('tr');

        for (let i = 0; i < trs.length; i++) {
            const td = trs[i].getElementsByTagName('td')[1]; // A coluna 1 tem a descrição
            if (td) {
                const txtValue = td.textContent || td.innerText;
                if (txtValue.toUpperCase().indexOf(filter) > -1) {
                    trs[i].style.display = "";
                } else {
                    trs[i].style.display = "none";
                }
            }
        }
    };

    /**
     * Prepara o payload estruturado com as 3 listas e solicita a geração do PDF ao backend em Java.
     */
    window.printCurrentOrder = async function() {
        // Ler tipo de relatório selecionado no início para ser acessível em todo o escopo
        const reportTypeSelect = document.getElementById("pdfReportType");
        const reportType = reportTypeSelect ? reportTypeSelect.value : "estoque-geral";

        // Formatar data como campo em branco para preenchimento manual no PDF
        let formattedDate = '___/___/_____';

        // Mapear Medicamentos
        const medicationsPayload = medicationsList.map(item => {
            const itemKey = `med_${item.id}`;
            const qty = solicitQuantities[itemKey] || 0;
            let totalStock = 0;
            if (item.lots && item.lots.length > 0) {
                item.lots.forEach(lot => {
                    totalStock += (lot.currentQuantity !== undefined ? lot.currentQuantity : (lot.quantity || 0));
                });
            }
            let displayName = `${item.activeIngredient} ${item.concentration}`;
            if (reportType === 'saude-mulher') {
                const formFriendly = getFriendlyPharmForm(item.pharmaceuticalForm || item.PharmaceuticalForm);
                if (formFriendly) {
                    displayName += ` – ${formFriendly}.`;
                }
            }
            return {
                name: displayName,
                stock: totalStock,
                requestedQty: qty
            };
        });

        // Mapear Insumos Médicos
        const suppliesPayload = suppliesList.map(item => {
            const itemKey = `supply_${item.id}`;
            const qty = solicitQuantities[itemKey] || 0;
            let totalStock = 0;
            if (item.lots && item.lots.length > 0) {
                item.lots.forEach(lot => {
                    totalStock += (lot.currentQuantity !== undefined ? lot.currentQuantity : (lot.quantity || 0));
                });
            }
            const unit = item.unit ? ` (${item.unit})` : '';
            const displayName = `${item.name}${unit}`;
            return {
                name: displayName,
                stock: totalStock,
                requestedQty: qty
            };
        });

        // Mapear Insumos de Limpeza
        const cleaningPayload = cleaningList.map(item => {
            const itemKey = `cleaning_${item.id}`;
            const qty = solicitQuantities[itemKey] || 0;
            let totalStock = 0;
            if (item.lots && item.lots.length > 0) {
                item.lots.forEach(lot => {
                    totalStock += (lot.currentQuantity !== undefined ? lot.currentQuantity : (lot.quantity || 0));
                });
            }
            const unit = item.unit ? ` (${item.unit})` : '';
            const displayName = `${item.name}${unit}`;
            return {
                name: displayName,
                stock: totalStock,
                requestedQty: qty
            };
        });

        // Montar o Payload para o backend DTO
        const payload = {
            reportType: reportType,
            requestDate: formattedDate,
            medications: medicationsPayload,
            supplies: suppliesPayload,
            cleaningItems: cleaningPayload
        };

        try {
            showToast("Gerando PDF, aguarde...", "info");
            
            const response = await fetch(`${API_URL}/reports/pedidos`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...getAuthHeaders()
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error("Falha ao gerar o PDF pelo backend.");
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            
            // Criar link temporário para download
            const a = document.createElement('a');
            a.href = url;
            const filename = reportType === "saude-mulher"
                ? "requisicao_saude_da_mulher_e_rede_materna.pdf"
                : reportType === "saude-mental"
                ? "requisicao_saude_mental_e_neurologico.pdf"
                : reportType === "hiperdia"
                ? "requisicao_hipertensao_e_diabetes.pdf"
                : "requisicao_farmacia_basica_e_insumos.pdf";
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            
            setTimeout(() => {
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
            }, 100);
            
            showToast("PDF oficial gerado com sucesso!", "success");

        } catch (error) {
            console.error("Erro na geração do PDF:", error);
            showToast("Ocorreu um erro ao tentar gerar o PDF pelo servidor.", "error");
        }
    };

    /**
     * Helpers internos
     */
    function formatEnum(value) {
        if (!value) return '';
        return value.replace(/_/g, ' ').toLowerCase().replace(/(?:^|\s)\S/g, a => a.toUpperCase());
    }

    function getFriendlyPharmForm(form) {
        if (!form) return "";
        const mapping = {
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
            "GEL": "Gel",
            "XAROPE": "Xarope",
            "GOTAS": "Gotas",
            "INALATORIO": "Inalatório",
            "PO": "Pó"
        };
        return mapping[form] || formatEnum(form);
    }

    function escapeHTML(str) {
        if (str === null || str === undefined || str === '') return '';
        return String(str).replace(/[&<>'"`=\/]/g,
            tag => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                "'": '&#39;',
                '"': '&quot;',
                '`': '&#x60;',
                '=': '&#x3D;',
                '/': '&#x2F;'
            }[tag] || tag)
        );
    }

})();
