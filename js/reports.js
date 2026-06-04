/**
 * reports.js
 * Responsável pelos gráficos e gerador de relatórios dinâmicos.
 */

let programsChartInstance = null;
let topMedsChartInstance = null;

document.addEventListener('DOMContentLoaded', () => {
    // Escutar por mudanças na View para carregar gráficos apenas quando a tela for exibida
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.target.id === 'view-relatorios' && mutation.target.classList.contains('active')) {
                switchReportTab('custom');
            }
        });
    });

    const relatoriosSection = document.getElementById('view-relatorios');
    if (relatoriosSection) {
        observer.observe(relatoriosSection, { attributes: true, attributeFilter: ['class'] });
    }
    // Definir aba inicial padrão como 'custom' (Construtor)
    setTimeout(() => {
        const customTab = document.getElementById('tab-rep-custom');
        if (customTab && relatoriosSection && relatoriosSection.classList.contains('active')) {
            switchReportTab('custom');
        }
    }, 100);
});

async function loadDashboardStats() {
    try {
        const response = await fetch(`${API_URL}/reports/dashboard-stats`, {
            headers: getAuthHeaders(),
            credentials: 'include'
        });

        if (!response.ok) throw new Error("Erro ao buscar estatísticas");
        const stats = await response.json();

        renderProgramsChart(stats.programsDistribution);
        renderTopMedsChart(stats.topMedications);
    } catch (e) {
        console.error("Falha ao renderizar dashboard de relatórios:", e);
    }
}

function renderProgramsChart(dataObj) {
    const ctx = document.getElementById('programsPieChart').getContext('2d');

    if (programsChartInstance) programsChartInstance.destroy();

    const labels = Object.keys(dataObj);
    const data = Object.values(dataObj);

    // Paleta de cores vibrantes e modernas
    const colors = [
        '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'
    ];

    programsChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels.length > 0 ? labels : ['Nenhum dado'],
            datasets: [{
                data: data.length > 0 ? data : [1],
                backgroundColor: data.length > 0 ? colors.slice(0, labels.length) : ['#e2e8f0'],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'right' }
            }
        }
    });
}

function renderTopMedsChart(dataObj) {
    const ctx = document.getElementById('topMedsBarChart').getContext('2d');

    if (topMedsChartInstance) topMedsChartInstance.destroy();

    const labels = Object.keys(dataObj);
    const data = Object.values(dataObj);

    topMedsChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels.length > 0 ? labels : ['Nenhum dado'],
            datasets: [{
                label: 'Quantidade Dispensada',
                data: data.length > 0 ? data : [0],
                backgroundColor: '#3b82f6',
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true }
            },
            plugins: {
                legend: { display: false }
            }
        }
    });
}

function getSelectedColumns() {
    const checkboxes = document.querySelectorAll('#dynamicReportForm input[name="columns"]:checked');
    return Array.from(checkboxes).map(cb => cb.value);
}

function getSelectedHeaders() {
    const checkboxes = document.querySelectorAll('#dynamicReportForm input[name="columns"]:checked');
    return Array.from(checkboxes).map(cb => cb.parentElement.innerText.trim());
}

async function fetchCustomData(columns) {
    const response = await fetch(`${API_URL}/reports/export/custom`, {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify(columns)
    });

    if (!response.ok) {
        showToast("Erro ao gerar dados", "error");
        throw new Error("Erro na API");
    }

    return await response.json();
}

