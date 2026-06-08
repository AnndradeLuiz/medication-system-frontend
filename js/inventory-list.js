(function () {
    let currentSort = { field: null, direction: 'asc' };
    let searchPerformed = true; // Auto load
    let inventoryCurrentPage = 0;
    let inventoryTotalPages = 1;

    let isInventoryModuleInitialized = false;
    window.initInventoryModule = function () {
        if (isInventoryModuleInitialized) return;
        isInventoryModuleInitialized = true;

        // Busca disparada apenas ao apertar Enter no input (opcional) ou clicar em Filtrar
        const searchInput = document.getElementById('inventorySearch');
        if (searchInput) {
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    applyFilters();
                }
            });
        }

        // Mensagem inicial de tela vazia até que o usuário filtre
        const tbody = document.getElementById('inventoryBody');
        if (tbody && tbody.innerHTML.trim() === '') {
            tbody.innerHTML = `<tr style="height: 400px;"><td colspan="6" class="text-center p-40 text-muted" style="vertical-align: middle;">Defina seus filtros e clique em <b>Filtrar</b> (ou digite e aperte Enter) para carregar os dados.</td></tr>`;
        }

        const modal = document.getElementById('filterModal');
        if (modal) {
            modal.addEventListener('click', function (e) {
                if (e.target === this) {
                    closeFilterModal();
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
        const tbody = document.getElementById('inventoryBody');

        const typeFilter = document.getElementById('typeFilter').value;
        const statusFilter = document.getElementById('inventoryStatusFilter').value;
        const searchFilter = document.getElementById('inventorySearch').value;

        // Default size is 20, but the UI has "inventoryPageSize" which could be 'all', '10', '25', '50'.
        let pageSize = document.getElementById('inventoryPageSize').value;
        if (pageSize === 'all') pageSize = 1000;

        try {
            let sortParam = '';
            if (currentSort.field) {
                sortParam = `&sort=${currentSort.field},${currentSort.direction}`;
            }
            const url = `${API_URL}/inventory?page=${inventoryCurrentPage}&size=${pageSize}&query=${encodeURIComponent(searchFilter)}&type=${typeFilter}&status=${statusFilter}${sortParam}`;
            const response = await fetch(url, { headers: getAuthHeaders() });

            if (response.ok) {
                const pageData = await response.json();

                // Render table
                renderInventoryPage(pageData.content);

                // Update pagination UI
                const pageInfo = pageData.page || pageData;
                inventoryTotalPages = pageInfo.totalPages || 1;
                document.getElementById('inventoryCurrentPage').innerText = `Pág ${pageInfo.number + 1} de ${inventoryTotalPages}`;

                const startItem = pageInfo.totalElements === 0 ? 0 : (pageInfo.number * pageInfo.size) + 1;
                const endItem = Math.min((pageInfo.number + 1) * pageInfo.size, pageInfo.totalElements);
                document.getElementById('inventoryPageInfo').innerText = `${startItem}-${endItem} de ${pageInfo.totalElements}`;

                document.getElementById('btnPrevInventory').disabled = pageInfo.number === 0;
                document.getElementById('btnNextInventory').disabled = pageInfo.number >= (inventoryTotalPages - 1);
            } else {
                throw new Error('Falha na API');
            }
        } catch (error) {
            console.error("Erro ao buscar inventário:", error);
            tbody.innerHTML = `<tr><td colspan="6" class="text-center p-40 text-danger">Erro de conexão.</td></tr>`;
            showToast("Erro ao processar dados do inventário.", "error");
        } finally {
            setLoading(false);
        }
    }

    window.prevInventoryPage = function () {
        if (inventoryCurrentPage > 0) {
            loadInventory(inventoryCurrentPage - 1);
        }
    };

    window.nextInventoryPage = function () {
        if (inventoryCurrentPage < inventoryTotalPages - 1) {
            loadInventory(inventoryCurrentPage + 1);
        }
    };

    function renderInventoryPage(items) {
        const tbody = document.getElementById('inventoryBody');
        tbody.innerHTML = '';

        if (!items || items.length === 0) {
            tbody.innerHTML = `<tr style="height: 400px;"><td colspan="6" style="text-align: center; vertical-align: middle; padding: 40px; color: var(--color-text-muted);">Nenhum item encontrado com os filtros atuais.</td></tr>`;
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
            <tr style="height: 55px;">
                <td style="font-weight: 600; text-align: center;">${escapeHTML(item.name || '')}</td>
                <td style="text-align: center;"><span class="type-badge">${escapeHTML(item.type || '')}</span></td>
                <td style="text-align: center;">${escapeHTML(categoryLabel)}</td>
                <td style="text-align: center; font-family: var(--font-data); font-weight: 700;">${item.currentStock}</td>
                <td style="text-align: center; font-family: var(--font-data);">${expDateHtml}</td>
                <td style="text-align: center;">${statusHtml}</td>
            </tr>
        `;
        });
    }

    function applyFilters() {
        loadInventory(0); // Trigger a API call at page 0 with new filters
    }

    function handleSort(field) {
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
    function openFilterModal() {
        document.getElementById('filterModal').classList.add('active');
    }

    function closeFilterModal() {
        document.getElementById('filterModal').classList.remove('active');
        applyFilters();
    }

    function resetFilters() {
        document.getElementById('typeFilter').value = 'all';
        document.getElementById('inventoryStatusFilter').value = 'all';
        document.getElementById('inventoryPageSize').value = 'all';
        if (document.getElementById('inventorySearch')) document.getElementById('inventorySearch').value = '';
        applyFilters();
    }

    // Exports
    window.applyFilters = applyFilters;
    window.handleSort = handleSort;
    window.openFilterModal = openFilterModal;
    window.closeFilterModal = closeFilterModal;
    window.resetFilters = resetFilters;
})();
