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

// Registro centralizado do ciclo de vida das rotas (onMount) para respeitar o Princípio Aberto/Fechado (OCP)
const routeLifecycleRegistry = {
    'home': {
        onMount: () => {
            if (typeof initHomeModule === 'function') initHomeModule();
            if (typeof loadDashboardMetrics === 'function') loadDashboardMetrics("7days");
            if (typeof loadCriticalStock === 'function') loadCriticalStock();
            if (typeof loadRecentActivities === 'function') loadRecentActivities();
        }
    },
    'patient': {
        onMount: () => {
            if (typeof initPatientModule === 'function') initPatientModule();
            if (typeof renderPatientTable === 'function') renderPatientTable();
        }
    },
    'inventory': {
        onMount: () => {
            if (typeof initInventoryModule === 'function') initInventoryModule();
            if (typeof loadAllData === 'function') loadAllData();
        }
    },
    'total-inventory': {
        onMount: () => {
            if (typeof initTotalInventoryModule === 'function') initTotalInventoryModule();
            if (typeof loadInventory === 'function') loadInventory(0);
        }
    },
    'practitioner': {
        onMount: () => {
            if (typeof loadpractitioners === 'function') loadpractitioners();
        }
    },
    'dispensation': {
        onMount: () => {
            if (typeof initDispensationModule === 'function') initDispensationModule();
            if (typeof loadMedications === 'function') loadMedications();
            if (typeof loadDispensations === 'function') loadDispensations();
        }
    },
    'request': {
        onMount: () => {
            if (typeof initRequestModule === 'function') initRequestModule();
        }
    },
    'report': {
        onMount: () => {
            if (typeof switchReportTab === 'function') switchReportTab('dashboard');
        }
    },
    'audit': {
        onMount: () => {
            if (typeof loadAuditLogs === 'function') loadAuditLogs(0);
        }
    },
    'womens-health': {
        onMount: () => {
            if (window.WomensHealthController && typeof window.WomensHealthController.init === 'function') {
                window.WomensHealthController.init();
            }
        }
    }
};

window.registerRouteLifecycle = function (viewId, callbacks) {
    routeLifecycleRegistry[viewId] = callbacks;
};

async function switchView(viewId, pushState = true) {
    const userRole = window.getCurrentRole ? window.getCurrentRole() : sessionStorage.getItem('sgdm_userRole');
    if (userRole && userRole.toUpperCase() === 'ACS' && viewId !== 'acs-restricted') {
        switchView('acs-restricted', false);
        return;
    }
    console.log(`[SPA Router] Carregando a visão: ${viewId}`);
    
    // Alternar o tema e logo de Saúde da Mulher
    const sidebarLogo = document.getElementById('sidebarLogo');
    if (viewId === 'womens-health') {
        if (sidebarLogo) sidebarLogo.src = 'src/assets/img/logo-completa-secao-mulheres.svg';
    } else {
        document.body.classList.remove('theme-womens-health');
        if (sidebarLogo) sidebarLogo.src = 'src/assets/img/logo-barra-de-secao.svg';
    }
    
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
            'audit': { title: 'Auditoria do Sistema', desc: 'Registro de atividades, acessos e auditoria de dispensações' },
            'womens-health': { title: 'Saúde da Mulher', desc: 'Acompanhamento do uso de métodos contraceptivos e alertas de vencimento' }
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

    // 8. Executar re-inicialização através do registro de ciclo de vida das rotas (OCP)
    const lifecycle = routeLifecycleRegistry[viewId];
    if (lifecycle && typeof lifecycle.onMount === 'function') {
        lifecycle.onMount();
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
    const userRole = window.getCurrentRole ? window.getCurrentRole() : sessionStorage.getItem('sgdm_userRole');
    const userIsPrivileged = window.isPrivileged ? window.isPrivileged() : ['ADM_TI', 'ENF_GERENTE'].includes(userRole);

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
    if ((initialView === 'practitioner' || initialView === 'audit') && !userIsPrivileged) {
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
    
    if (practitionerLi) {
        practitionerLi.style.display = userIsPrivileged ? 'block' : 'none';
    }
    if (reportLi) {
        reportLi.style.display = userIsPrivileged ? 'block' : 'none';
    }
    if (auditLi) {
        auditLi.style.display = userIsPrivileged ? 'block' : 'none';
    }
}

// Inicializa quando o DOM estiver pronto (o renderizador de dados do usuário roda em components.js)
document.addEventListener('DOMContentLoaded', initSpaRouter);


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