async function exportDynamicCSV() {
    const columns = getSelectedColumns();
    const headers = getSelectedHeaders();

    if (columns.length === 0) {
        showToast("Selecione ao menos uma coluna", "warning");
        return;
    }

    showToast("Gerando CSV...", "info");

    try {
        const data = await fetchCustomData(columns);

        let csvContent = "data:text/csv;charset=utf-8,";

        // Cabeçalho
        csvContent += headers.map(h => `"${h}"`).join(";") + "\r\n";

        // Linhas
        data.forEach(row => {
            let rowData = columns.map(col => {
                let val = row[col] !== null && row[col] !== undefined ? row[col] : "";
                return `"${String(val).replace(/"/g, '""')}"`;
            });
            csvContent += rowData.join(";") + "\r\n";
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `extracao_dados_${new Date().getTime()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

    } catch (e) {
        console.error(e);
    }
}

async function exportDynamicExcel() {
    if (typeof XLSX === 'undefined') {
        showToast("Biblioteca Excel carregando... tente novamente em 1 segundo", "warning");
        return;
    }

    const columns = getSelectedColumns();
    const headers = getSelectedHeaders();

    if (columns.length === 0) {
        showToast("Selecione ao menos uma coluna", "warning");
        return;
    }

    showToast("Gerando Excel...", "info");

    try {
        const data = await fetchCustomData(columns);

        // Mapear os objetos JSON para os nomes bonitos dos headers
        const worksheetData = data.map(row => {
            let newRow = {};
            columns.forEach((col, index) => {
                newRow[headers[index]] = row[col];
            });
            return newRow;
        });

        const worksheet = XLSX.utils.json_to_sheet(worksheetData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Extracao");

        // Fazer download
        XLSX.writeFile(workbook, `extracao_dados_${new Date().getTime()}.xlsx`);
    } catch (e) {
        console.error(e);
    }
}

function exportStandardPDF() {
    showToast("Gerando PDF Consolidado...", "info");
    fetch(`${API_URL}/reports/export/pdf`, {
        method: 'GET',
        headers: getAuthHeaders(),
        credentials: 'include'
    })
        .then(response => {
            if (!response.ok) {
                showToast("Erro ao gerar PDF", "error");
                throw new Error("Erro na API de PDF");
            }
            return response.blob();
        })
        .then(blob => {
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `relatorio_consolidado_${new Date().getTime()}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
            showToast("PDF baixado com sucesso!", "success");
        })
        .catch(e => {
            console.error(e);
        });
}

/* ==========================================
   SISTEMA DE NAVEGAÇÃO E ABAS DE RELATÓRIOS
=========================================== */

function switchReportTab(tabName) {
    // Esconde todos os sub-containers
    document.getElementById('rep-sub-dashboard').style.display = 'none';
    document.getElementById('rep-sub-custom').style.display = 'none';
    document.getElementById('rep-sub-analytics').style.display = 'none';

    // Remove estilos ativos de todos os botões
    const tabs = ['dashboard', 'custom', 'analytics'];
    tabs.forEach(t => {
        const btn = document.getElementById(`tab-rep-${t}`);
        if (btn) {
            btn.style.border = '1.5px solid #cbd5e1';
            btn.style.backgroundColor = 'white';
            btn.style.color = '#475569';
        }
    });

    // Mostra o container ativo e estiliza o botão correspondente
    if (tabName === 'dashboard') {
        document.getElementById('rep-sub-dashboard').style.display = 'block';
        const activeBtn = document.getElementById('tab-rep-dashboard');
        activeBtn.style.border = '1.5px solid var(--color-primary)';
        activeBtn.style.backgroundColor = 'var(--color-primary)';
        activeBtn.style.color = 'white';
        loadDashboardStats();
    } else if (tabName === 'custom') {
        document.getElementById('rep-sub-custom').style.display = 'block';
        const activeBtn = document.getElementById('tab-rep-custom');
        activeBtn.style.border = '1.5px solid var(--color-primary)';
        activeBtn.style.backgroundColor = 'var(--color-primary)';
        activeBtn.style.color = 'white';
    } else if (tabName === 'analytics') {
        document.getElementById('rep-sub-analytics').style.display = 'block';
        const activeBtn = document.getElementById('tab-rep-analytics');
        activeBtn.style.border = '1.5px solid var(--color-primary)';
        activeBtn.style.backgroundColor = 'var(--color-primary)';
        activeBtn.style.color = 'white';
        loadSelectedAnalyticsReport();
    }
}

/* ==========================================
   RELATÓRIOS ANALÍTICOS (SUS)
=========================================== */

let hiperdiaAgeChartInstance = null;
let hiperdiaTherapyChartInstance = null;
let prodEmployeeChartInstance = null;
let prodHourChartInstance = null;
let prodWeekdayChartInstance = null;

let currentAnalyticsData = null; // Armazena dados do painel atual para exportação rápida

function loadSelectedAnalyticsReport() {
    const reportType = document.getElementById('select-analytics-report').value;

    // Esconde todos os painéis
    const panels = ['inventory-alerts', 'consumption-projection', 'epidemiology-hiperdia', 'third-party-dispensations', 'productivity-stats'];
    panels.forEach(p => {
        document.getElementById(`panel-${p}`).style.display = 'none';
    });

    // Mostra o painel selecionado e carrega os dados correspondentes
    document.getElementById(`panel-${reportType}`).style.display = 'block';

    switch (reportType) {
        case 'inventory-alerts':
            loadInventoryAlerts();
            break;
        case 'consumption-projection':
            loadConsumptionProjection();
            break;
        case 'epidemiology-hiperdia':
            loadEpidemiologyHiperdia();
            break;
        case 'third-party-dispensations':
            loadThirdPartyDispensations();
            break;
        case 'productivity-stats':
            loadProductivityStats();
            break;
    }
}

// 1. Alerta de Estoque e Validade de Lotes
async function loadInventoryAlerts() {
    try {
        const response = await fetch(`${API_URL}/reports/inventory-alerts`, { headers: getAuthHeaders(), credentials: 'include' });
        if (!response.ok) throw new Error("Erro na API");
        const data = await response.json();
        currentAnalyticsData = data;

        const tbody = document.querySelector('#table-inventory-alerts tbody');
        tbody.innerHTML = '';

        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:#64748b; padding:15px;">Nenhum alerta ou lote cadastrado.</td></tr>';
            return;
        }

        data.forEach(item => {
            let statusBadge = '';
            let rowStyle = '';

            switch (item.status) {
                case 'VENCIDO':
                    statusBadge = '<span style="background-color: #fee2e2; color: #ef4444; padding: 4px 8px; border-radius: 9999px; font-weight: 600; font-size: 11px;">Vencido</span>';
                    rowStyle = 'style="background-color: #fef2f2;"';
                    break;
                case 'CRITICO':
                    statusBadge = '<span style="background-color: #ffedd5; color: #f97316; padding: 4px 8px; border-radius: 9999px; font-weight: 600; font-size: 11px;">Crítico (&lt;30d)</span>';
                    rowStyle = 'style="background-color: #fff7ed;"';
                    break;
                case 'ALERTA':
                    statusBadge = '<span style="background-color: #fef9c3; color: #ca8a04; padding: 4px 8px; border-radius: 9999px; font-weight: 600; font-size: 11px;">Alerta (&lt;90d)</span>';
                    break;
                case 'ZERADO':
                    statusBadge = '<span style="background-color: #f1f5f9; color: #64748b; padding: 4px 8px; border-radius: 9999px; font-weight: 600; font-size: 11px;">Sem Estoque</span>';
                    rowStyle = 'style="color: #94a3b8;"';
                    break;
                default:
                    statusBadge = '<span style="background-color: #dcfce7; color: #22c55e; padding: 4px 8px; border-radius: 9999px; font-weight: 600; font-size: 11px;">OK</span>';
            }

            const expDate = item.expirationDate ? new Date(item.expirationDate).toLocaleDateString('pt-BR') : '-';
            const daysRemaining = item.daysToExpiration === 9999 ? '-' : item.daysToExpiration;

            tbody.innerHTML += `
                <tr ${rowStyle} style="border-bottom: 1px solid #e2e8f0; height: 50px;">
                    <td style="padding: 12px 8px; font-weight:500; vertical-align: middle;">${item.activeIngredient}</td>
                    <td style="padding: 12px 8px; vertical-align: middle; color: #64748b;">${item.concentration}</td>
                    <td style="padding: 12px 8px; text-align: center; font-family: monospace; vertical-align: middle; color: #475569;">${item.lotCode || '-'}</td>
                    <td style="padding: 12px 8px; text-align: center; font-weight:600; vertical-align: middle;">${item.quantity}</td>
                    <td style="padding: 12px 8px; text-align: center; vertical-align: middle; color: #475569;">${expDate}</td>
                    <td style="padding: 12px 8px; text-align: center; vertical-align: middle; font-weight: 500;">${daysRemaining}</td>
                    <td style="padding: 12px 8px; text-align: center; vertical-align: middle;">${statusBadge}</td>
                </tr>
            `;
        });
    } catch (e) {
        console.error(e);
        showToast("Erro ao carregar dados de validade", "error");
    }
}

