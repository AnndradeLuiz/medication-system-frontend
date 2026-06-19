const PRIVILEGED_ROLES = ['ADM_TI', 'ENF_GERENTE'];
let heartbeatInterval = null;

const STORAGE_KEYS = {
    USER_NAME: 'sgdm_userName',
    PRACTITIONER_ID: 'sgdm_practitionerId',
    USER_ROLE: 'sgdm_userRole',
    TOKEN_EXP: 'sgdm_token_exp',
    REGISTRATION: 'sgdm_practitionerRegistration'
};
Object.freeze(STORAGE_KEYS);

function startHeartbeat() {
    if (heartbeatInterval) clearInterval(heartbeatInterval);

    heartbeatInterval = setInterval(() => {
        const expStr = sessionStorage.getItem(STORAGE_KEYS.TOKEN_EXP);
        if (!expStr) return;

        try {
            const exp = parseInt(expStr, 10);
            const currentTimestamp = Math.floor(Date.now() / 1000);

            if (exp && (exp - currentTimestamp) < 120) {
                console.warn('[Auth] Access Token prestes a expirar. Tentando renovação proativa...');

                const apiUrl = typeof API_URL !== 'undefined' ? API_URL : '';
                fetch(`${apiUrl}/auth/refresh`, {
                    method: 'POST'
                }).then(async (refreshRes) => {
                    if (refreshRes.ok) {
                        const data = await refreshRes.json();
                        if (data.token) {
                            const payloadBase64 = data.token.split('.')[1];
                            const payloadJson = JSON.parse(atob(payloadBase64));
                            sessionStorage.setItem(STORAGE_KEYS.TOKEN_EXP, payloadJson.exp);
                            console.log('[Auth] Renovação proativa concluída com sucesso.');
                        }
                    } else {
                        console.warn('[Auth] Renovação proativa falhou (Refresh Token inválido/expirado). O usuário será deslogado na próxima ação.');
                    }
                }).catch(e => console.error("Erro na renovação proativa:", e));
            }
        } catch (e) {
            console.error('Erro ao verificar expiração do token:', e);
        }
    }, 60000);
}

function forceLogout() {
    console.warn('[Auth] Sessão permanentemente expirada. Redirecionando...');
    sessionStorage.removeItem(STORAGE_KEYS.USER_NAME);
    sessionStorage.removeItem(STORAGE_KEYS.PRACTITIONER_ID);
    sessionStorage.removeItem(STORAGE_KEYS.USER_ROLE);
    sessionStorage.removeItem(STORAGE_KEYS.TOKEN_EXP);
    sessionStorage.removeItem(STORAGE_KEYS.REGISTRATION);
    window.location.href = 'login.html?expired=true';
}

document.addEventListener('DOMContentLoaded', () => {
    const loggedpractitionerId = sessionStorage.getItem(STORAGE_KEYS.PRACTITIONER_ID);
    const tokenExp = sessionStorage.getItem(STORAGE_KEYS.TOKEN_EXP);
    const currentTimestamp = Math.floor(Date.now() / 1000);

    if (!window.location.pathname.includes('login.html')) {
        if (!loggedpractitionerId || !tokenExp || parseInt(tokenExp, 10) < currentTimestamp) {
            console.warn('[Auth] Sessão inválida ou expirada no carregamento. Redirecionando silenciosamente para login.');
            sessionStorage.removeItem(STORAGE_KEYS.USER_NAME);
            sessionStorage.removeItem(STORAGE_KEYS.PRACTITIONER_ID);
            sessionStorage.removeItem(STORAGE_KEYS.USER_ROLE);
            sessionStorage.removeItem(STORAGE_KEYS.TOKEN_EXP);
            sessionStorage.removeItem(STORAGE_KEYS.REGISTRATION);
            window.location.href = 'login.html';
            return;
        }
    }

    startHeartbeat();
});

/**
 * @returns {string|null}
 */
function getCurrentRole() {
    return sessionStorage.getItem(STORAGE_KEYS.USER_ROLE);
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

    const banner = document.createElement('div');
    banner.id = 'access-banner';
    banner.className = 'access-banner';
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
                method: 'POST'
            });
        }
    } catch (e) {
        console.error("Erro ao invalidar cookie no logout:", e);
    }

    sessionStorage.removeItem(STORAGE_KEYS.USER_NAME);
    sessionStorage.removeItem(STORAGE_KEYS.PRACTITIONER_ID);
    sessionStorage.removeItem(STORAGE_KEYS.USER_ROLE);
    sessionStorage.removeItem(STORAGE_KEYS.TOKEN_EXP);
    sessionStorage.removeItem(STORAGE_KEYS.REGISTRATION);

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
window.STORAGE_KEYS = STORAGE_KEYS;
