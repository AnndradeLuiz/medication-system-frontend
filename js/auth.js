/**
 * auth.js — Módulo centralizado de autorização (RBAC)
 * Utilizado por todas as páginas do SGDMI para controlar acesso por role.
 *
 * Roles com acesso total: ADM_TI, ENF_GERENTE
 * Roles com acesso restrito: TEC_ENFERMAGEM, FARMACEUTICO, ADMINISTRATIVO
 *
 * Funcionalidades bloqueadas para roles básicos:
 * - Cadastrar medicamento
 * - Cadastrar qualquer tipo de insumo/material
 * - Editar ou remover medicamento/insumo
 * - Cadastrar ou gerenciar funcionários
 */

const PRIVILEGED_ROLES = ['ADM_TI', 'ENF_GERENTE'];
let isServerOffline = false;
let reconnectionInterval = null;
let heartbeatInterval = null;

/**
 * Função global para alternar a visibilidade do menu lateral no mobile
 */
window.toggleSidebar = function() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    if (sidebar) {
        sidebar.classList.toggle('open');
    }
    if (overlay) {
        overlay.classList.toggle('active');
    }
};

/**
 * Controle do menu mobile (sidebar toggle)
 * Ativado automaticamente em telas ≤ 1024px via CSS
 */
function setupMobileMenu() {
    const menuBtn = document.querySelector('.mobile-menu-btn');
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.sidebar-overlay');

    if (!menuBtn || !sidebar) return;

    menuBtn.addEventListener('click', () => {
        sidebar.classList.toggle('open');
        if (overlay) overlay.classList.toggle('active');
    });

    if (overlay) {
        overlay.addEventListener('click', () => {
            sidebar.classList.remove('open');
            overlay.classList.remove('active');
        });
    }

    // Fechar sidebar ao clicar em um link de navegação
    sidebar.querySelectorAll('.sidebar-nav a').forEach(link => {
        link.addEventListener('click', () => {
            sidebar.classList.remove('open');
            if (overlay) overlay.classList.remove('active');
        });
    });
}

/**
 * Injeta o HTML e CSS do overlay de servidor offline.
 */
function injectOfflineOverlay() {
    if (document.getElementById('server-offline-overlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'server-offline-overlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.7);
        backdrop-filter: blur(4px);
        display: none;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        z-index: 999999;
        color: #1f2937;
        font-family: 'Inter', sans-serif;
        text-align: center;
    `;

    overlay.innerHTML = `
        <div style="background: white; padding: 30px; border-radius: 12px; max-width: 350px; box-shadow: 0 10px 25px rgba(0,0,0,0.2);">
            <div style="font-size: 40px; color: #ef4444; margin-bottom: 15px;">
                <i class="fa-solid fa-circle-exclamation"></i>
            </div>
            <p style="margin: 0; font-weight: 600; font-size: 16px;">Erro ao comunicar-se com o servidor.</p>
            <div style="display: flex; align-items: center; justify-content: center; gap: 8px; color: #6b7280; font-size: 14px; margin-top: 10px;">
                <i class="fa-solid fa-circle-notch fa-spin"></i>
                <span>Tentando reconectar...</span>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);
}

/**
 * Exibe o aviso de servidor offline.
 */
function showOfflineOverlay() {
    if (isServerOffline) return;
    isServerOffline = true;
    
    const overlay = document.getElementById('server-offline-overlay');
    if (overlay) overlay.style.display = 'flex';
}


/**
 * Monitoramento de Sessão Local (Renovação Proativa)
 * Verifica a expiração do token localmente a cada minuto.
 * Se estiver prestes a expirar (< 2 min), faz um refresh proativo.
 */