// 2. Consumo Médio Mensal e Autonomia
async function loadConsumptionProjection() {
    try {
        const response = await fetch(`${API_URL}/reports/consumption-projection`, { headers: getAuthHeaders(), credentials: 'include' });
        if (!response.ok) throw new Error("Erro na API");
        const data = await response.json();
        currentAnalyticsData = data;

        const tbody = document.querySelector('#table-consumption-projection tbody');
        tbody.innerHTML = '';

        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#64748b; padding:15px;">Nenhum dado cadastrado.</td></tr>';
            return;
        }

        data.forEach(item => {
            let statusBadge = '';
            switch (item.status) {
                case 'ESGOTADO':
                    statusBadge = '<span style="background-color: #fee2e2; color: #ef4444; padding: 4px 8px; border-radius: 6px; font-weight: 600; font-size: 11px;">Comprar Urgente</span>';
                    break;
                case 'CRITICO':
                    statusBadge = '<span style="background-color: #ffedd5; color: #f97316; padding: 4px 8px; border-radius: 6px; font-weight: 600; font-size: 11px;">Crítico (&lt;15d)</span>';
                    break;
                case 'ALERTA':
                    statusBadge = '<span style="background-color: #fef9c3; color: #ca8a04; padding: 4px 8px; border-radius: 6px; font-weight: 600; font-size: 11px;">Atenção (&lt;45d)</span>';
                    break;
                default:
                    statusBadge = '<span style="background-color: #dcfce7; color: #22c55e; padding: 4px 8px; border-radius: 6px; font-weight: 600; font-size: 11px;">Estável</span>';
            }

            tbody.innerHTML += `
                <tr style="border-bottom: 1px solid #e2e8f0;">
                    <td style="padding: 10px 8px; font-weight:500;">${item.activeIngredient}</td>
                    <td style="padding: 10px 8px;">${item.concentration}</td>
                    <td style="padding: 10px 8px; text-align: center; font-weight:600;">${item.totalStock}</td>
                    <td style="padding: 10px 8px; text-align: center;">${item.cmm}</td>
                    <td style="padding: 10px 8px; text-align: center; font-weight:600;">${item.autonomyDays}</td>
                    <td style="padding: 10px 8px; text-align: center;">${statusBadge}</td>
                </tr>
            `;
        });
    } catch (e) {
        console.error(e);
        showToast("Erro ao carregar projeção de consumo", "error");
    }
}

