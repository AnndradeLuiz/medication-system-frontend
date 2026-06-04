/**
 * components.js — Carregamento dinâmico de componentes (Sidebar e Header)
 * Tarefa 5: Componentização de Partials
 */

async function initComponents() {
    try {
        // 1. Carregar Sidebar
        const sidebarPlaceholder = document.getElementById('sidebar-placeholder');
        if (sidebarPlaceholder) {
            const sidebarHtml = await fetch('partials/sidebar.html').then(r => r.text());
            sidebarPlaceholder.innerHTML = sidebarHtml;

            // Marcar link ativo na sidebar
            highlightActiveLink();
        }

        // 2. Carregar Header
        const headerPlaceholder = document.getElementById('header-placeholder');
        if (headerPlaceholder) {
            const headerHtml = await fetch('partials/header.html').then(r => r.text());
            headerPlaceholder.innerHTML = headerHtml;
        }

        // Restaurar nome do usuário logado e cargo (funciona para layouts estáticos e dinâmicos)
        const loggedEmployeeName = localStorage.getItem('sgdm_userName');
        const loggedUserEl = document.getElementById('loggedUser');
        if (loggedUserEl && loggedEmployeeName) {
            loggedUserEl.innerText = loggedEmployeeName;
        }

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
                    employeeRoleRaw.charAt(0).toUpperCase() + employeeRoleRaw.slice(1).toLowerCase();
            }
            statusEl.innerText = displayRole;
        }

        // 3. Inicializar eventos (do auth.js)
        if (typeof setupMobileMenu === 'function') {
            setupMobileMenu();
        }

        // 4. Inicializar o Roteador SPA (Single Page Application)
        if (!window.navigateTo) {
            console.log("[Components] Carregando o roteador SPA dinamicamente...");
            const routerScript = document.createElement('script');
            routerScript.src = 'js/router.js';
            routerScript.onload = () => {
                if (typeof initSpaRouter === 'function') {
                    initSpaRouter();
                }
                // Ativar fade-in suave ao carregar todos os componentes e roteador
                document.body.classList.add('ready');
            };
            routerScript.onerror = () => {
                console.error("[Components] Falha ao carregar js/router.js");
                document.body.classList.add('ready');
            };
            document.body.appendChild(routerScript);
        } else {
            // Se o roteador já estiver carregado (navegação interna), apenas garante exibição
            document.body.classList.add('ready');
        }

    } catch (error) {
        console.error("Erro ao carregar componentes:", error);
        document.body.classList.add('ready'); // Garante exibição em caso de erro
    }
}

/**
 * Destaca o link da sidebar correspondente à página atual
 */
function highlightActiveLink() {
    const currentPath = window.location.pathname.split('/').pop() || 'home-screen.html';
    const links = document.querySelectorAll('.sidebar-nav a');

    links.forEach(link => {
        const href = link.getAttribute('href');
        if (href === currentPath) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });
}

// Inicializar quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', initComponents);

/**
 * Utilitário para Feedback de Ação (Tarefa 6)
 * Gerencia o estado de loading de um botão.
 * 
 * @param {string} buttonId - ID do botão
 * @param {boolean} isLoading - Se deve ativar ou desativar o loading
 * @param {string} originalHtml - Conteúdo original do botão para restaurar (opcional)
 */
function setLoading(buttonId, isLoading, originalHtml = '') {
    // Suporte para assinatura simplificada de um parâmetro (boolean) do inventário
    if (typeof buttonId === 'boolean') {
        if (buttonId) showGlobalLoader();
        else hideGlobalLoader();
        return;
    }

    const btn = document.getElementById(buttonId);
    if (!btn) return;

    if (isLoading) {
        // Salvar HTML original se não for fornecido
        if (!originalHtml) btn.dataset.originalHtml = btn.innerHTML;

        btn.classList.add('btn-loading');
        btn.disabled = true;
    } else {
        btn.classList.remove('btn-loading');
        btn.disabled = false;

        // Restaurar HTML original
        if (originalHtml) {
            btn.innerHTML = originalHtml;
        } else if (btn.dataset.originalHtml) {
            btn.innerHTML = btn.dataset.originalHtml;
        }
    }
}

/**
 * Exibe a animação global da logo pulsante
 */
function showGlobalLoader() {
    const loader = document.getElementById('globalLoader');
    if (loader) loader.classList.remove('d-none');
}

/**
 * Esconde a animação global da logo pulsante
 */
function hideGlobalLoader() {
    const loader = document.getElementById('globalLoader');
    if (loader) loader.classList.add('d-none');
}

// Redundância de segurança (failsafe): garante que a página sempre fique visível mesmo em lentidão de rede
setTimeout(() => {
    document.body.classList.add('ready');
}, 200);

// --- GLOBAL UTILITIES ---
window.escapeHTML = function(str) {
    if (str === null || str === undefined || str === '') return '';
    return String(str).replace(/[&<>"']/g, function(m) {
        return {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        }[m];
    });
};

window.applyCpfMask = function(valOrEvent) {
    let value = typeof valOrEvent === 'string' ? valOrEvent : valOrEvent.target.value;
    value = value.replace(/\D/g, "");
    if (value.length > 11) value = value.slice(0, 11);
    
    value = value.replace(/(\d{3})(\d)/, "$1.$2");
    value = value.replace(/(\d{3})(\d)/, "$1.$2");
    value = value.replace(/(\d{3})(\d{1,2})$/, "$1-$2");
    
    if (typeof valOrEvent === 'object') {
        valOrEvent.target.value = value;
    }
    return value;
};

window.formatCPF = function(cpf) {
    if (!cpf) return '-';
    let value = cpf.replace(/\D/g, "");
    if (value.length !== 11) return cpf;
    return value.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
};

window.isValidCPF = function(cpf) {
    if (!cpf) return false;
    cpf = cpf.replace(/[^\d]+/g, '');
    if (cpf.length !== 11 || !!cpf.match(/(\d)\1{10}/)) return false;
    
    let sum = 0;
    let remainder;
    
    for (let i = 1; i <= 9; i++) sum = sum + parseInt(cpf.substring(i - 1, i)) * (11 - i);
    remainder = (sum * 10) % 11;
    if ((remainder === 10) || (remainder === 11)) remainder = 0;
    if (remainder !== parseInt(cpf.substring(9, 10))) return false;
    
    sum = 0;
    for (let i = 1; i <= 10; i++) sum = sum + parseInt(cpf.substring(i - 1, i)) * (12 - i);
    remainder = (sum * 10) % 11;
    if ((remainder === 10) || (remainder === 11)) remainder = 0;
    if (remainder !== parseInt(cpf.substring(10, 11))) return false;
    
    return true;
};

// Exportar funções de loading globais para o objeto window
window.setLoading = setLoading;
window.showGlobalLoader = showGlobalLoader;
window.hideGlobalLoader = hideGlobalLoader;