function startHeartbeat() {
    if (heartbeatInterval) clearInterval(heartbeatInterval);
    
    heartbeatInterval = setInterval(() => {
        const expStr = localStorage.getItem('sgdm_token_exp');
        if (!expStr) return;
        
        try {
            const exp = parseInt(expStr, 10);
            const currentTimestamp = Math.floor(Date.now() / 1000);
            
            // Faltam menos de 2 minutos para expirar?
            if (exp && (exp - currentTimestamp) < 120) {
                console.warn('[Auth] Access Token prestes a expirar. Tentando renovação proativa...');
                
                // Evita disparar vários se já estiver renovando pelo interceptor
                if (!isRefreshing) {
                    const apiUrl = typeof API_URL !== 'undefined' ? API_URL : '';
                    // Um fetch manual proativo (o interceptor vai cuidar da resposta se der 401)
                    fetch(`${apiUrl}/auth/refresh`, {
                        method: 'POST',
                        credentials: 'include'
                    }).then(async (refreshRes) => {
                        if (refreshRes.ok) {
                            const data = await refreshRes.json();
                            if (data.token) {
                                const payloadBase64 = data.token.split('.')[1];
                                const payloadJson = JSON.parse(atob(payloadBase64));
                                localStorage.setItem('sgdm_token_exp', payloadJson.exp);
                                console.log('[Auth] Renovação proativa concluída com sucesso.');
                            }
                        } else {
                            console.warn('[Auth] Renovação proativa falhou (Refresh Token inválido/expirado). O usuário será deslogado na próxima ação.');
                        }
                    }).catch(e => console.error("Erro na renovação proativa:", e));
                }
            }
        } catch (e) {
            console.error('Erro ao verificar expiração do token:', e);
        }
    }, 60000); // Checa a cada 60 segundos
}

/**
 * INTERCEPTADOR GLOBAL DE FETCH (Com Refresh Token Automático)
 * Injeta 'credentials: include' em todas as chamadas.
 * Monitora 401/403. Se ocorrer, tenta bater no endpoint /auth/refresh.
 * Se der certo, refaz a requisição original de forma transparente.
 */
let isRefreshing = false;
let refreshSubscribers = [];

function onRefreshed(success) {
    refreshSubscribers.forEach(cb => cb(success));
    refreshSubscribers = [];
}

const originalFetch = window.fetch;
window.fetch = async (...args) => {
    let [url, options] = args;
    options = options || {};
    options.credentials = 'include'; // Garante o envio do Cookie HttpOnly

    try {
        let response = await originalFetch(url, options);

        // Se o servidor retornar 401 ou 403 e NÃO for a tela de login nem a rota de auth
        if ((response.status === 401 || response.status === 403) 
            && !window.location.pathname.includes('login.html')
            && typeof url === 'string' 
            && !url.includes('/auth/login') 
            && !url.includes('/auth/refresh')) {
            
            if (!isRefreshing) {
                isRefreshing = true;
                try {
                    console.warn('[Auth] Acesso negado/expirado. Tentando renovação silenciosa de sessão...');
                    // Tenta renovar a sessão usando o refresh token
                    const apiUrl = typeof API_URL !== 'undefined' ? API_URL : '';
                    const refreshRes = await originalFetch(`${apiUrl}/auth/refresh`, {
                        method: 'POST',
                        credentials: 'include'
                    });
                    
                    if (refreshRes.ok) {
                        // Sucesso: atualiza a expiração local
                        const data = await refreshRes.json();
                        if (data.token) {
                            try {
                                const payloadBase64 = data.token.split('.')[1];
                                const payloadJson = JSON.parse(atob(payloadBase64));
                                localStorage.setItem('sgdm_token_exp', payloadJson.exp);
                            } catch (e) {}
                        }
                        
                        isRefreshing = false;
                        onRefreshed(true);
                        console.log('[Auth] Sessão renovada com sucesso!');
                        
                        // Refaz a chamada original com o novo cookie
                        return await originalFetch(url, options);
                    } else {
                        // Falha no refresh (token de refresh também expirou ou é inválido)
                        isRefreshing = false;
                        onRefreshed(false);
                        forceLogout();
                        return response;
                    }
                } catch (err) {
                    isRefreshing = false;
                    onRefreshed(false);
                    forceLogout();
                    return response;
                }
            } else {
                // Já está renovando em outra requisição simultânea. Aguarda terminar e tenta novamente.
                return new Promise(resolve => {
                    refreshSubscribers.push(async (success) => {
                        if (success) {
                            resolve(await originalFetch(url, options));
                        } else {
                            resolve(response);
                        }
                    });
                });
            }
        }

        return response;
    } catch (error) {
        if (error.message && (error.message.includes('Failed to fetch') || error.message.includes('fetch'))) {
            showOfflineOverlay();
        }
        throw error;
    }
};

