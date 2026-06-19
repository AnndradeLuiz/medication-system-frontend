/**
 * formatters.js - Funções utilitárias globais de formatação e validação
 */

window.formatCpfString = function (value) {
    if (!value) return '';
    value = String(value).replace(/\D/g, "");
    if (value.length > 11) value = value.slice(0, 11);

    value = value.replace(/(\d{3})(\d)/, "$1.$2");
    value = value.replace(/(\d{3})(\d)/, "$1.$2");
    value = value.replace(/(\d{3})(\d{1,2})$/, "$1-$2");
    return value;
};

window.applyCpfMask = function (valOrEvent) {
    if (typeof valOrEvent === 'object' && valOrEvent && valOrEvent.target) {
        valOrEvent.target.value = window.formatCpfString(valOrEvent.target.value);
        return valOrEvent.target.value;
    }
    return window.formatCpfString(valOrEvent);
};


window.formatCPF = function (cpf) {
    if (!cpf) return '-';
    let value = cpf.replace(/\D/g, "");
    if (value.length !== 11) return cpf;
    return value.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
};

window.isValidCPF = function (cpf) {
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

window.escapeHTML = function (str) {
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
};

window.validateFullName = function (name) {
    if (!name) return { valid: false, message: "O nome é obrigatório." };

    let formattedName = String(name).replace(/\s+/g, ' ').trim();
    const regexName = /^(?=.{3,}$)(?!.* {2})(?!^[a-zà-öø-ÿ'] [a-zà-öø-ÿ'](?: |$))(?!^[a-zà-öø-ÿ']{2} [a-zà-öø-ÿ']{2}$)^[a-zà-öø-ÿ']+(?: (?:[a-zà-öø-ÿ']{2,}|e|y))+$/i;

    if (!regexName.test(formattedName)) {
        return {
            valid: false,
            message: "O nome informado não atende aos padrões. Verifique letras soltas, termos muito curtos ou caracteres inválidos."
        };
    }

    return { valid: true, formattedName: formattedName };
};


