const API_URL = window.ENV_API_URL ||
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? `http://${window.location.hostname}:8080`
        : window.location.origin);


const ROLE_LABELS = {
    ADM_TI: 'Administrador TI',
    ENF_GERENTE: 'Enf. Gerente',
    ENF: 'Enfermeiro(a)',
    TRIAGEM: 'Triagem',
    TEC_ENFERMAGEM: 'Téc. Enfermagem',
    FARMACEUTICO: 'Farmacêutico',
    ADMINISTRATIVO: 'Administrativo',
    SISTEMA: 'Sistema',
    ACS: 'ACS'
};

const PROGRAM_LABELS = {
    DIABETES: 'Diabetes',
    HIPERTENSAO: 'Hipertensão',
    FARMACIA_BASICA: 'Farmácia Básica',
    SAUDE_DA_MULHER: 'Saúde da Mulher',
    SAUDE_MENTAL: 'Saúde Mental',
    // Fallbacks para compatibilidade
    HYPERTENSION: 'Hipertensão',
    BASIC_PHARMACY: 'Farmácia Básica',
    WOMENS_HEALTH: 'Saúde da Mulher',
    MENTAL_HEALTH: 'Saúde Mental'
};

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


async function fetchWithTimeout(resource, options = {}) {
    const { timeout = 10000 } = options;

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

if (!window.originalFetch) {
    window.originalFetch = window.fetch;
    window.fetch = fetchWithTimeout;
}

window.API_URL = API_URL;
window.escapeHTML = escapeHTML;
window.fetchWithTimeout = fetchWithTimeout;
window.ROLE_LABELS = ROLE_LABELS;
window.PROGRAM_LABELS = PROGRAM_LABELS;



