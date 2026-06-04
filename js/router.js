/**
 * router.js — Roteador de SPA Unificada em Arquivo Único (app.html)
 * Gerencia a alternação instantânea de seções visible/invisible,
 * sincroniza classes active no menu e títulos no header, e suporta
 * voltar/avançar no histórico usando hash do navegador.
 */

function switchView(viewId, pushState = true) {
    console.log(`[SPA Router] Mudando para a visão: ${viewId}`);
    
    // 1. Ocultar todas as seções e mostrar apenas a ativa
    const sections = document.querySelectorAll('.view-section');
    sections.forEach(sec => {
        sec.classList.remove('active');
        sec.style.removeProperty('display');
    });
    
    const targetSection = document.getElementById(`view-${viewId}`);
    if (targetSection) {
        targetSection.classList.add('active');
        targetSection.style.removeProperty('display');
        
        // Resetar para a primeira aba (parte inicial da seção)
        const firstTab = targetSection.querySelector('.tabs-container .tab');
        if (firstTab) {
            firstTab.click();
        }
        
        // Resetar o scroll para o topo ao mudar de seção
        const scrollable = targetSection.querySelector('.form-content, .home-content, [style*="overflow"]');
        if (scrollable) scrollable.scrollTo(0, 0);
        window.scrollTo(0, 0);
    } else {
        console.warn(`[SPA Router] Seção view-${viewId} não encontrada.`);
    }

    // 2. Atualizar menu ativo na Sidebar
    const links = document.querySelectorAll('.sidebar-nav a');
    links.forEach(link => {
        const href = link.getAttribute('href');
        if (href === `#${viewId}`) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });

    // 3. Atualizar Título e Descrição no Header
    const h1 = document.getElementById('page-title-h1');
    const p = document.getElementById('page-title-p');
    if (h1 && p) {
        const titles = {
            'home-screen': { title: 'Painel Geral', desc: 'Visão geral das operações e alertas do sistema' },
            'patient': { title: 'Gestão de Pacientes', desc: 'Busca, cadastros e atualizações de prontuário' },
            'dashboard': { title: 'Dispensa de Medicamentos', desc: 'Registro e histórico de dispensações de medicamentos a pacientes' },
            'estoque': { title: 'Estoque Geral', desc: 'Entrada de lotes e cadastro de itens no catálogo' },
            'inventory-list': { title: 'Inventário Total', desc: 'Listagem unificada de todos os itens do sistema' },
            'funcionarios': { title: 'Gestão de Funcionários', desc: 'Cadastro, atualização e controle de acesso da equipe' },
            'pedidos': { title: 'Pedidos e Requisições', desc: 'Geração e preenchimento de requisições de medicamentos e insumos para o Almoxarifado' },
            'relatorios': { title: 'Painel de Relatórios', desc: 'Visão gerencial e extração dinâmica de dados' },
            'audit': { title: 'Auditoria Geral do Sistema', desc: 'Rastreamento completo de ações e auditoria de logs' }
        };
        const info = titles[viewId] || { title: 'Assistência Farmacêutica', desc: 'Gerenciamento de Medicamentos e Insumos' };
        h1.innerText = info.title;
        p.innerText = info.desc;
    }

    // 4. Salvar estado de navegação no histórico do navegador
    if (pushState) {
        history.pushState({ viewId }, '', `#${viewId}`);
    }

    // 5. Garantir o efeito de fade-in pronto
    document.body.classList.add('ready');

    // Executar re-inicialização de dados específicos se a função existir
    if (viewId === 'home-screen') {
        if (typeof initHomeModule === 'function') initHomeModule();
        if (typeof loadDashboardMetrics === 'function') loadDashboardMetrics("7days");
        if (typeof loadCriticalStock === 'function') loadCriticalStock();
        if (typeof loadRecentActivities === 'function') loadRecentActivities();
    } else if (viewId === 'patient') {
        if (typeof initPatientModule === 'function') initPatientModule();
        if (typeof renderPatientTable === 'function') renderPatientTable();
    } else if (viewId === 'estoque') {
        if (typeof initEstoqueModule === 'function') initEstoqueModule();
        if (typeof loadAllData === 'function') loadAllData();
    } else if (viewId === 'funcionarios') {
        // No módulo funcionários, loadEmployees carrega a API e renderiza a tabela internamente
        if (typeof loadEmployees === 'function') loadEmployees();
    } else if (viewId === 'inventory-list') {
        if (typeof initInventoryModule === 'function') initInventoryModule();
        // if (typeof loadInventory === 'function') loadInventory(); // Desativado para carregar só ao filtrar
    } else if (viewId === 'dashboard') {
        if (typeof initDashboardModule === 'function') initDashboardModule();
        if (typeof loadMedications === 'function') loadMedications();
        if (typeof loadDispensations === 'function') loadDispensations();
    } else if (viewId === 'pedidos') {
        if (typeof initPedidosModule === 'function') initPedidosModule();
    } else if (viewId === 'audit') {
        if (typeof loadAuditLogs === 'function') loadAuditLogs(0);
    }
}

