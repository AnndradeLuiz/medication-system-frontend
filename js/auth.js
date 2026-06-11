const PRIVILEGED_ROLES = ['ADM_TI', 'ENF_GERENTE'];
let isServerOffline = false;
let reconnectionInterval = null;
let heartbeatInterval = null;

window.toggleSidebar = function () {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    if (sidebar) {
        sidebar.classList.toggle('open');
    }
    if (overlay) {
        overlay.classList.toggle('active');
    }
};

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

function showOfflineOverlay() {
    if (isServerOffline) return;
    isServerOffline = true;

    const overlay = document.getElementById('server-offline-overlay');
    if (overlay) overlay.style.display = 'flex';
}

function startHeartbeat() {
    if (heartbeatInterval) clearInterval(heartbeatInterval);

    heartbeatInterval = setInterval(() => {
        const expStr = localStorage.getItem('sgdm_token_exp');
        if (!expStr) return;

        try {
            const exp = parseInt(expStr, 10);
            const currentTimestamp = Math.floor(Date.now() / 1000);

            if (exp && (exp - currentTimestamp) < 120) {
                console.warn('[Auth] Access Token prestes a expirar. Tentando renovação proativa...');

                if (!isRefreshing) {
                    const apiUrl = typeof API_URL !== 'undefined' ? API_URL : '';
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
    }, 60000);
}

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
    options.credentials = 'include';

    try {
        let response = await originalFetch(url, options);

        const urlStr = typeof url === 'string' ? url : (url && url.url ? url.url : String(url));

        if ((response.status === 401 || response.status === 403)
            && !window.location.pathname.includes('login.html')
            && !urlStr.includes('/auth/login')
            && !urlStr.includes('/auth/refresh')) {

            if (!isRefreshing) {
                isRefreshing = true;
                try {
                    console.warn('[Auth] Acesso negado/expirado. Tentando renovação silenciosa de sessão...');
                    const apiUrl = typeof API_URL !== 'undefined' ? API_URL : '';
                    const refreshRes = await originalFetch(`${apiUrl}/auth/refresh`, {
                        method: 'POST',
                        credentials: 'include'
                    });

                    if (refreshRes.ok) {
                        const data = await refreshRes.json();
                        if (data.token) {
                            try {
                                const payloadBase64 = data.token.split('.')[1];
                                const payloadJson = JSON.parse(atob(payloadBase64));
                                localStorage.setItem('sgdm_token_exp', payloadJson.exp);
                            } catch (e) { }
                        }

                        isRefreshing = false;
                        onRefreshed(true);
                        console.log('[Auth] Sessão renovada com sucesso!');

                        return await originalFetch(url, options);
                    } else {
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
    localStorage.removeItem('sgdm_practitionerId');
    localStorage.removeItem('sgdm_userRole');
    localStorage.removeItem('sgdm_token_exp');
    localStorage.removeItem('sgdm_practitionerRegistration');
    window.location.href = 'login.html?expired=true';
}

document.addEventListener('DOMContentLoaded', () => {
    const loggedpractitionerId = localStorage.getItem('sgdm_practitionerId');
    const tokenExp = localStorage.getItem('sgdm_token_exp');

    if (!window.location.pathname.includes('login.html')) {
        if (!loggedpractitionerId || !tokenExp) {
            console.warn('[Auth] Sessão inválida no carregamento. Redirecionando para login.');
            window.location.href = 'login.html';
            return;
        }
    }

    injectOfflineOverlay();
    startHeartbeat();
    setupMobileMenu();
});

/**
 * @returns {string|null}
 */
function getCurrentRole() {
    return localStorage.getItem('sgdm_userRole');
}

/**
 * @returns {boolean}
 */
function isPrivileged() {
    const role = getCurrentRole();
    return PRIVILEGED_ROLES.includes(role);
}

/**
 * @param {string[]} restrictedElementIds
 * @param {Function|null} onRestricted
 */
function applyRoleRestrictions(restrictedElementIds = [], onRestricted = null) {
    if (isPrivileged()) {
        return;
    }

    // Oculta cada elemento restrito
    restrictedElementIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.style.display = 'none';
        }
    });

    if (typeof onRestricted === 'function') {
        onRestricted();
    }
}

/**
 * @deprecated
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

    const header = document.querySelector('.top-header');
    if (header && header.nextSibling) {
        header.parentNode.insertBefore(banner, header.nextSibling);
    }
}

/**
 * @returns {Object}
 */
function getAuthHeaders() {
    return {
        'Content-Type': 'application/json'
    };
}

/**
 * @param {boolean} isExpired
 */
async function logout(isExpired = false) {
    try {
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
    localStorage.removeItem('sgdm_practitionerId');
    localStorage.removeItem('sgdm_userRole');
    localStorage.removeItem('sgdm_token_exp');
    localStorage.removeItem('sgdm_practitionerRegistration');

    if (isExpired) {
        window.location.href = 'login.html?expired=true';
    } else {
        window.location.href = 'login.html';
    }
}

window.getCurrentRole = getCurrentRole;
window.isPrivileged = isPrivileged;
window.applyRoleRestrictions = applyRoleRestrictions;
window.showAccessBanner = showAccessBanner;
window.getAuthHeaders = getAuthHeaders;
window.logout = logout;

/**
 * @param {string} message
 * @param {string} type
 */
window.showToast = function (message, type = 'success') {
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
    let bgColor = '#10b981';
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

