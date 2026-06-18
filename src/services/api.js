window.apiFetch = async function (path, options = {}) {
    const url = path.startsWith('http') ? path : `${window.API_URL || 'http://localhost:8080/api'}${path}`;

    const defaultHeaders = window.getAuthHeaders ? window.getAuthHeaders() : {};
    const headers = new Headers(defaultHeaders);

    if (options.headers) {
        const extraHeaders = new Headers(options.headers);
        for (const [key, value] of extraHeaders.entries()) {
            headers.set(key, value);
        }
    }

    if (options.body instanceof FormData) {
        headers.delete('Content-Type');
    } else if (!headers.has('Content-Type') && options.body && typeof options.body === 'string') {
        headers.set('Content-Type', 'application/json');
    }

    const config = {
        ...options,
        headers
    };

    const response = await fetch(url, config);

    if (response.status === 401) {
        if (window.handleTokenExpiration) {
            window.handleTokenExpiration();
        }
    }

    return response;
};

window.apiClient = {
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
        const config = { ...options, method: 'POST' };
        if (body) {
            config.body = body instanceof FormData ? body : JSON.stringify(body);
        }
        return this.request(endpoint, config);
    },

    put(endpoint, body, options = {}) {
        const config = { ...options, method: 'PUT' };
        if (body) {
            config.body = body instanceof FormData ? body : JSON.stringify(body);
        }
        return this.request(endpoint, config);
    },

    delete(endpoint, options = {}) {
        return this.request(endpoint, { ...options, method: 'DELETE' });
    }
};
