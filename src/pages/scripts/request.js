(function () {
    let medicationsList = [];
    let suppliesList = [];
    let cleaningList = [];

    let allMedsRaw = [];
    let allSuppliesRaw = [];
    let allCleaningRaw = [];

    let solicitQuantities = {};

    let activeTab = 'medications';
    let isInitialized = false;

    window.initRequestModule = function () {
        console.log("[Pedidos Module] Inicializando novo módulo de requisições por abas...");

        const searchInput = document.getElementById('requestSearch');
        if (searchInput) searchInput.value = '';

        const reportTypeSelect = document.getElementById("pdfReportType");
        if (reportTypeSelect) {
            reportTypeSelect.onchange = () => {
                applyReportFiltering();
            };
        }

        if (allMedsRaw.length > 0 || allSuppliesRaw.length > 0 || allCleaningRaw.length > 0) {
            applyReportFiltering();
        } else {
            loadAllCatalogItems();
        }
    };

    window.switchRequestTab = function (tabName) {
        if (tabName === activeTab) return;
        activeTab = tabName;

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

        const searchInput = document.getElementById('requestSearch');
        if (searchInput) searchInput.value = '';

        renderActiveTabTable();
    };

    async function loadAllCatalogItems() {
        const tbody = document.getElementById('requestItemsTableBody');
        tbody.innerHTML = `<tr><td colspan="4" class="text-center p-30 text-muted"><i class="fa-solid fa-spinner fa-spin mr-10"></i>Carregando medicamentos e insumos...</td></tr>`;

        try {
            const [medsRes, suppliesRes, cleaningRes] = await Promise.all([
                fetch(`${API_URL}/medications`, { headers: getAuthHeaders() }),
                fetch(`${API_URL}/supplies`, { headers: getAuthHeaders() }),
                fetch(`${API_URL}/supply-facilities`, { headers: getAuthHeaders() })
            ]);

            allMedsRaw = medsRes.ok ? await medsRes.json() : [];
            allSuppliesRaw = suppliesRes.ok ? await suppliesRes.json() : [];
            allCleaningRaw = cleaningRes.ok ? await cleaningRes.json() : [];

            applyReportFiltering();

        } catch (error) {
            console.error("[Pedidos] Erro ao carregar catálogo:", error);
            tbody.innerHTML = `<tr><td colspan="4" class="text-center p-30 text-danger"><i class="fa-solid fa-triangle-exclamation mr-10"></i>Erro ao carregar dados do catálogo. Verifique sua conexão.</td></tr>`;
            showToast("Erro ao carregar dados do catálogo.", "error");
        }
    }

    function applyReportFiltering() {
        const reportTypeSelect = document.getElementById("pdfReportType");
        const reportType = reportTypeSelect ? reportTypeSelect.value : "estoque-geral";
        const cleaningTabBtn = document.getElementById('tab-cleaning');
        const suppliesTabBtn = document.getElementById('tab-supplies');

        const saudeMulherInsumos = [
            "fixador de células", "kit papanicolau", "lençol descartável",
            "preservativo feminino", "preservativo masculino", "gel condutor",
            "teste rápido de gravidez", "teste rápido de proteinúria"
        ];

        if (reportType === 'saude-mulher') {
            medicationsList = allMedsRaw.filter(med =>
                med.programCategory && (med.programCategory === 'SAUDE_DA_MULHER' || med.programCategory === 'WOMENS_HEALTH')
            );

            suppliesList = allSuppliesRaw.filter(item =>
                item.name && saudeMulherInsumos.some(si => item.name.toLowerCase().includes(si))
            );
            cleaningList = [];
            if (cleaningTabBtn) cleaningTabBtn.style.display = 'none';
            if (suppliesTabBtn) suppliesTabBtn.style.display = 'inline-flex';

            if (activeTab === 'cleaning') {
                switchRequestTab('medications');
            }
        } else if (reportType === 'saude-mental') {
            medicationsList = allMedsRaw.filter(med =>
                med.programCategory && (med.programCategory === 'SAUDE_MENTAL' || med.programCategory === 'MENTAL_HEALTH')
            );

            suppliesList = [];
            cleaningList = [];
            if (suppliesTabBtn) suppliesTabBtn.style.display = 'none';
            if (cleaningTabBtn) cleaningTabBtn.style.display = 'none';

            if (activeTab !== 'medications') {
                switchRequestTab('medications');
            }
        } else if (reportType === 'hiperdia') {
            medicationsList = allMedsRaw.filter(med =>
                med.programCategory && (
                    med.programCategory === 'HIPERTENSAO' ||
                    med.programCategory === 'HYPERTENSION' ||
                    med.programCategory === 'DIABETES'
                )
            );

            suppliesList = [];
            cleaningList = [];
            if (suppliesTabBtn) suppliesTabBtn.style.display = 'none';
            if (cleaningTabBtn) cleaningTabBtn.style.display = 'none';

            if (activeTab !== 'medications') {
                switchRequestTab('medications');
            }
        } else {
            medicationsList = allMedsRaw.filter(med =>
                med.programCategory && (med.programCategory === 'FARMACIA_BASICA' || med.programCategory === 'BASIC_PHARMACY')
            );

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

    function renderActiveTabTable() {
        const tbody = document.getElementById('requestItemsTableBody');
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
            let totalStock = 0;
            if (item.lots && item.lots.length > 0) {
                item.lots.forEach(lot => {
                    totalStock += (lot.currentQuantity !== undefined ? lot.currentQuantity : (lot.quantity || 0));
                });
            }

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

    window.updateQuantityState = function (inputEl) {
        const key = inputEl.getAttribute('data-key');
        const val = parseInt(inputEl.value) || 0;
        if (val < 0) {
            solicitQuantities[key] = 0;
            inputEl.value = 0;
        } else {
            solicitQuantities[key] = val;
        }
    };

    window.filterRequestTable = function () {
        const input = document.getElementById('requestSearch');
        if (!input) return;
        const filter = input.value.toUpperCase();
        const tbody = document.getElementById('requestItemsTableBody');
        if (!tbody) return;
        const trs = tbody.getElementsByTagName('tr');

        for (let i = 0; i < trs.length; i++) {
            const td = trs[i].getElementsByTagName('td')[1];
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

    window.printCurrentOrder = async function () {
        const reportTypeSelect = document.getElementById("pdfReportType");
        const reportType = reportTypeSelect ? reportTypeSelect.value : "estoque-geral";

        let formattedDate = '___/___/_____';

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

            const a = document.createElement('a');
            a.href = url;
            const filename = reportType === "saude-mulher"
                ? "request_womens_health.pdf"
                : reportType === "saude-mental"
                    ? "request_mental_health.pdf"
                    : reportType === "hiperdia"
                        ? "request_hypertension_diabetes.pdf"
                        : "request_basic_pharmacy_and_supplies.pdf";
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