function forceLogout() {
    console.warn('[Auth] Sessão permanentemente expirada. Redirecionando...');
    localStorage.removeItem('sgdm_userName');
    localStorage.removeItem('sgdm_employeeId');
    localStorage.removeItem('sgdm_userRole');
    localStorage.removeItem('sgdm_token_exp');
    localStorage.removeItem('sgdm_employeeRegistration');
    window.location.href = 'login.html?expired=true';
}

/**
 * Inicializa os componentes ao carregar a página.
 */
document.addEventListener('DOMContentLoaded', () => {
    // Verificar sessão centralizada
    const loggedEmployeeId = localStorage.getItem('sgdm_employeeId');
    const tokenExp = localStorage.getItem('sgdm_token_exp');
    
    if (!window.location.pathname.includes('login.html')) {
        if (!loggedEmployeeId || !tokenExp) {
            console.warn('[Auth] Sessão inválida no carregamento. Redirecionando para login.');
            window.location.href = 'login.html';
            return;
        }
    }

    injectOfflineOverlay();
    startHeartbeat(); // Inicia a vigilância contínua
    setupMobileMenu(); // Controle do menu mobile (sidebar)
});

/**
 * Retorna o role do usuário logado salvo no localStorage.
 * @returns {string|null}
 */
function getCurrentRole() {
    return localStorage.getItem('sgdm_userRole');
}

/**
 * Verifica se o usuário logado possui um role privilegiado.
 * @returns {boolean}
 */
function isPrivileged() {
    const role = getCurrentRole();
    return PRIVILEGED_ROLES.includes(role);
}

/**
 * Aplica as restrições de acesso na página com base no role do usuário.
 * Oculta os elementos cujos IDs forem passados no array `restrictedElementIds`.
 * Se o usuário não for privilegiado, os elementos são ocultados com display:none.
 *
 * @param {string[]} restrictedElementIds - Array de IDs de elementos a ocultar se não privilegiado
 * @param {Function|null} onRestricted - Callback opcional chamado se for role restrito
 */
function applyRoleRestrictions(restrictedElementIds = [], onRestricted = null) {
    if (isPrivileged()) {
        // Acesso total: não faz nada, tudo permanece visível
        return;
    }

    // Oculta cada elemento restrito
    restrictedElementIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.style.display = 'none';
        }
    });

    // Executa callback opcional (ex: redirecionar para aba padrão)
    if (typeof onRestricted === 'function') {
        onRestricted();
    }
}

/**
 * Exibe um aviso visual discreto informando que o acesso foi restrito.
 * Útil para informar ao usuário por que certas abas não aparecem.
 */
function showAccessBanner() {
    if (isPrivileged()) return;

    const role = getCurrentRole();
    const banner = document.createElement('div');
    banner.id = 'access-banner';
    banner.style.cssText = `
        background-color: #eff6ff;
        border-left: 4px solid #2563eb;
        color: #1e40af;
        font-size: 13px;
        font-weight: 500;
        padding: 10px 20px;
        display: flex;
        align-items: center;
        gap: 10px;
    `;
    banner.innerHTML = `
        <i class="fa-solid fa-shield-halved"></i>
        Algumas funcionalidades de cadastro, edição e exclusão estão disponíveis apenas para Gerentes e TI.
    `;

    // Insere o banner logo após o header (.top-header)
    const header = document.querySelector('.top-header');
    if (header && header.nextSibling) {
        header.parentNode.insertBefore(banner, header.nextSibling);
    }
}

