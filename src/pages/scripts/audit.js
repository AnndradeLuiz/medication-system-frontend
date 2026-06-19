(function () {
    let auditCurrentPage = 0;
    let auditTotalPages = 1;
    let auditPageSize = 20;

    // --- CARREGAR LOGS DE AUDITORIA ---
    async function loadAuditLogs(page = 0) {
        auditCurrentPage = page;

        const tableBody = document.getElementById('auditTableBody');
        if (tableBody) {
            tableBody.innerHTML = '<tr><td colspan="6" class="empty-msg"><i class="fa-solid fa-spinner fa-spin"></i> Carregando logs de auditoria...</td></tr>';
        }

        const start = document.getElementById('auditFilterStart').value;
        const end = document.getElementById('auditFilterEnd').value;
        const practitionerName = document.getElementById('auditFilterUser').value;
        const action = document.getElementById('auditFilterAction').value;
        const entityType = document.getElementById('auditFilterEntity').value;
        const keyword = document.getElementById('auditFilterKeyword').value;

        let queryParams = [];
        queryParams.push(`page=${auditCurrentPage}`);
        queryParams.push(`size=${auditPageSize}`);
        queryParams.push(`sort=moment,desc`);

        if (start) {
            const startDate = new Date(`${start}T00:00:00`);
            queryParams.push(`start=${startDate.toISOString()}`);
        }
        if (end) {
            const endDate = new Date(`${end}T23:59:59`);
            queryParams.push(`end=${endDate.toISOString()}`);
        }
        if (practitionerName) queryParams.push(`practitionerName=${encodeURIComponent(practitionerName)}`);
        if (action) queryParams.push(`action=${encodeURIComponent(action)}`);
        if (entityType) queryParams.push(`entityType=${encodeURIComponent(entityType)}`);
        if (keyword) queryParams.push(`keyword=${encodeURIComponent(keyword)}`);

        const url = `/audit-logs?${queryParams.join('&')}`;

        try {
            const { data: pageData } = await window.apiClient.get(url);
            const logs = pageData.content || [];

            // Extrai as informações de paginação (suporta Spring Boot 2.x e 3.3+)
            const pageInfo = pageData.page || pageData;

            // Atualizar paginação UI
            auditTotalPages = pageInfo.totalPages || 1;
            const currentPageNum = pageInfo.number !== undefined ? pageInfo.number : 0;
            const pageSize = pageInfo.size || 20;
            const totalElements = pageInfo.totalElements || 0;

            document.getElementById('auditCurrentPage').innerText = `Pág ${currentPageNum + 1} de ${auditTotalPages}`;

            const startItem = totalElements === 0 ? 0 : (currentPageNum * pageSize) + 1;
            const endItem = Math.min((currentPageNum + 1) * pageSize, totalElements);
            document.getElementById('auditPageInfo').innerText = `${startItem}-${endItem} de ${totalElements}`;

            const isFirst = currentPageNum === 0;
            const isLast = currentPageNum >= (auditTotalPages - 1);

            document.getElementById('btnPrevAudit').disabled = pageData.first !== undefined ? pageData.first : isFirst;
            document.getElementById('btnNextAudit').disabled = pageData.last !== undefined ? pageData.last : isLast;

            renderAuditTable(logs);
        } catch (e) {
            console.error(e);
            if (tableBody) {
                let errorMsg = e.message || 'Erro ao carregar logs de auditoria.';
                if (e.status === 403) {
                    errorMsg = 'Acesso negado. Apenas administradores ou enfermeiros gerentes podem visualizar a auditoria.';
                }
                tableBody.innerHTML = `<tr><td colspan="6" class="empty-msg audit-table-error-msg"><i class="fa-solid fa-circle-exclamation"></i> ${errorMsg}</td></tr>`;
            }
        }
    }

    // --- RENDERIZAR TABELA ---
    function renderAuditTable(logs) {
        const tbody = document.getElementById('auditTableBody');
        if (!tbody) return;
        tbody.innerHTML = '';

        if (!logs || logs.length === 0) {
            tbody.innerHTML = '<tr class="audit-table-empty-row"><td colspan="6" class="empty-msg audit-table-empty-cell">Nenhum evento de auditoria registrado para os filtros aplicados.</td></tr>';
            return;
        }

        const fragment = document.createDocumentFragment();

        logs.forEach(log => {
            const tr = document.createElement('tr');

            // Formatar data/hora
            let formattedDate = '-';
            if (log.moment) {
                try {
                    formattedDate = new Date(log.moment).toLocaleString('pt-BR');
                } catch (e) {
                    formattedDate = log.moment;
                }
            }

            // Traduzir cargo do funcionário
            const roleLabel = window.ROLE_LABELS ? (window.ROLE_LABELS[log.practitionerRole] || log.practitionerRole || 'Sistema') : (log.practitionerRole || 'Sistema');

            // Customizar estilo da Ação
            let actionBadge = '';
            switch (log.action) {
                case 'CREATE':
                    actionBadge = '<span class="status-indicator status-active audit-badge-create">CREATE</span>';
                    break;
                case 'READ':
                    actionBadge = '<span class="status-indicator status-active audit-badge-read">READ</span>';
                    break;
                case 'UPDATE':
                    actionBadge = '<span class="status-indicator status-active audit-badge-update">UPDATE</span>';
                    break;
                case 'DELETE':
                    actionBadge = '<span class="status-indicator status-inactive audit-badge-delete">DELETE</span>';
                    break;
                case 'LOGIN_SUCCESS':
                    actionBadge = '<span class="status-indicator status-active audit-badge-login-ok">LOGIN OK</span>';
                    break;
                case 'LOGIN_FAILURE':
                    actionBadge = '<span class="status-indicator status-inactive audit-badge-login-error">LOGIN ERRO</span>';
                    break;
                default:
                    actionBadge = `<span class="status-indicator audit-badge-default">${log.action || 'EVENTO'}</span>`;
            }

            // Traduzir Entidades do Módulo
            const entityLabels = {
                Patient: 'Paciente',
                practitioner: 'Funcionário',
                Practitioner: 'Funcionário',
                Medication: 'Medicamento',
                Dispensation: 'Dispensação',
                FacilitySupply: 'Insumo Infraestrutura',
                MedicalSupply: 'Insumo Médico',
                MedicationLot: 'Lote de Medicamento',
                SupplyLot: 'Lote de Insumo'
            };
            const entityLabel = entityLabels[log.entityType] || log.entityType || '-';

            // Traduzir Detalhes (Formas Farmacêuticas e outros)
            let translatedDetails = log.details || '';
            const formTranslations = {
                'TABLET_PREGNANT': 'Comprimido (Gestante)',
                'BOTTLE_PREGNANT': 'Frasco (Gestante)',
                'TRANSDERMAL_PATCH': 'Adesivo Transdérmico',
                'TABLET': 'Comprimido',
                'CAPSULE': 'Cápsula',
                'SYRUP': 'Xarope',
                'SUSPENSION': 'Suspensão',
                'DROPS': 'Gotas',
                'OINTMENT': 'Pomada',
                'CREAM': 'Creme',
                'INJECTABLE': 'Injetável',
                'SUPPOSITORY': 'Supositório',
                'LOTION': 'Loção',
                'SOLUTION': 'Solução',
                'ELIXIR': 'Elixir',
                'GEL': 'Gel',
                'PASTE': 'Pasta',
                'POWDER': 'Pó',
                'INHALER': 'Inalador',
                'AMPOULE': 'Ampola'
            };
            
            Object.keys(formTranslations).forEach(key => {
                const regex = new RegExp(`\\b${key}\\b`, 'g');
                translatedDetails = translatedDetails.replace(regex, formTranslations[key]);
            });

            tr.innerHTML = `
                <td class="font-data text-muted text-center audit-table-date-cell">${formattedDate}</td>
                <td class="text-center"><span class="fw-600 text-main audit-table-practitioner-name">${window.escapeHTML(log.practitionerName || 'Sistema')}</span></td>
                <td class="text-center"><span class="role-badge role-${log.practitionerRole || 'SISTEMA'}">${roleLabel}</span></td>
                <td class="text-center">${actionBadge}</td>
                <td class="text-center"><span class="fw-600 audit-table-entity-label">${entityLabel}</span></td>
                <td class="audit-table-details-cell">${window.escapeHTML(translatedDetails)}</td>
            `;

            fragment.appendChild(tr);
        });

        tbody.appendChild(fragment);
    }

    // --- LIMPAR FILTROS ---
    window.clearAuditFilters = function () {
        document.getElementById('auditFilterStart').value = '';
        document.getElementById('auditFilterEnd').value = '';
        document.getElementById('auditFilterUser').value = '';
        document.getElementById('auditFilterAction').value = '';
        document.getElementById('auditFilterEntity').value = '';
        document.getElementById('auditFilterKeyword').value = '';
        loadAuditLogs(0);
    };

    // --- NAVEGAÇÃO DE PÁGINAS ---
    window.prevAuditPage = function () {
        if (auditCurrentPage > 0) loadAuditLogs(auditCurrentPage - 1);
    };

    window.nextAuditPage = function () {
        if (auditCurrentPage < auditTotalPages - 1) loadAuditLogs(auditCurrentPage + 1);
    };


    // Exportar para escopo global do roteador e inicialização
    window.loadAuditLogs = loadAuditLogs;

})();

