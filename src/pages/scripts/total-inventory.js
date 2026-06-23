(function () {
    let currentSort = { field: null, direction: 'asc' };
    let searchPerformed = true; // Auto load
    let inventoryCurrentPage = 0;
    let inventoryTotalPages = 1;

    let isTotalInventoryModuleInitialized = false;
    window.initTotalInventoryModule = function () {
        if (isTotalInventoryModuleInitialized) return;
        isTotalInventoryModuleInitialized = true;

        // Busca disparada apenas ao apertar Enter no input (opcional) ou clicar em Filtrar
        const searchInput = document.getElementById('totalInventorySearch');
        if (searchInput) {
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    applyTotalInventoryFilters();
                }
            });
        }

        // Mensagem inicial de tela vazia até que o usuário filtre
        const tbody = document.getElementById('totalInventoryBody');
        if (tbody && tbody.innerHTML.trim() === '') {
            tbody.innerHTML = `<tr><td colspan="6" class="empty-state-cell">Defina seus filtros e clique em <b>Filtrar</b> (ou digite e aperte Enter) para carregar os dados.</td></tr>`;
        }

        const modal = document.getElementById('totalInventoryFilterModal');
        if (modal) {
            modal.addEventListener('click', function (e) {
                if (e.target === this) {
                    closeTotalInventoryFilterModal();
                }
            });
        }
    };

    window.loadInventory = async function (page = 0) {
        inventoryCurrentPage = page;
        await fetchPaginatedInventory();
    };

    async function fetchPaginatedInventory() {
        setLoading(true);
        const tbody = document.getElementById('totalInventoryBody');

        const typeFilter = document.getElementById('totalInventoryTypeFilter').value;
        const statusFilter = document.getElementById('totalInventoryStatusFilter').value;
        const searchFilter = document.getElementById('totalInventorySearch').value;

        // Default size is 20, but the UI has "totalInventoryPageSize" which could be 'all', '10', '25', '50'.
        let pageSize = document.getElementById('totalInventoryPageSize').value;
        if (pageSize === 'all') pageSize = 1000;

        try {
            let sortParam = '';
            if (currentSort.field) {
                sortParam = `&sort=${currentSort.field},${currentSort.direction}`;
            }
            const endpoint = `/inventory?page=${inventoryCurrentPage}&size=${pageSize}&query=${encodeURIComponent(searchFilter)}&type=${typeFilter}&status=${statusFilter}${sortParam}`;
            const { data: pageData } = await window.apiClient.get(endpoint);

            // Render table
            renderInventoryPage(pageData.content);

            // Update pagination UI
            const pageInfo = pageData.page || pageData;
            inventoryTotalPages = pageInfo.totalPages || 1;
            document.getElementById('totalInventoryCurrentPage').innerText = `Pág ${pageInfo.number + 1} de ${inventoryTotalPages}`;

            const startItem = pageInfo.totalElements === 0 ? 0 : (pageInfo.number * pageInfo.size) + 1;
            const endItem = Math.min((pageInfo.number + 1) * pageInfo.size, pageInfo.totalElements);
            document.getElementById('totalInventoryPageInfo').innerText = `${startItem}-${endItem} de ${pageInfo.totalElements}`;

            document.getElementById('btnPrevTotalInventory').disabled = pageInfo.number === 0;
            document.getElementById('btnNextTotalInventory').disabled = pageInfo.number >= (inventoryTotalPages - 1);
        } catch (error) {
            console.error("Erro ao buscar inventário:", error);
            tbody.innerHTML = `<tr><td colspan="6" class="empty-state-cell text-danger">Erro de conexão.</td></tr>`;
            showToast("Erro ao processar dados do inventário.", "error");
        } finally {
            setLoading(false);
        }
    }

    window.prevTotalInventoryPage = function () {
        if (inventoryCurrentPage > 0) {
            loadInventory(inventoryCurrentPage - 1);
        }
    };

    window.nextTotalInventoryPage = function () {
        if (inventoryCurrentPage < inventoryTotalPages - 1) {
            loadInventory(inventoryCurrentPage + 1);
        }
    };

    function renderInventoryPage(items) {
        const tbody = document.getElementById('totalInventoryBody');
        tbody.innerHTML = '';

        if (!items || items.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="empty-state-cell">Nenhum item encontrado com os filtros atuais.</td></tr>`;
            return;
        }

        items.forEach(item => {
            const typeLabel = {
                'medicamento': 'Medicamento',
                'medical': 'Médico',
                'facility': 'Sanitário e Uso Geral'
            }[item.type] || 'Desconhecido';

            const rawCategory = item.programCategory || item.category || 'Geral';
            const categoryLabel = {
                'FARMACIA_BASICA': 'Farmácia Básica',
                'SAUDE_DA_MULHER': 'Saúde da Mulher',
                'SAUDE_MENTAL': 'Saúde Mental',
                'DIABETES': 'Diabetes',
                'HIPERTENSAO': 'Hipertensão',
                'Geral': 'Geral'
            }[rawCategory] || rawCategory;

            // Adaptando a nova estrutura de item vinda da API /inventory
            const statusClass = item.currentStock === 0 ? 'status-vazio' : (item.currentStock <= 50 ? 'status-critico' : 'status-normal');
            const statusLabel = item.currentStock === 0 ? 'Sem Estoque' : (item.currentStock <= 50 ? 'Baixo' : 'Normal');
            const statusHtml = `<span class="status-badge ${statusClass}">${statusLabel}</span>`;

            let expDateHtml = 'N/A';
            if (item.expirationDate) {
                const expDate = new Date(item.expirationDate);
                // Corrige timezone (mostra UTC local sem offset bizarro)
                expDateHtml = expDate.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
            }

            tbody.innerHTML += `
            <tr class="inventory-row">
                <td class="cell-bold cell-center">${escapeHTML(item.name || '')}</td>
                <td class="cell-center"><span class="type-badge">${escapeHTML(item.type || '')}</span></td>
                <td class="cell-center">${escapeHTML(categoryLabel)}</td>
                <td class="cell-center cell-data cell-strong">${item.currentStock}</td>
                <td class="cell-center cell-data">${expDateHtml}</td>
                <td class="cell-center">${statusHtml}</td>
            </tr>
        `;
        });
    }

    function applyTotalInventoryFilters() {
        loadInventory(0); // Trigger a API call at page 0 with new filters
    }

    function handleTotalInventorySort(field) {
        if (currentSort.field === field) {
            currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
        } else {
            currentSort.field = field;
            currentSort.direction = 'asc';
        }

        // Atualizar ícones
        document.querySelectorAll('.sort-icon').forEach(icon => {
            icon.classList.remove('active', 'fa-sort-up', 'fa-sort-down');
            icon.classList.add('fa-sort');
        });

        const icon = document.getElementById(`sort-${field}`);
        icon.classList.remove('fa-sort');
        icon.classList.add('active', currentSort.direction === 'asc' ? 'fa-sort-up' : 'fa-sort-down');

        sortData(field, currentSort.direction);
    }

    function sortData(field, direction) {
        loadInventory(0);
    }

    // Lógica do Modal de Filtros Avançados
    function openTotalInventoryFilterModal() {
        document.getElementById('totalInventoryFilterModal').classList.add('active');
    }

    function closeTotalInventoryFilterModal() {
        document.getElementById('totalInventoryFilterModal').classList.remove('active');
        applyTotalInventoryFilters();
    }

    function resetTotalInventoryFilters() {
        document.getElementById('totalInventoryTypeFilter').value = 'all';
        document.getElementById('totalInventoryStatusFilter').value = 'all';
        document.getElementById('totalInventoryPageSize').value = 'all';
        if (document.getElementById('totalInventorySearch')) document.getElementById('totalInventorySearch').value = '';
        applyTotalInventoryFilters();
    }

    // Exports
    window.applyTotalInventoryFilters = applyTotalInventoryFilters;
    window.handleTotalInventorySort = handleTotalInventorySort;
    window.openTotalInventoryFilterModal = openTotalInventoryFilterModal;
    window.closeTotalInventoryFilterModal = closeTotalInventoryFilterModal;
    window.resetTotalInventoryFilters = resetTotalInventoryFilters;
})();
