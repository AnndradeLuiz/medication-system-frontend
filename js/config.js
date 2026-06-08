/**
 * config.js — Configurações centralizadas do SGDMI
 * Este arquivo deve ser carregado ANTES de todos os outros scripts.
 */
const API_URL = `http://${window.location.hostname}:8080`;
//const API_URL = `https://medication-system-wlmx.onrender.com`;
/**
 * Função utilitária para prevenir XSS (Cross-Site Scripting)
 * Transforma caracteres especiais em entidades HTML.
 */
function escapeHTML(str) {
    if (str === null || str === undefined || str === '') return '';
    return String(str).replace(/[&<>'"`=\/]/g,
        tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;',
            '`': '&#x60;',
            '=': '&#x3D;',
            '/': '&#x2F;'
        }[tag] || tag)
    );
}

/**
 * Realiza uma requisição HTTP fetch com suporte a timeout automático usando AbortController
 * e tratamento amigável de erros de rede.
 */
async function fetchWithTimeout(resource, options = {}) {
    const { timeout = 10000 } = options; // Limite padrão de 10 segundos (10000ms)

    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);

    const signal = options.signal || controller.signal;

    try {
        const response = await window.originalFetch(resource, {
            ...options,
            signal: signal
        });
        clearTimeout(id);
        return response;
    } catch (error) {
        clearTimeout(id);
        if (error.name === 'AbortError') {
            throw new Error('Tempo limite de conexão excedido. O servidor demorou muito para responder.');
        }
        if (error.message && (error.message.toLowerCase().includes('failed to fetch') || error.message.toLowerCase().includes('networkerror'))) {
            throw new Error('Não foi possível conectar ao servidor. Verifique sua conexão com a internet ou se o servidor está online.');
        }
        throw error;
    }
}

// Salva a referência original do fetch e aplica o monkey patch para interceptação global
if (!window.originalFetch) {
    window.originalFetch = window.fetch;
    window.fetch = fetchWithTimeout;
}

// Exportações globais para compatibilidade com ES Modules (type="module")
window.API_URL = API_URL;
window.escapeHTML = escapeHTML;
window.fetchWithTimeout = fetchWithTimeout;