// 3. Perfil Epidemiológico - Hiperdia
async function loadEpidemiologyHiperdia() {
    try {
        const response = await fetch(`${API_URL}/reports/epidemiology-hiperdia`, { headers: getAuthHeaders(), credentials: 'include' });
        if (!response.ok) throw new Error("Erro na API");
        const stats = await response.json();

        // Popula os cards
        document.getElementById('hiperdia-total').innerText = stats.totalHiperdia;
        document.getElementById('hiperdia-diabetes').innerText = stats.countDiabeteOnly;
        document.getElementById('hiperdia-hipertensao').innerText = stats.countHipertensaoOnly;
        document.getElementById('hiperdia-ambos').innerText = stats.countAmbos;

        // Gráfico 1: Idade do Hiperdia
        const ageCtx = document.getElementById('hiperdiaAgeChart').getContext('2d');
        if (hiperdiaAgeChartInstance) hiperdiaAgeChartInstance.destroy();

        hiperdiaAgeChartInstance = new Chart(ageCtx, {
            type: 'bar',
            data: {
                labels: Object.keys(stats.ageDistribution),
                datasets: [{
                    label: 'Pacientes',
                    data: Object.values(stats.ageDistribution),
                    backgroundColor: '#3b82f6',
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } }
            }
        });

        // Gráfico 2: Terapia (Polifarmácia)
        const therapyCtx = document.getElementById('hiperdiaTherapyChart').getContext('2d');
        if (hiperdiaTherapyChartInstance) hiperdiaTherapyChartInstance.destroy();

        hiperdiaTherapyChartInstance = new Chart(therapyCtx, {
            type: 'doughnut',
            data: {
                labels: Object.keys(stats.therapyType),
                datasets: [{
                    data: Object.values(stats.therapyType),
                    backgroundColor: ['#10b981', '#f59e0b'],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom' } }
            }
        });
    } catch (e) {
        console.error(e);
        showToast("Erro ao carregar dados do Hiperdia", "error");
    }
}

// 4. Rastreabilidade de Terceiros
// 4. Rastreabilidade de Retirantes
async function loadThirdPartyDispensations(periodStr) {
    const tbody = document.querySelector('#table-third-party tbody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:15px;"><i class="fa-solid fa-spinner fa-spin"></i> Carregando auditoria...</td></tr>';

    try {
        let url = `${API_URL}/reports/third-party-dispensations`;
        if (periodStr && periodStr !== 'all') {
            url += `?period=${periodStr}`;
        }
        
        const response = await fetch(url, { headers: getAuthHeaders(), credentials: 'include' });
        if (response.ok) {
            const data = await response.json();
            window._thirdPartyAuditData = data;
            currentAnalyticsData = data;
            
            tbody.innerHTML = '';
            if (!data || data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; color:#64748b; padding:15px;">Nenhuma retirada por retirantes registrada.</td></tr>';
                return;
            }

            data.forEach((item, index) => {
                const dateStr = item.dataEntrega ? new Date(item.dataEntrega).toLocaleString('pt-BR') : '-';
                tbody.innerHTML += `
                    <tr style="border-bottom: 1px solid #e2e8f0; cursor: pointer; transition: background-color 0.2s;" onclick="openAuditDetailsModal(${index})" onmouseover="this.style.backgroundColor='#f8fafc'" onmouseout="this.style.backgroundColor='transparent'">
                        <td style="padding: 12px 8px; width: 20%; text-align: center; vertical-align: middle; white-space: nowrap;">${dateStr}</td>
                        <td style="padding: 12px 8px; width: 30%; text-align: center; vertical-align: middle; font-weight:600; color:#1e3a8a;">${item.terceiroNome}</td>
                        <td style="padding: 12px 8px; width: 30%; text-align: center; vertical-align: middle; font-weight:500;">${item.pacienteNome}</td>
                        <td style="padding: 12px 8px; width: 20%; text-align: center; vertical-align: middle;">${item.medicamento}</td>
                    </tr>
                `;
            });
        } else {
            console.error("Erro na API", response.status);
            showToast("Erro ao carregar auditoria de retirantes", "error");
        }
    } catch (e) {
        console.error(e);
        showToast("Erro ao carregar auditoria de retirantes", "error");
    }
}

function openAuditDetailsModal(index) {
    if (!window._thirdPartyAuditData || !window._thirdPartyAuditData[index]) return;
    const item = window._thirdPartyAuditData[index];
    const dateStr = item.dataEntrega ? new Date(item.dataEntrega).toLocaleString('pt-BR') : '-';
    
    document.getElementById('audit-detail-date').textContent = dateStr;
    document.getElementById('audit-detail-dispenser').textContent = item.dispensador;
    document.getElementById('audit-detail-medication').textContent = item.medicamento;
    document.getElementById('audit-detail-quantity').textContent = item.quantidade;
    
    document.getElementById('audit-detail-third-name').textContent = item.terceiroNome;
    document.getElementById('audit-detail-third-cpf').textContent = item.terceiroCpf;
    
    document.getElementById('audit-detail-patient-name').textContent = item.pacienteNome;
    document.getElementById('audit-detail-patient-cpf').textContent = item.pacienteCpf;
    
    document.getElementById('auditDetailsModal').classList.add('active');
}

function closeAuditDetailsModal() {
    document.getElementById('auditDetailsModal').classList.remove('active');
}

// Expor globalmente para o HTML conseguir chamar no onclick
window.openAuditDetailsModal = openAuditDetailsModal;
window.closeAuditDetailsModal = closeAuditDetailsModal;

// Fechar modal ao clicar fora dela
window.addEventListener('click', function(event) {
    const modal = document.getElementById('auditDetailsModal');
    if (event.target == modal) {
        closeAuditDetailsModal();
    }
});

function filterThirdPartyTable() {
    const input = document.getElementById('search-third-party');
    const filter = input.value.toLowerCase();
    const rows = document.querySelectorAll('#table-third-party tbody tr');

    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        if (text.includes(filter)) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    });
}

// 5. Produtividade e Horários de Pico
async function loadProductivityStats() {
    try {
        const response = await fetch(`${API_URL}/reports/productivity-stats`, { headers: getAuthHeaders(), credentials: 'include' });
        if (!response.ok) throw new Error("Erro na API");
        const stats = await response.json();

        // 1. Gráfico de Produtividade dos Funcionários
        const empCtx = document.getElementById('productivityEmployeeChart').getContext('2d');
        if (prodEmployeeChartInstance) prodEmployeeChartInstance.destroy();

        prodEmployeeChartInstance = new Chart(empCtx, {
            type: 'bar',
            data: {
                labels: Object.keys(stats.employeeProductivity),
                datasets: [{
                    label: 'Entregas',
                    data: Object.values(stats.employeeProductivity),
                    backgroundColor: '#8b5cf6',
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y', // Grafico horizontal
                plugins: { legend: { display: false } }
            }
        });

        // 2. Gráfico de Faixas Horárias (Horários de Pico) - Null Check adicionado
        const hourChartEl = document.getElementById('productivityHourChart');
        if (hourChartEl) {
            const hourCtx = hourChartEl.getContext('2d');
            if (prodHourChartInstance) prodHourChartInstance.destroy();

            prodHourChartInstance = new Chart(hourCtx, {
                type: 'line',
                data: {
                    labels: Object.keys(stats.hourlyFlow),
                    datasets: [{
                        label: 'Atendimentos',
                        data: Object.values(stats.hourlyFlow),
                        borderColor: '#06b6d4',
                        backgroundColor: 'rgba(6, 182, 212, 0.1)',
                        fill: true,
                        tension: 0.3,
                        borderWidth: 3
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } }
                }
            });
        }

        // Atualiza o Tempo Médio se existir no DOM
        const avgServiceTimeEl = document.getElementById('avg-service-time');
        if (avgServiceTimeEl) {
            avgServiceTimeEl.textContent = stats.averageServiceTime ? `${stats.averageServiceTime} min` : '4 min';
        }

        // 3. Gráfico de Distribuição por Dia da Semana
        const weekCtx = document.getElementById('productivityWeekdayChart').getContext('2d');
        if (prodWeekdayChartInstance) prodWeekdayChartInstance.destroy();

        // Reorganizar ordenação do array de dias
        const weekdaysOrder = ["Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado", "Domingo"];
        const orderedLabels = [];
        const orderedData = [];

        weekdaysOrder.forEach(w => {
            if (stats.weekdayDistribution.hasOwnProperty(w)) {
                orderedLabels.push(w);
                orderedData.push(stats.weekdayDistribution[w]);
            }
        });

        prodWeekdayChartInstance = new Chart(weekCtx, {
            type: 'bar',
            data: {
                labels: orderedLabels,
                datasets: [{
                    label: 'Atendimentos',
                    data: orderedData,
                    backgroundColor: '#f59e0b',
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } }
            }
        });
    } catch (e) {
        console.error(e);
        showToast("Erro ao carregar estatísticas de produtividade", "error");
    }
}

// Exportador Excel Dedicado para Relatórios Analíticos Avançados
function exportAnalyticsExcel(reportId) {
    if (typeof XLSX === 'undefined') {
        showToast("Biblioteca Excel indisponível. Aguarde carregamento.", "error");
        return;
    }

    if (!currentAnalyticsData || currentAnalyticsData.length === 0) {
        showToast("Nenhum dado disponível para exportação.", "warning");
        return;
    }

    showToast("Baixando planilha...", "info");

    let worksheetData = [];
    let fileName = '';

    if (reportId === 'inventory-alerts') {
        worksheetData = currentAnalyticsData.map(item => ({
            "Princípio Ativo": item.activeIngredient,
            "Concentração": item.concentration,
            "Código Lote": item.lotCode,
            "Quantidade em Estoque": item.quantity,
            "Validade": item.expirationDate ? new Date(item.expirationDate).toLocaleDateString('pt-BR') : '-',
            "Dias Restantes": item.daysToExpiration === 9999 ? '-' : item.daysToExpiration,
            "Status de Risco": item.status
        }));
        fileName = 'alerta_estoque_validade_lotes';
    } else if (reportId === 'consumption-projection') {
        worksheetData = currentAnalyticsData.map(item => ({
            "Medicamento (Princípio Ativo)": item.activeIngredient,
            "Concentração": item.concentration,
            "Saldo Atual": item.totalStock,
            "Consumo Médio Mensal (CMM)": item.cmm,
            "Autonomia Estimada (Dias)": item.autonomyDays,
            "Urgência de Compra": item.status
        }));
        fileName = 'consumo_medio_mensal_cmm_projecao';
    } else if (reportId === 'third-party-dispensations') {
        worksheetData = currentAnalyticsData.map(item => ({
            "Data/Hora": item.dataEntrega ? new Date(item.dataEntrega).toLocaleString('pt-BR') : '-',
            "Nome do Retirante": item.terceiroNome,
            "CPF do Retirante": item.terceiroCpf,
            "Paciente Titular": item.pacienteNome,
            "CPF Titular": item.pacienteCpf,
            "Medicamento Entregue": item.medicamento,
            "Quantidade": item.quantidade,
            "Funcionário Responsável": item.dispensador
        }));
        fileName = 'rastreabilidade_auditoria_retirantes';
    }

    const worksheet = XLSX.utils.json_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Relatorio");
    XLSX.writeFile(workbook, `${fileName}_${new Date().getTime()}.xlsx`);
}