/**
 * Retorna os headers padrão.
 * O envio do JWT agora é automático pelo navegador via Cookie (credentials: 'include').
 * @returns {Object}
 */
function getAuthHeaders() {
    return {
        'Content-Type': 'application/json'
    };
}

/**
 * Faz logout avisando o servidor (para invalidar o cookie) e limpando os dados da sessão.
 * @param {boolean} isExpired Se true, redireciona com mensagem de expiração
 */
async function logout(isExpired = false) {
    try {
        // Envia requisição para invalidar o cookie no back-end
        if (typeof API_URL !== 'undefined') {
            await fetch(`${API_URL}/auth/logout`, {
                method: 'POST',
                credentials: 'include'
            });
        }
    } catch (e) {
        console.error("Erro ao invalidar cookie no logout:", e);
    }

    localStorage.removeItem('sgdm_userName');
    localStorage.removeItem('sgdm_employeeId');
    localStorage.removeItem('sgdm_userRole');
    localStorage.removeItem('sgdm_token_exp');
    localStorage.removeItem('sgdm_employeeRegistration');
    
    if (isExpired) {
        window.location.href = 'login.html?expired=true';
    } else {
        window.location.href = 'login.html';
    }
}

// Exporta as funções para uso global nas páginas
window.getCurrentRole = getCurrentRole;
window.isPrivileged = isPrivileged;
window.applyRoleRestrictions = applyRoleRestrictions;
window.showAccessBanner = showAccessBanner;
window.getAuthHeaders = getAuthHeaders;
window.logout = logout;

/**
 * Exibe uma notificação Toast na tela.
 * @param {string} message Mensagem a ser exibida.
 * @param {string} type Tipo da notificação: 'success', 'error', 'info', 'warning' (padrão é 'success').
 */
window.showToast = function(message, type = 'success') {
    let toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        toastContainer.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 9999999;
            display: flex;
            flex-direction: column;
            gap: 10px;
        `;
        document.body.appendChild(toastContainer);
    }

    const toast = document.createElement('div');
    let bgColor = '#10b981'; // success (green)
    let icon = 'fa-check-circle';
    
    if (type === 'error') {
        bgColor = '#ef4444';
        icon = 'fa-circle-xmark';
    } else if (type === 'warning') {
        bgColor = '#f59e0b';
        icon = 'fa-triangle-exclamation';
    } else if (type === 'info') {
        bgColor = '#3b82f6';
        icon = 'fa-circle-info';
    }

    toast.style.cssText = `
        background-color: ${bgColor};
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
        display: flex;
        align-items: center;
        gap: 12px;
        font-family: 'Inter', sans-serif;
        font-size: 14px;
        font-weight: 500;
        animation: toast-slide-in 0.3s ease-out forwards;
        opacity: 0;
        transform: translateX(100%);
    `;

    if (!document.getElementById('toast-keyframes')) {
        const style = document.createElement('style');
        style.id = 'toast-keyframes';
        style.innerHTML = `
            @keyframes toast-slide-in {
                from { opacity: 0; transform: translateX(100%); }
                to { opacity: 1; transform: translateX(0); }
            }
            @keyframes toast-fade-out {
                from { opacity: 1; transform: translateX(0); }
                to { opacity: 0; transform: translateX(100%); }
            }
        `;
        document.head.appendChild(style);
    }

    const iconEl = document.createElement('i');
    iconEl.className = `fa-solid ${icon}`;
    
    const spanEl = document.createElement('span');
    spanEl.textContent = message;

    toast.appendChild(iconEl);
    toast.appendChild(spanEl);
    toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'toast-fade-out 0.3s ease-out forwards';
        setTimeout(() => {
            if (toastContainer.contains(toast)) {
                toastContainer.removeChild(toast);
            }
        }, 300);
    }, 4000);
};
