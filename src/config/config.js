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

window.API_URL = API_URL;
window.fetchWithTimeout = window.fetch;
window.ROLE_LABELS = ROLE_LABELS;
window.PROGRAM_LABELS = PROGRAM_LABELS;



