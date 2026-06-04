(function() {
// Limites para o cálculo manual no Front-end
const LIMITE_CRITICO_MEDICAMENTO = 50;
const LIMITE_CRITICO_INSUMO = 100;

let isHomeModuleInitialized = false;
window.initHomeModule = function() {
    if (isHomeModuleInitialized) return;
    isHomeModuleInitialized = true;

    // Ouvinte para alteração de período no gráfico
    const periodSelect = document.getElementById('categoryPeriodSelect');
    if (periodSelect) {
        periodSelect.addEventListener('change', (e) => {
            loadDashboardMetrics(e.target.value);
        });
    }
};

window.loadDashboardMetrics = async function(period = "7days") {
    const elements = {
        patients: document.getElementById('metricPatients'),
        dispensations: document.getElementById('metricDispensations'),
        lowStock: document.getElementById('metricLowStock'),
        expiring: document.getElementById('metricExpiring')
    };

    try {
        const [dispRes, medRes] = await Promise.allSettled([
            fetch(`${API_URL}/dispensations?size=1000`, { headers: getAuthHeaders() }),
            fetch(`${API_URL}/medications`, { headers: getAuthHeaders() })
        ]);
        
        let categoryData = {};
        let trendData = {};
        let dispensationsTodayCount = 0;

        const dispData = dispRes.status === 'fulfilled' && dispRes.value.ok ? await dispRes.value.json() : { content: [] };
        const dispensations = dispData.content || [];
        const medications = medRes.status === 'fulfilled' && medRes.value.ok ? await medRes.value.json() : [];

        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const sevenDaysAgo = todayStart - (6 * 24 * 60 * 60 * 1000); // 7 dias atrás

        // Filtro por período
        let filteredDispensations = dispensations;
        if (period === 'today') {
            filteredDispensations = dispensations.filter(d => d.moment && new Date(d.moment).getTime() >= todayStart);
        } else if (period === '7days') {
            filteredDispensations = dispensations.filter(d => d.moment && new Date(d.moment).getTime() >= sevenDaysAgo);
        }

        // Calculando dispensações hoje
        dispensationsTodayCount = dispensations.filter(d => d.moment && new Date(d.moment).getTime() >= todayStart).length;

        // Agrupando por categoria de programa (assumindo que medication.programCategory existe dentro dos itens)
        const categories = {
            'DIABETES': 'Diabetes',
            'HIPERTENSAO': 'Hipertensão',
            'FARMACIA_BASICA': 'Farmácia Básica',
            'SAUDE_DA_MULHER': 'Saúde da Mulher',
            'SAUDE_MULHER': 'Saúde da Mulher',
            'SAUDE_MENTAL': 'Saúde Mental'
        };

        filteredDispensations.forEach(d => {
            if (d.items) {
                let catsInDispensation = new Set();
                d.items.forEach(item => {
                    // Tentar obter a categoria do programa do item dispensado:
                    // 1. Do item diretamente (Refatoração 2)
                    // 2. Do objeto aninhado antigo (compatibilidade)
                    // 3. Cruzando ID com a lista de medicamentos ativa
                    const matchedMed = medications.find(m => m.id === item.medicationId);
                    const catEnum = item.programCategory || item.medication?.programCategory || matchedMed?.programCategory || 'FARMACIA_BASICA';
                    
                    const catLabel = categories[catEnum] || 'Farmácia Básica';
                    catsInDispensation.add(catLabel);
                });
                catsInDispensation.forEach(catLabel => {
                    categoryData[catLabel] = (categoryData[catLabel] || 0) + 1;
                });
            }
        });

            // Agrupando tendência por dia da semana (últimos 7 dias)
            const daysOfWeek = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
            // Preencher com 0 para os últimos 7 dias na ordem correta
            for (let i = 6; i >= 0; i--) {
                const d = new Date(todayStart - (i * 24 * 60 * 60 * 1000));
                trendData[daysOfWeek[d.getDay()]] = 0;
            }

            const weekDispensations = dispensations.filter(d => d.moment && new Date(d.moment).getTime() >= sevenDaysAgo);
            weekDispensations.forEach(d => {
                const dayStr = daysOfWeek[new Date(d.moment).getDay()];
                if (trendData[dayStr] !== undefined) {
                    trendData[dayStr]++;
                }
            });

        if (elements.dispensations) elements.dispensations.innerText = dispensationsTodayCount;
        
        // As contagens de lowStock e expiring serão atualizadas por loadCriticalStock()
        // Mas podemos colocar 0 por enquanto, até loadCriticalStock terminar
        if (elements.lowStock && elements.lowStock.innerText === '-') elements.lowStock.innerText = '0';
        if (elements.expiring && elements.expiring.innerText === '-') elements.expiring.innerText = '0';

        // Inicializa os gráficos
        initCharts(categoryData, trendData);

        if (elements.patients) {
            const patientsRes = await fetch(`${API_URL}/patients?status=ativos`, {
                headers: getAuthHeaders()
            });
            if (patientsRes.ok) {
                const patientsData = await patientsRes.json();
                elements.patients.innerText = patientsData.length || 0;
            } else {
                elements.patients.innerText = '0';
            }
        }
    } catch (error) {
        console.error("Erro ao buscar métricas (frontend):", error);
        initCharts({}, {});
    }
}

// --- FEED DE ATIVIDADES RECENTES ---
window.loadRecentActivities = async function() {
    const container = document.getElementById('recentActivityList');
    if (!container) return;

    try {
        // Buscamos as últimas dispensações
        const response = await fetch(`${API_URL}/dispensations?size=20`, {
            headers: getAuthHeaders()
        });
        
        if (response.ok) {
            const pageData = await response.json();
            const dispensations = pageData.content || [];
            // Ordena por data decrescente de forma robusta
            dispensations.sort((a, b) => {
                const dateA = a.moment ? new Date(a.moment).getTime() : 0;
                const dateB = b.moment ? new Date(b.moment).getTime() : 0;
                return dateB - dateA;
            });
            
            renderActivityFeed(dispensations.slice(0, 5));
        } else {
            container.innerHTML = `<div class="activity-placeholder">Sem atividades recentes.</div>`;
        }
    } catch (error) {
        console.error("Erro ao carregar atividades:", error);
        container.innerHTML = `<div class="activity-placeholder">Erro ao carregar.</div>`;
    }
}

function renderActivityFeed(activities) {
    const container = document.getElementById('recentActivityList');
    container.innerHTML = '';

    if (activities.length === 0) {
        container.innerHTML = `<div class="activity-placeholder">Nenhuma atividade registrada hoje.</div>`;
        return;
    }

    activities.forEach(act => {
        const item = document.createElement('div');
        item.className = 'activity-item';
        
        // Simulação de tempo relativo ou formatação de data
        const timeStr = act.moment ? new Date(act.moment).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Agora';

        item.innerHTML = `
            <div class="activity-icon bg-blue-soft">
                <i class="fa-solid fa-pills"></i>
            </div>
            <div class="activity-content">
                <div class="activity-title">Dispensação Realizada</div>
                <div class="activity-desc">Paciente: <strong>${escapeHTML((act.targetPatient ? act.targetPatient.name : null) || 'Não identificado')}</strong></div>
                <span class="activity-time">${escapeHTML(timeStr)}</span>
            </div>
        `;
        container.appendChild(item);
    });
}

// --- TABELA DE ESTOQUE CRÍTICO ---
window.loadCriticalStock = async function() {
    const tbody = document.getElementById('criticalStockBody');
    if (!tbody) return;

    try {
        const [medRes, supplyRes, facRes] = await Promise.allSettled([
            fetch(`${API_URL}/medications`, { headers: getAuthHeaders() }),
            fetch(`${API_URL}/supplies`, { headers: getAuthHeaders() }),
            fetch(`${API_URL}/supply-facilities`, { headers: getAuthHeaders() })
        ]);

        let medications = medRes.status === 'fulfilled' && medRes.value.ok ? await medRes.value.json() : [];
        let supplies = supplyRes.status === 'fulfilled' && supplyRes.value.ok ? await supplyRes.value.json() : [];
        let facilities = facRes.status === 'fulfilled' && facRes.value.ok ? await facRes.value.json() : [];

        let criticalItems = [];

        // Processar Medicamentos
        medications.forEach(med => {
            const totalStock = med.lots ? med.lots.reduce((acc, lot) => acc + (lot.currentQuantity || 0), 0) : 0;
            if (totalStock <= LIMITE_CRITICO_MEDICAMENTO) {
                criticalItems.push({
                    id: med.id,
                    mode: 'medicamentos',
                    type: 'Medicamento',
                    icon: '<i class="fa-solid fa-pills" style="color: #2563eb; font-size: 18px;"></i>',
                    name: `${med.activeIngredient} (${med.concentration})`,
                    stock: totalStock
                });
            }
        });

        // Processar Insumos
        supplies.forEach(s => {
            const totalStock = s.lots ? s.lots.reduce((acc, lot) => acc + (lot.currentQuantity || lot.receivedQuantity || 0), 0) : 0;
            if (totalStock <= LIMITE_CRITICO_INSUMO) {
                criticalItems.push({
                    id: s.id,
                    mode: 'insumos',
                    type: 'Insumo',
                    icon: '<i class="fa-solid fa-syringe" style="color: #0ea5e9; font-size: 18px;"></i>',
                    name: s.name,
                    stock: totalStock
                });
            }
        });

        // Processar Materiais
        facilities.forEach(f => {
            const totalStock = f.lots ? f.lots.reduce((acc, lot) => acc + (lot.currentQuantity || lot.receivedQuantity || 0), 0) : 0;
            if (totalStock <= LIMITE_CRITICO_INSUMO) {
                criticalItems.push({
                    id: f.id,
                    mode: 'materiais',
                    type: 'Material',
                    icon: '<i class="fa-solid fa-box-archive" style="color: #1e40af; font-size: 18px;"></i>',
                    name: f.name,
                    stock: totalStock
                });
            }
        });

        criticalItems.sort((a, b) => a.stock - b.stock);
        renderCriticalTable(criticalItems.slice(0, 10));

        // Atualiza a métrica de estoque baixo no topo da tela
        const metricLowStock = document.getElementById('metricLowStock');
        if (metricLowStock) {
            metricLowStock.innerText = criticalItems.length;
        }

    } catch (error) {
        console.error("Erro ao carregar estoque crítico:", error);
        tbody.innerHTML = `<tr><td colspan="4" class="text-center text-danger">Erro de conexão com o servidor.</td></tr>`;
    }
}

function renderCriticalTable(items) {
    const tbody = document.getElementById('criticalStockBody');
    tbody.innerHTML = '';

    if (items.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="text-center p-20 text-success fw-600">
            <i class="fa-solid fa-circle-check"></i> Tudo em ordem! Sem itens em nível crítico.
        </td></tr>`;
        return;
    }

    const fragment = document.createDocumentFragment();

    items.forEach(item => {
        const isZero = item.stock === 0;
        const statusBadge = isZero
            ? `<span class="status-badge badge-danger">Esgotado</span>`
            : `<span class="status-badge badge-warning">Baixo</span>`;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><span class="d-flex align-center gap-15 fs-14 fw-600">${item.icon} ${escapeHTML(item.type)}</span></td>
            <td class="fs-14 fw-500">${escapeHTML(item.name)}</td>
            <td class="text-center font-data ${isZero ? 'text-danger fw-700' : 'fw-600'}">${escapeHTML(item.stock)}</td>
            <td class="text-center">${statusBadge}</td>
        `;
        fragment.appendChild(tr);
    });

    tbody.appendChild(fragment);
}

// --- GRÁFICOS (CHART.JS) ---
let categoryChartInstance = null;
let trendChartInstance = null;

function initCharts(categoryData = {}, trendData = {}) {
    // 1. Gráfico de Rosca: Dispensações por Categoria de Medicamento
    const categoryCtx = document.getElementById('categoryChart').getContext('2d');
    
    // As chaves retornadas pelo backend em categoryData já são amigáveis:
    // "Diabetes", "Hipertensão", "Farmácia Básica", "Saúde da Mulher", "Saúde Mental"
    const categoryLabels = ['Diabetes', 'Hipertensão', 'Farmácia Básica', 'Saúde da Mulher', 'Saúde Mental'];
    const categoryValues = categoryLabels.map(label => categoryData[label] || 0);

    const hasCategoryData = categoryValues.some(val => val > 0);
    // Se não houver dados, plotamos fatias iguais a 1 para exibir o círculo completo, mas o tooltip mostrará 0 dispensações
    const chartData = hasCategoryData ? categoryValues : [1, 1, 1, 1, 1];

    if (categoryChartInstance) {
        categoryChartInstance.destroy();
    }

    categoryChartInstance = new Chart(categoryCtx, {
        type: 'doughnut',
        data: {
            labels: categoryLabels,
            datasets: [{
                data: chartData,
                backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'],
                borderWidth: hasCategoryData ? 4 : 0, // Borda de separação premium
                borderColor: '#ffffff',
                borderRadius: hasCategoryData ? 8 : 0, // Cantos arredondados modernos (corrige o bug de ficar quadrado)
                hoverOffset: hasCategoryData ? 12 : 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: {
                padding: 15
            },
            plugins: {
                legend: { 
                    position: 'bottom', 
                    labels: { 
                        usePointStyle: true, 
                        padding: 15,
                        font: { size: 11 }
                    } 
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const value = hasCategoryData ? context.raw : 0;
                            return ` ${context.label}: ${value} dispensações`;
                        }
                    }
                }
            },
            cutout: '75%' // Corte ligeiramente mais fino para um ar super moderno
        }
    });

    // 2. Gráfico de Linha: Tendência de Atendimento (Últimos 7 dias)
    const trendCtx = document.getElementById('trendChart').getContext('2d');
    
    // O backend já retorna as chaves do trendData com os nomes dos dias abreviados ordenados ("Seg", "Ter", "Qua", etc.)
    let trendLabels = Object.keys(trendData);
    let trendValues = Object.values(trendData);
    
    if (trendLabels.length === 0) {
        // Fallback caso não venha dados
        trendLabels = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
        trendValues = [0, 0, 0, 0, 0, 0, 0];
    }

    if (trendChartInstance) {
        trendChartInstance.destroy();
    }

    trendChartInstance = new Chart(trendCtx, {
        type: 'line',
        data: {
            labels: trendLabels,
            datasets: [{
                label: 'Atendimentos',
                data: trendValues,
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                fill: true,
                tension: 0.4,
                pointRadius: 4,
                pointBackgroundColor: '#3b82f6'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: { beginAtZero: true, grid: { display: false } },
                x: { grid: { display: false } }
            }
        }
    });
}

})();