let authHeaderProvider = () => ({});
let onAuthFailure = () => {};

let isRefreshing = false;
let refreshSubscribers = [];

function onRefreshed(success) {
    refreshSubscribers.forEach(cb => cb(success));
    refreshSubscribers = [];
}

const DEFAULT_TIMEOUT_MS = 10000;

async function fetchInterceptor(resource, options = {}) {
    const { timeout = DEFAULT_TIMEOUT_MS } = options;
    const controller = new AbortController();
    const timerId = setTimeout(() => controller.abort(), timeout);

    const signal = options.signal || controller.signal;
    let url = typeof resource === 'string' ? resource : (resource && resource.url ? resource.url : String(resource));

    // Resoluções de URL base (apenas para chamadas de API, não para assets/views locais do frontend)
    const isLocalAsset = url.endsWith('.html') || url.startsWith('src/') || url.startsWith('./src/');
    if (!url.startsWith('http') && !isLocalAsset) {
        url = `${window.API_URL || 'http://localhost:8080/api'}${url}`;
    }


    // Configuração base (inclui credenciais de cookie)
    const config = {
        ...options,
        signal,
        credentials: 'include'
    };

    const defaultHeaders = window.getAuthHeaders ? window.getAuthHeaders() : authHeaderProvider();
    const headers = new Headers(defaultHeaders);

    if (options.headers) {
        const extraHeaders = new Headers(options.headers);
        for (const [key, value] of extraHeaders.entries()) {
            headers.set(key, value);
        }
    }

    if (config.body instanceof FormData) {
        headers.delete('Content-Type');
    } else if (!headers.has('Content-Type') && config.body && typeof config.body === 'string') {
        headers.set('Content-Type', 'application/json');
    }

    config.headers = headers;

    try {
        let response = await window.originalFetch(url, config);
        clearTimeout(timerId);

        // Interceptação de autenticação expirada (401/403)
        if ((response.status === 401 || response.status === 403)
            && !window.location.pathname.includes('login.html')
            && !url.includes('/auth/login')
            && !url.includes('/auth/refresh')) {

            if (!isRefreshing) {
                isRefreshing = true;
                try {
                    console.warn('[API Interceptor] Token expirado. Tentando renovação silenciosa...');
                    const apiUrl = window.API_URL || 'http://localhost:8080/api';
                    const refreshRes = await window.originalFetch(`${apiUrl}/auth/refresh`, {
                        method: 'POST',
                        credentials: 'include'
                    });

                    if (refreshRes.ok) {
                        const data = await refreshRes.json();
                        if (data.token) {
                            try {
                                const payloadBase64 = data.token.split('.')[1];
                                const payloadJson = JSON.parse(atob(payloadBase64));
                                sessionStorage.setItem('sgdm_token_exp', payloadJson.exp);
                            } catch (e) { }
                        }

                        isRefreshing = false;
                        onRefreshed(true);
                        console.log('[API Interceptor] Token renovado com sucesso.');

                        // Re-executa com cabeçalhos novos
                        return await window.originalFetch(url, config);
                    } else {
                        isRefreshing = false;
                        onRefreshed(false);
                        if (window.logout) window.logout(true);
                        return response;
                    }
                } catch (err) {
                    isRefreshing = false;
                    onRefreshed(false);
                    if (window.logout) window.logout(true);
                    return response;
                }
            } else {
                return new Promise(resolve => {
                    refreshSubscribers.push(async (success) => {
                        if (success) {
                            resolve(await window.originalFetch(url, config));
                        } else {
                            resolve(response);
                        }
                    });
                });
            }
        }

        if (window.hideOfflineOverlay) window.hideOfflineOverlay();
        return response;

    } catch (error) {
        clearTimeout(timerId);
        
        if (error.name === 'AbortError') {
            throw new Error('Tempo limite de conexão excedido. O servidor demorou muito para responder.');
        }
        
        if (error.message && (error.message.toLowerCase().includes('failed to fetch') || error.message.toLowerCase().includes('networkerror') || error.message.includes('fetch'))) {
            if (window.showOfflineOverlay) window.showOfflineOverlay();
            throw new Error('Não foi possível conectar ao servidor. Verifique sua conexão.');
        }

        throw error;
    }
}

// Injetar uma única vez como global
if (!window.originalFetch) {
    window.originalFetch = window.fetch;
    window.fetch = fetchInterceptor;
}

window.apiFetch = async function (path, options = {}) {
    return window.fetch(path, options);
};

function prepareBody(body, options) {
    const config = { ...options };
    if (body) {
        config.body = body instanceof FormData ? body : JSON.stringify(body);
    }
    return config;
}

window.apiClient = {
    configure(options = {}) {
        if (options.getAuthHeaders) authHeaderProvider = options.getAuthHeaders;
        if (options.handleTokenExpiration) onAuthFailure = options.handleTokenExpiration;
    },

    async request(endpoint, options = {}) {
        try {
            const response = await window.apiFetch(endpoint, options);

            if (response.status === 204) {
                return { response, data: null };
            }

            const contentType = response.headers.get("content-type");
            let data = null;

            if (contentType && contentType.includes("application/json")) {
                data = await response.json();
            } else if (contentType && contentType.includes("application/pdf")) {
                data = await response.blob();
            } else {
                data = await response.text();
            }

            if (!response.ok) {
                const errorObj = new Error(data?.message || data?.error || "Erro na requisição");
                errorObj.status = response.status;
                errorObj.data = data;
                throw errorObj;
            }

            return { response, data };
        } catch (error) {
            console.error(`[API Error] ${options.method || 'GET'} ${endpoint}:`, error);
            throw error;
        }
    },

    get(endpoint, options = {}) {
        return this.request(endpoint, { ...options, method: 'GET' });
    },

    post(endpoint, body, options = {}) {
        return this.request(endpoint, { ...prepareBody(body, options), method: 'POST' });
    },

    put(endpoint, body, options = {}) {
        return this.request(endpoint, { ...prepareBody(body, options), method: 'PUT' });
    },

    delete(endpoint, options = {}) {
        return this.request(endpoint, { ...options, method: 'DELETE' });
    }
};