// Inicializar ouvintes do roteador
function initSpaRouter() {
    console.log("[SPA Router] Inicializando Roteador de Arquivo Único...");

    // Escutar eventos de avançar/voltar nas setas do navegador
    window.addEventListener('popstate', function (e) {
        const hash = window.location.hash.substring(1) || 'home-screen';
        switchView(hash, false);
    });

    // Ler hash da URL de entrada para carregar a tela correspondente no reload
    const initialView = window.location.hash.substring(1) || 'home-screen';
    
    // Tratamento de segurança para privilégios de Administrador
    const userRole = localStorage.getItem('sgdm_userRole');
    if ((initialView === 'funcionarios' || initialView === 'audit') && !['ADM_TI', 'ENF_GERENTE'].includes(userRole)) {
        switchView('home-screen', false);
        return;
    }

    switchView(initialView, false);

    // Ajustar visual da logo
    const logoImg = document.querySelector('.sidebar-header img');
    if (logoImg) {
        logoImg.style.maxHeight = '110px';
    }

    // RBAC: Ocultar menu de funcionários, relatórios e auditoria para usuários sem privilégio
    const funcLi = document.getElementById('sidebarFuncLi');
    const relatoriosLi = document.getElementById('sidebarRelatoriosLi');
    const auditLi = document.getElementById('sidebarAuditLi');
    const isPrivileged = ['ADM_TI', 'ENF_GERENTE'].includes(userRole);
    
    if (funcLi) {
        funcLi.style.display = isPrivileged ? 'block' : 'none';
    }
    if (relatoriosLi) {
        relatoriosLi.style.display = isPrivileged ? 'block' : 'none';
    }
    if (auditLi) {
        auditLi.style.display = isPrivileged ? 'block' : 'none';
    }
}

// Inicializa quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
    // Restaurar nome do usuário no cabeçalho
    const loggedEmployeeName = localStorage.getItem('sgdm_userName');
    const loggedUserEl = document.getElementById('loggedUser');
    if (loggedUserEl && loggedEmployeeName) {
        loggedUserEl.innerText = loggedEmployeeName;
    }

    // Cargo formatado
    const statusEl = document.querySelector('.user-status');
    const employeeRoleRaw = localStorage.getItem('sgdm_userRole');
    if (statusEl) {
        let displayRole = 'Funcionário';
        if (employeeRoleRaw && employeeRoleRaw !== 'undefined') {
            const roleMap = {
                'ADM_TI': 'Administrador de TI',
                'ENF_GERENTE': 'Enfermeiro(a) Gerente',
                'TEC_ENFERMAGEM': 'Técnico(a) de Enfermagem',
                'FARMACEUTICO': 'Farmacêutico',
                'ADMINISTRATIVO': 'Administrativo'
            };
            displayRole = roleMap[employeeRoleRaw.toUpperCase()] ||
                roleMap[employeeRoleRaw.toUpperCase()] ||
                employeeRoleRaw.charAt(0).toUpperCase() + employeeRoleRaw.slice(1).toLowerCase();
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
