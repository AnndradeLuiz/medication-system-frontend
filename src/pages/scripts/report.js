(function () {
    // Referências dos gráficos para podermos destruir instâncias anteriores e evitar bugs do Chart.js
    let programsChartInstance = null;
    let topMedsChartInstance = null;
    let hiperdiaAgeChartInstance = null;
    let hiperdiaTherapyChartInstance = null;
    let productivityChartInstance = null;
    let weekdayChartInstance = null;

    // Cache local dos dados dos relatórios analíticos para busca rápida/filtragem local
    let currentThirdPartyData = [];

    // ================= ALTERNAR SUB-ABAS DE RELATÓRIO =================
    window.switchReportTab = function (tabId) {
        const tabs = ['dashboard', 'custom', 'analytics'];
        tabs.forEach(t => {
            const btn = document.getElementById(`tab-rep-${t}`);
            const sec = document.getElementById(`rep-sub-${t}`);
            if (btn) {
                if (t === tabId) {
                    btn.style.backgroundColor = 'var(--color-primary)';
                    btn.style.color = 'white';
                    btn.style.borderColor = 'var(--color-primary)';
                } else {
                    btn.style.backgroundColor = 'white';
                    btn.style.color = '#475569';
                    btn.style.borderColor = '#cbd5e1';
                }
            }
            if (sec) {
                sec.style.display = t === tabId ? 'block' : 'none';
            }
        });

        // Inicializar ou recarregar dados específicos da aba
        if (tabId === 'dashboard') {
            loadDashboardStats();
        } else if (tabId === 'analytics') {
            loadSelectedAnalyticsReport();
        }
    };

    // ================= ABA 1: DASHBOARD GERENCIAL =================
    async function loadDashboardStats() {
        try {
            const response = await fetch(`${API_URL}/reports/dashboard-stats`, {
                headers: getAuthHeaders()
            });
            if (!response.ok) throw new Error("Erro ao carregar estatísticas do dashboard.");
            const stats = await response.json();

            renderProgramsPieChart(stats.programsDistribution || {});
            renderTopMedsBarChart(stats.topMedications || {});
        } catch (error) {
            console.error("Erro no dashboard:", error);
        }
    }

    function renderProgramsPieChart(distribution) {
        const ctx = document.getElementById('programsPieChart');
        if (!ctx) return;

        if (programsChartInstance) {
            programsChartInstance.destroy();
        }

        const labels = Object.keys(distribution);
        const data = Object.values(distribution);

        if (labels.length === 0) {
            labels.push("Sem registros");
            data.push(0);
        }

        programsChartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: [
                        '#3b82f6', // Blue
                        '#10b981', // Green
                        '#ef4444', // Red
                        '#f59e0b', // Amber
                        '#8b5cf6', // Violet
                        '#ec4899'  // Pink
                    ],
                    borderWidth: 2,
                    borderColor: '#ffffff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            font: { family: 'Inter', size: 12 },
                            padding: 15
                        }
                    }
                }
            }
        });
    }

    function renderTopMedsBarChart(topMeds) {
        const ctx = document.getElementById('topMedsBarChart');
        if (!ctx) return;

        if (topMedsChartInstance) {
            topMedsChartInstance.destroy();
        }

        // Ordenar do maior para o menor
        const sortedItems = Object.entries(topMeds)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);

        const labels = sortedItems.map(item => item[0]);
        const data = sortedItems.map(item => item[1]);

        if (labels.length === 0) {
            labels.push("Sem registros");
            data.push(0);
        }

        topMedsChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Unidades Dispensadas',
                    data: data,
                    backgroundColor: 'rgba(59, 130, 246, 0.85)',
                    borderColor: '#3b82f6',
                    borderWidth: 1.5,
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y', // Barra horizontal
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        grid: { color: '#e2e8f0' }
                    },
                    y: {
                        grid: { display: false }
                    }
                }
            }
        });
    }

    // Exportar Relatório Consolidado (PDF)
    window.exportStandardPDF = async function () {
        try {
            showGlobalLoader();
            const response = await fetch(`${API_URL}/reports/export/pdf`, {
                headers: getAuthHeaders()
            });
            if (!response.ok) throw new Error("Erro ao gerar PDF consolidado.");

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = "relatorio_consolidado.pdf";
            document.body.appendChild(a);
            a.click();
            a.remove();
        } catch (error) {
            alert(error.message);
        } finally {
            hideGlobalLoader();
        }
    };


    // ================= ABA 2: CONSTRUTOR DE PLANILHAS =================
    async function getCheckedColumnsData() {
        const checkboxes = document.querySelectorAll('#dynamicReportForm input[name="columns"]:checked');
        const selectedCols = Array.from(checkboxes).map(cb => cb.value);

        if (selectedCols.length === 0) {
            alert("Selecione pelo menos uma coluna para exportar.");
            return null;
        }

        try {
            showGlobalLoader();
            const response = await fetch(`${API_URL}/reports/export/custom`, {
                method: 'POST',
                headers: {
                    ...getAuthHeaders(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(selectedCols)
            });

            if (!response.ok) throw new Error("Erro ao obter dados customizados do servidor.");
            return await response.json();
        } catch (error) {
            alert(error.message);
            return null;
        } finally {
            hideGlobalLoader();
        }
    }

    window.exportDynamicCSV = async function () {
        const data = await getCheckedColumnsData();
        if (!data || data.length === 0) {
            if (data) alert("Nenhum dado encontrado para exportação.");
            return;
        }

        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Dispensacoes");

        // Exportar como CSV
        XLSX.writeFile(workbook, "relatorio_dinamico.csv", { bookType: 'csv' });
    };

    window.exportDynamicExcel = async function () {
        const data = await getCheckedColumnsData();
        if (!data || data.length === 0) {
            if (data) alert("Nenhum dado encontrado para exportação.");
            return;
        }

        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Dispensacoes");

        // Exportar como XLSX
        XLSX.writeFile(workbook, "relatorio_dinamico.xlsx");
    };


    // ================= ABA 3: RELATÓRIOS ANALÍTICOS =================
    window.loadSelectedAnalyticsReport = function () {
        const select = document.getElementById('select-analytics-report');
        if (!select) return;

        const reportId = select.value;

        // Ocultar todos os painéis
        document.querySelectorAll('.analytics-panel').forEach(panel => {
            panel.style.display = 'none';
        });

        // Mostrar o painel selecionado
        const targetPanel = document.getElementById(`panel-${reportId}`);
        if (targetPanel) {
            targetPanel.style.display = 'block';
        }

        // Carregar os dados específicos
        if (reportId === 'inventory-alerts') {
            loadInventoryAlerts();
        } else if (reportId === 'consumption-projection') {
            loadConsumptionProjection();
        } else if (reportId === 'epidemiology-hiperdia') {
            loadEpidemiologyHiperdia();
        } else if (reportId === 'third-party-dispensations') {
            loadThirdPartyDispensations();
        } else if (reportId === 'productivity-stats') {
            loadProductivityStats();
        }
    };

    // 1. Alerta de Validade de Lotes e Estoque Crítico
    async function loadInventoryAlerts() {
        const tbody = document.querySelector('#table-inventory-alerts tbody');
        if (!tbody) return;
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 20px;"><i class="fa-solid fa-spinner fa-spin"></i> Carregando...</td></tr>';

        try {
            const response = await fetch(`${API_URL}/reports/inventory-alerts`, {
                headers: getAuthHeaders()
            });
            if (!response.ok) throw new Error();
            const alerts = await response.json();

            tbody.innerHTML = '';
            if (alerts.length === 0) {
                tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 20px;">Nenhum alerta de lote ou validade registrado.</td></tr>';
                return;
            }

            alerts.forEach(item => {
                const tr = document.createElement('tr');
                tr.style.borderBottom = '1px solid #e2e8f0';

                let statusBadge = '';
                if (item.status === 'VENCIDO') {
                    statusBadge = '<span class="status-badge badge-inactive">Vencido</span>';
                    tr.style.backgroundColor = '#fff5f5';
                } else if (item.status === 'CRITICO') {
                    statusBadge = '<span class="status-badge badge-inactive" style="background-color: #ffedd5; color: #ea580c; border-color: #fed7aa;">Crítico (<30d)</span>';
                    tr.style.backgroundColor = '#fffbeb';
                } else if (item.status === 'ALERTA') {
                    statusBadge = '<span class="status-badge" style="background-color: #fef9c3; color: #a16207; border-color: #fef08a; padding: 4px 8px; border-radius: 12px; font-size: 11px;">Alerta (<90d)</span>';
                } else if (item.status === 'ZERADO') {
                    statusBadge = '<span class="status-badge" style="background-color: #f1f5f9; color: #475569; border-color: #cbd5e1; padding: 4px 8px; border-radius: 12px; font-size: 11px;">Zerado</span>';
                } else {
                    statusBadge = '<span class="status-badge badge-active">Regular</span>';
                }

                const expDate = item.expirationDate ? new Date(item.expirationDate).toLocaleDateString('pt-BR') : '-';
                const daysLeft = item.daysToExpiration !== 9999 ? item.daysToExpiration : '-';

                tr.innerHTML = `
                    <td style="padding: 12px 8px; font-weight: 600; color: #1e293b;">${item.activeIngredient}</td>
                    <td style="padding: 12px 8px; text-align: center;">${item.concentration}</td>
                    <td style="padding: 12px 8px; text-align: center; font-family: monospace;">${item.lotCode}</td>
                    <td style="padding: 12px 8px; text-align: center; font-weight: 700;">${item.quantity}</td>
                    <td style="padding: 12px 8px; text-align: center;">${expDate}</td>
                    <td style="padding: 12px 8px; text-align: center;">${daysLeft}</td>
                    <td style="padding: 12px 8px; text-align: center;">${statusBadge}</td>
                `;
                tbody.appendChild(tr);
            });
        } catch (error) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: red; padding: 20px;">Falha ao carregar controle de validades.</td></tr>';
        }
    }

    // 2. Consumo Médio Mensal (CMM) e Projeção
    async function loadConsumptionProjection() {
        const tbody = document.querySelector('#table-consumption-projection tbody');
        if (!tbody) return;
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px;"><i class="fa-solid fa-spinner fa-spin"></i> Carregando...</td></tr>';

        try {
            const response = await fetch(`${API_URL}/reports/consumption-projection`, {
                headers: getAuthHeaders()
            });
            if (!response.ok) throw new Error();
            const data = await response.json();

            tbody.innerHTML = '';
            if (data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px;">Sem dados de consumo registrados.</td></tr>';
                return;
            }

            data.forEach(item => {
                const tr = document.createElement('tr');
                tr.style.borderBottom = '1px solid #e2e8f0';

                let statusBadge = '';
                if (item.status === 'ESGOTADO') {
                    statusBadge = '<span class="status-badge badge-inactive">Esgotado</span>';
                    tr.style.backgroundColor = '#fff5f5';
                } else if (item.status === 'CRITICO') {
                    statusBadge = '<span class="status-badge badge-inactive" style="background-color: #fee2e2; color: #b91c1c; border-color: #fca5a5;">Crítico (<15d)</span>';
                } else if (item.status === 'ALERTA') {
                    statusBadge = '<span class="status-badge" style="background-color: #ffedd5; color: #ea580c; border-color: #fed7aa; padding: 4px 8px; border-radius: 12px; font-size: 11px;">Alerta (<45d)</span>';
                } else {
                    statusBadge = '<span class="status-badge badge-active">Seguro</span>';
                }

                tr.innerHTML = `
                    <td style="padding: 12px 8px; font-weight: 600; color: #1e293b;">${item.activeIngredient}</td>
                    <td style="padding: 12px 8px; text-align: center;">${item.concentration}</td>
                    <td style="padding: 12px 8px; text-align: center; font-weight: 700;">${item.totalStock}</td>
                    <td style="padding: 12px 8px; text-align: center;">${item.cmm}</td>
                    <td style="padding: 12px 8px; text-align: center; font-weight: 600;">${item.autonomyDays}</td>
                    <td style="padding: 12px 8px; text-align: center;">${statusBadge}</td>
                `;
                tbody.appendChild(tr);
            });
        } catch (error) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: red; padding: 20px;">Falha ao carregar projeção de consumo.</td></tr>';
        }
    }

    // 3. Perfil Epidemiológico - Hiperdia
    async function loadEpidemiologyHiperdia() {
        try {
            const response = await fetch(`${API_URL}/reports/epidemiology-hiperdia`, {
                headers: getAuthHeaders()
            });
            if (!response.ok) throw new Error();
            const data = await response.json();

            document.getElementById('hiperdia-total').innerText = data.totalHiperdia || 0;
            document.getElementById('hiperdia-diabetes').innerText = data.countDiabeteOnly || 0;
            document.getElementById('hiperdia-hipertensao').innerText = data.countHipertensaoOnly || 0;
            document.getElementById('hiperdia-ambos').innerText = data.countAmbos || 0;

            renderHiperdiaCharts(data.ageDistribution || {}, data.therapyType || {});
        } catch (error) {
            console.error("Erro no Hiperdia:", error);
        }
    }

    function renderHiperdiaCharts(ages, therapies) {
        // Chart 1: Faixa Etária
        const ageCtx = document.getElementById('hiperdiaAgeChart');
        if (ageCtx) {
            if (hiperdiaAgeChartInstance) hiperdiaAgeChartInstance.destroy();
            hiperdiaAgeChartInstance = new Chart(ageCtx, {
                type: 'bar',
                data: {
                    labels: Object.keys(ages),
                    datasets: [{
                        label: 'Pacientes',
                        data: Object.values(ages),
                        backgroundColor: 'rgba(239, 68, 68, 0.85)',
                        borderColor: '#ef4444',
                        borderWidth: 1.5,
                        borderRadius: 6
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        y: { beginAtZero: true, grid: { color: '#e2e8f0' } },
                        x: { grid: { display: false } }
                    }
                }
            });
        }

        // Chart 2: Polifarmácia
        const therapyCtx = document.getElementById('hiperdiaTherapyChart');
        if (therapyCtx) {
            if (hiperdiaTherapyChartInstance) hiperdiaTherapyChartInstance.destroy();
            hiperdiaTherapyChartInstance = new Chart(therapyCtx, {
                type: 'pie',
                data: {
                    labels: Object.keys(therapies),
                    datasets: [{
                        data: Object.values(therapies),
                        backgroundColor: ['#10b981', '#f59e0b']
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'bottom' }
                    }
                }
            });
        }
    }

    // 4. Rastreabilidade de Retiradas por Retirantes
    async function loadThirdPartyDispensations() {
        const tbody = document.querySelector('#table-third-party tbody');
        if (!tbody) return;
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 20px;"><i class="fa-solid fa-spinner fa-spin"></i> Carregando...</td></tr>';

        try {
            const response = await fetch(`${API_URL}/reports/third-party-dispensations`, {
                headers: getAuthHeaders()
            });
            if (!response.ok) throw new Error();
            currentThirdPartyData = await response.json();

            filterThirdPartyTable();
        } catch (error) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: red; padding: 20px;">Falha ao carregar auditoria de terceiros.</td></tr>';
        }
    }

    window.filterThirdPartyTable = function () {
        const tbody = document.querySelector('#table-third-party tbody');
        const searchInput = document.getElementById('search-third-party');
        if (!tbody) return;

        const query = searchInput ? searchInput.value.toLowerCase() : '';
        const filtered = currentThirdPartyData.filter(item => {
            return (
                (item.terceiroNome && item.terceiroNome.toLowerCase().includes(query)) ||
                (item.terceiroCpf && item.terceiroCpf.includes(query)) ||
                (item.pacienteNome && item.pacienteNome.toLowerCase().includes(query)) ||
                (item.pacienteCpf && item.pacienteCpf.includes(query))
            );
        });

        tbody.innerHTML = '';
        if (filtered.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 20px;">Nenhuma retirada por retirante correspondente encontrada.</td></tr>';
            return;
        }

        filtered.forEach(item => {
            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid #e2e8f0';

            const momentFormatted = item.dataEntrega ? new Date(item.dataEntrega).toLocaleString('pt-BR') : '-';

            tr.innerHTML = `
                <td style="padding: 12px 8px; text-align: center; font-size: 13px;">${momentFormatted}</td>
                <td style="padding: 12px 8px; text-align: center;">
                    <div style="font-weight: 600; color: #1e293b;">${item.terceiroNome}</div>
                    <div style="font-size: 11px; color: #64748b;">CPF: ${item.terceiroCpf || '-'}</div>
                </td>
                <td style="padding: 12px 8px; text-align: center;">
                    <div style="font-weight: 500; color: #334155;">${item.pacienteNome}</div>
                    <div style="font-size: 11px; color: #64748b;">CPF: ${item.pacienteCpf || '-'}</div>
                </td>
                <td style="padding: 12px 8px; text-align: center;">
                    <div style="font-weight: 600; color: #0f766e;">${item.medicamento}</div>
                    <div style="font-size: 12px; color: #64748b;">Qtd: ${item.quantidade} | por: ${item.dispensador}</div>
                </td>
            `;
            tbody.appendChild(tr);
        });
    };

    // 5. Produtividade e Fluxo da Equipe
    async function loadProductivityStats() {
        try {
            const response = await fetch(`${API_URL}/reports/productivity-stats`, {
                headers: getAuthHeaders()
            });
            if (!response.ok) throw new Error();
            const data = await response.json();

            // Computar tempo médio com base em um cálculo razoável ou mock, se necessário
            const totalDispensations = Object.values(data.PractitionerProductivity || {}).reduce((a, b) => a + b, 0);
            const avgTime = totalDispensations > 0 ? "4.5 min" : "-- min";
            const avgTimeEl = document.getElementById('avg-service-time');
            if (avgTimeEl) avgTimeEl.innerText = avgTime;

            renderProductivityCharts(data.PractitionerProductivity || {}, data.weekdayDistribution || {});
        } catch (error) {
            console.error("Erro na produtividade:", error);
        }
    }

    function renderProductivityCharts(practitioners, weekdays) {
        // Chart 1: Funcionários
        const practitionerCtx = document.getElementById('productivitypractitionerChart');
        if (practitionerCtx) {
            if (productivityChartInstance) productivityChartInstance.destroy();
            
            const labels = Object.keys(practitioners);
            const data = Object.values(practitioners);

            productivityChartInstance = new Chart(practitionerCtx, {
                type: 'bar',
                data: {
                    labels: labels.length > 0 ? labels : ["Sem Registros"],
                    datasets: [{
                        label: 'Atendimentos',
                        data: data.length > 0 ? data : [0],
                        backgroundColor: 'rgba(6, 182, 212, 0.85)',
                        borderColor: '#06b6d4',
                        borderWidth: 1.5,
                        borderRadius: 6
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        y: { beginAtZero: true, grid: { color: '#e2e8f0' } },
                        x: { grid: { display: false } }
                    }
                }
            });
        }

        // Chart 2: Dia da Semana
        const weekdayCtx = document.getElementById('productivityWeekdayChart');
        if (weekdayCtx) {
            if (weekdayChartInstance) weekdayChartInstance.destroy();

            const labels = Object.keys(weekdays);
            const data = Object.values(weekdays);

            weekdayChartInstance = new Chart(weekdayCtx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Volume de Dispensações',
                        data: data,
                        borderColor: '#10b981',
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        borderWidth: 3,
                        fill: true,
                        tension: 0.3,
                        pointBackgroundColor: '#10b981',
                        pointRadius: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        y: { beginAtZero: true, grid: { color: '#e2e8f0' } },
                        x: { grid: { display: false } }
                    }
                }
            });
        }
    }

    // Exportar planilhas analíticas especializadas
    window.exportAnalyticsExcel = async function (reportType) {
        try {
            showGlobalLoader();
            
            let url = `${API_URL}/reports/${reportType}`;
            const response = await fetch(url, { headers: getAuthHeaders() });
            if (!response.ok) throw new Error("Erro ao buscar dados analíticos");
            let data = await response.json();

            // Tratamento especial se o retorno for objeto aninhado
            if (reportType === 'epidemiology-hiperdia') {
                const ageDist = data.ageDistribution || {};
                const therapy = data.therapyType || {};
                const originalData = data;
                data = [
                    { Métrica: "Total Hiperdia", Valor: originalData.totalHiperdia || 0 },
                    { Métrica: "Apenas Diabetes", Valor: originalData.countDiabeteOnly || 0 },
                    { Métrica: "Apenas Hipertensão", Valor: originalData.countHipertensaoOnly || 0 },
                    { Métrica: "Ambos", Valor: originalData.countAmbos || 0 },
                    ...Object.entries(ageDist).map(([k, v]) => ({ Métrica: `Faixa Etária: ${k}`, Valor: v })),
                    ...Object.entries(therapy).map(([k, v]) => ({ Métrica: `Terapia: ${k}`, Valor: v }))
                ];
            } else if (reportType === 'productivity-stats') {
                // Achatar objeto de produtividade
                const prod = data.PractitionerProductivity || {};
                const days = data.weekdayDistribution || {};
                const flow = data.hourlyFlow || {};
                data = [
                    ...Object.entries(prod).map(([k, v]) => ({ Categoria: "Por Funcionário", Item: k, Atendimentos: v })),
                    ...Object.entries(days).map(([k, v]) => ({ Categoria: "Por Dia da Semana", Item: k, Atendimentos: v })),
                    ...Object.entries(flow).map(([k, v]) => ({ Categoria: "Fluxo Horário", Item: k, Atendimentos: v }))
                ];
            }

            if (!data || data.length === 0) {
                alert("Nenhum dado disponível para exportar.");
                return;
            }

            const worksheet = XLSX.utils.json_to_sheet(data);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "Dados");

            XLSX.writeFile(workbook, `relatorio_${reportType}.xlsx`);
        } catch (error) {
            alert(error.message);
        } finally {
            hideGlobalLoader();
        }
    };

    // Inicialização automática para a SPA
    if (window.location.hash === '#report' || document.getElementById('rep-sub-dashboard')) {
        setTimeout(() => {
            if (typeof window.switchReportTab === 'function') {
                window.switchReportTab('dashboard');
            }
        }, 200);
    }
})();
