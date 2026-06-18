/**
 * router.js — Roteador de SPA Vanilla utilizando Fetch API
 * Carrega fragmentos HTML sob demanda e os injeta no DOM.
 */

// Cache opcional das views para evitar fetch repetido (acelera a navegação)
const viewCache = {};

async function fetchViewHtml(viewId) {
    if (viewCache[viewId]) {
        return viewCache[viewId];
    }
    
    try {
        const response = await fetch(`src/pages/views/${viewId}.html`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const html = await response.text();
        viewCache[viewId] = html;
        return html;
    } catch (error) {
        console.error(`[SPA Router] Erro ao buscar view ${viewId}:`, error);
        return `<div style="padding: 20px; color: red;">Erro ao carregar a página (${viewId}). Verifique o console.</div>`;
    }
}

async function switchView(viewId, pushState = true) {
    const userRole = localStorage.getItem('sgdm_userRole');
    if (userRole && userRole.toUpperCase() === 'ACS' && viewId !== 'acs-restricted') {
        switchView('acs-restricted', false);
        return;
    }
    console.log(`[SPA Router] Carregando a visão: ${viewId}`);
    
    showGlobalLoader();

    // 1. Ocultar container atual suavemente (opcional para transição mais bonita)
    const container = document.getElementById('app-content-container');
    if (container) {
        container.style.opacity = '0.5';
    }

    // 2. Buscar HTML (usa cache se já existe, caso contrário faz o fetch)
    const viewHtml = await fetchViewHtml(viewId);
    
    // 3. Injetar HTML no Container
    if (container) {
        container.innerHTML = viewHtml;
        
        // Ativar a section injetada para que o CSS `.view-section.active` funcione
        const injectedSection = container.querySelector('.view-section');
        if (injectedSection) {
            injectedSection.classList.add('active');
            injectedSection.style.display = 'flex';
        }

        container.style.opacity = '1';
        
        // Resetar para a primeira aba (parte inicial da seção)
        const firstTab = container.querySelector('.tabs-container .tab');
        if (firstTab) {
            firstTab.click();
        }
        
        // Resetar o scroll
        const scrollable = container.querySelector('.form-content, .home-content, [style*="overflow"]');
        if (scrollable) scrollable.scrollTo(0, 0);
        window.scrollTo(0, 0);
    } else {
        console.warn(`[SPA Router] Container 'app-content-container' não encontrado no HTML principal.`);
    }

    // 4. Atualizar menu ativo na Sidebar
    const links = document.querySelectorAll('.sidebar-nav a');
    links.forEach(link => {
        const href = link.getAttribute('href');
        if (href === `#${viewId}`) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });

    // 5. Atualizar Título e Descrição no Header
    const h1 = document.getElementById('page-title-h1');
    const p = document.getElementById('page-title-p');
    if (h1 && p) {
        const titles = {
            'home': { title: 'Painel Geral', desc: 'Visão geral das operações e alertas do sistema' },
            'patient': { title: 'Gestão de Pacientes', desc: 'Busca, cadastros e atualizações de prontuário' },
            'dispensation': { title: 'Dispensa de Medicamentos', desc: 'Registro e histórico de dispensações de medicamentos a pacientes' },
            'inventory': { title: 'Estoque Geral', desc: 'Entrada de lotes e cadastro de itens no catálogo' },
            'total-inventory': { title: 'Inventário Geral', desc: 'Consulta, filtros e controle de saldo total de itens do catálogo' },
            'practitioner': { title: 'Gestão de Funcionários', desc: 'Cadastro, atualização e controle de acesso da equipe' },
            'request': { title: 'Pedidos e Requisições', desc: 'Geração e preenchimento de requisições de medicamentos e insumos para o Almoxarifado' },
            'report': { title: 'Painel de Relatórios', desc: 'Visão gerencial e extração dinâmica de dados' },
            'audit': { title: 'Auditoria do Sistema', desc: 'Registro de atividades, acessos e auditoria de dispensações' }
        };
        const info = titles[viewId] || { title: 'Assistência Farmacêutica', desc: 'Gerenciamento de Medicamentos e Insumos' };
        h1.innerText = info.title;
        p.innerText = info.desc;
    }

    // 6. Salvar estado de navegação no histórico do navegador
    if (pushState) {
        history.pushState({ viewId }, '', `#${viewId}`);
    }

    // 7. Garantir o efeito de fade-in pronto
    document.body.classList.add('ready');

    // 8. Executar re-inicialização de dados específicos do JS de cada módulo
    if (viewId === 'home') {
        if (typeof initHomeModule === 'function') initHomeModule();
        if (typeof loadDashboardMetrics === 'function') loadDashboardMetrics("7days");
        if (typeof loadCriticalStock === 'function') loadCriticalStock();
        if (typeof loadRecentActivities === 'function') loadRecentActivities();
    } else if (viewId === 'patient') {
        if (typeof initPatientModule === 'function') initPatientModule();
        if (typeof renderPatientTable === 'function') renderPatientTable();
    } else if (viewId === 'inventory') {
        if (typeof initInventoryModule === 'function') initInventoryModule();
        if (typeof loadAllData === 'function') loadAllData();
    } else if (viewId === 'total-inventory') {
        if (typeof initTotalInventoryModule === 'function') initTotalInventoryModule();
        if (typeof loadInventory === 'function') loadInventory(0);
    } else if (viewId === 'practitioner') {
        if (typeof loadpractitioners === 'function') loadpractitioners();
    } else if (viewId === 'dispensation') {
        if (typeof initDispensationModule === 'function') initDispensationModule();
        if (typeof loadMedications === 'function') loadMedications();
        if (typeof loadDispensations === 'function') loadDispensations();
    } else if (viewId === 'request') {
        if (typeof initRequestModule === 'function') initRequestModule();
    } else if (viewId === 'report') {
        if (typeof switchReportTab === 'function') switchReportTab('dashboard');
    } else if (viewId === 'audit') {
        if (typeof loadAuditLogs === 'function') loadAuditLogs(0);
    }

    hideGlobalLoader();
}

// Inicializar ouvintes do roteador
function initSpaRouter() {
    console.log("[SPA Router] Inicializando Novo Roteador Dinâmico (Fetch API)...");

    // Escutar eventos de avançar/voltar nas setas do navegador
    window.addEventListener('popstate', function (e) {
        const hash = window.location.hash.substring(1) || 'home';
        switchView(hash, false);
    });

    // Ler hash da URL de entrada para carregar a tela correspondente no reload
    const initialView = window.location.hash.substring(1) || 'home';
    
    // Tratamento de segurança para privilégios de Administrador
    const userRole = localStorage.getItem('sgdm_userRole');
    if (userRole && userRole.toUpperCase() === 'ACS') {
        const sidebar = document.querySelector('.sidebar');
        const sidebarPlaceholder = document.getElementById('sidebar-placeholder');
        const mainContent = document.querySelector('.main-content');
        if (sidebar) sidebar.style.display = 'none';
        if (sidebarPlaceholder) sidebarPlaceholder.style.display = 'none';
        if (mainContent) mainContent.style.margin = '16px';
        switchView('acs-restricted', false);
        return;
    }
    if ((initialView === 'practitioner' || initialView === 'audit') && !['ADM_TI', 'ENF_GERENTE'].includes(userRole)) {
        switchView('home', false);
        return;
    }

    switchView(initialView, false);

    // Ajustar visual da logo
    const logoImg = document.querySelector('.sidebar-header img');
    if (logoImg) {
        logoImg.style.maxHeight = '110px';
    }

    // RBAC: Ocultar menu de funcionários, relatórios e auditoria para usuários sem privilégio
    const practitionerLi = document.getElementById('sidebarPractitionerLi');
    const reportLi = document.getElementById('sidebarReportLi');
    const auditLi = document.getElementById('sidebarAuditLi');
    const isPrivileged = ['ADM_TI', 'ENF_GERENTE'].includes(userRole);
    
    if (practitionerLi) {
        practitionerLi.style.display = isPrivileged ? 'block' : 'none';
    }
    if (reportLi) {
        reportLi.style.display = isPrivileged ? 'block' : 'none';
    }
    if (auditLi) {
        auditLi.style.display = isPrivileged ? 'block' : 'none';
    }
}

// Inicializa quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
    // Restaurar nome do usuário no cabeçalho
    const loggedpractitionerName = localStorage.getItem('sgdm_userName');
    const loggedUserEl = document.getElementById('loggedUser');
    if (loggedUserEl && loggedpractitionerName) {
        loggedUserEl.innerText = loggedpractitionerName;
    }

    // Cargo formatado
    const statusEl = document.querySelector('.user-status');
    const practitionerRoleRaw = localStorage.getItem('sgdm_userRole');
    if (statusEl) {
        let displayRole = 'Funcionário';
        if (practitionerRoleRaw && practitionerRoleRaw !== 'undefined') {
            const roleMap = {
                'ADM_TI': 'Administrador de TI',
                'ENF_GERENTE': 'Enfermeiro(a) Gerente',
                'ENF': 'Enfermeiro(a)',
                'TRIAGEM': 'Triagem',
                'TEC_ENFERMAGEM': 'Técnico(a) de Enfermagem',
                'FARMACEUTICO': 'Farmacêutico',
                'ADMINISTRATIVO': 'Administrativo',
                'ACS': 'ACS'
            };
            displayRole = roleMap[practitionerRoleRaw.toUpperCase()] ||
                roleMap[practitionerRoleRaw.toUpperCase()] ||
                practitionerRoleRaw.charAt(0).toUpperCase() + practitionerRoleRaw.slice(1).toLowerCase();
        }
        statusEl.innerText = displayRole;
    }

    initSpaRouter();
});

// Expõe globalmente para botões/links inline
window.switchView = switchView;

// Função robusta de controle de abas escopada por irmãos para evitar colisões no SPA unificado
function switchTab(tabId, element) {
    const container = element.parentElement;
    if (container) {
        container.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    }
    element.classList.add('active');

    // Localiza a seção alvo dentro do DOM atual (que pode ter acabado de ser injetado)
    const targetSection = document.getElementById(tabId);
    if (targetSection && targetSection.parentElement) {
        Array.from(targetSection.parentElement.children).forEach(child => {
            if (child.classList.contains('tab-section')) {
                child.classList.remove('active-section');
                child.style.display = 'none';
            }
        });
        targetSection.classList.add('active-section');
        targetSection.style.display = 'block';
    }
}

window.switchTab = switchTab;
