/**
 * components.js — Carregamento dinâmico de componentes (Sidebar e Header)
 * Tarefa 5: Componentização de Partials
 */

async function initComponents() {
    try {
        // A sidebar e o header agora são carregados diretamente na estrutura SPA do app.html
        // Apenas mantemos o destaque de link ativo.
        highlightActiveLink();

        // Restaurar nome do usuário logado e cargo (funciona para layouts estáticos e dinâmicos)
        const loggedpractitionerName = localStorage.getItem('sgdm_userName');
        const loggedUserEl = document.getElementById('loggedUser');
        if (loggedUserEl && loggedpractitionerName) {
            loggedUserEl.innerText = loggedpractitionerName;
        }

        const statusEl = document.querySelector('.user-status');
        const practitionerRoleRaw = localStorage.getItem('sgdm_userRole');
        if (statusEl) {
            let displayRole = 'Funcionário';
            if (practitionerRoleRaw && practitionerRoleRaw !== 'undefined') {
                const roleMap = window.ROLE_LABELS || {
                    'ADM_TI': 'Administrador de TI',
                    'ENF_GERENTE': 'Enfermeiro(a) Gerente',
                    'ENF': 'Enfermeiro(a)',
                    'TRIAGEM': 'Triagem',
                    'TEC_ENFERMAGEM': 'Técnico(a) de Enfermagem',
                    'FARMACEUTICO': 'Farmacêutico',
                    'ADMINISTRATIVO': 'Administrativo'
                };
                displayRole = roleMap[practitionerRoleRaw.toUpperCase()] ||
                    practitionerRoleRaw.charAt(0).toUpperCase() + practitionerRoleRaw.slice(1).toLowerCase();
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

function showGlobalLoader() {
    const loader = document.getElementById('globalLoader');
    if (loader) loader.classList.remove('d-none');
}


function hideGlobalLoader() {
    const loader = document.getElementById('globalLoader');
    if (loader) loader.classList.add('d-none');
}

setTimeout(() => {
    document.body.classList.add('ready');
}, 200);


window.applyCpfMask = function (valOrEvent) {
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

// Exportar funções de loading globais para o objeto window
window.setLoading = setLoading;
window.showGlobalLoader = showGlobalLoader;
window.hideGlobalLoader = hideGlobalLoader;

/**
 * Scrollbar customizado flutuante para .table-responsive
 * Cria um thumb que flutua sobre a tabela (sem calha/gutter)
 * Efeito idêntico ao da sidebar: aparece no hover, some ao sair
 */
function initCustomScrollbars() {
    document.querySelectorAll('.table-responsive').forEach(container => {
        // Pular se já foi inicializado
        if (container.parentElement?.classList.contains('table-scroll-wrapper')) return;

        // Criar wrapper
        const wrapper = document.createElement('div');
        wrapper.className = 'table-scroll-wrapper';

        // Se o container original usa flex no style, transfere a flexibilidade para o wrapper
        const styleAttr = container.getAttribute('style') || '';
        if (container.style.flex || container.style.flexGrow || styleAttr.includes('flex')) {
            wrapper.style.flex = container.style.flex || '1';
            wrapper.style.minHeight = container.style.minHeight || '0';
            wrapper.style.display = 'flex';
            wrapper.style.flexDirection = 'column';

            // Ajustar o container interno para ocupar o espaço do wrapper flexível
            container.style.height = '100%';
            container.style.flex = '1';
            container.style.minHeight = '0';
        }

        container.parentNode.insertBefore(wrapper, container);
        wrapper.appendChild(container);

        // Criar elementos do scrollbar
        const scrollbar = document.createElement('div');
        scrollbar.className = 'table-custom-scrollbar';
        const thumb = document.createElement('div');
        thumb.className = 'table-custom-scrollbar-thumb';
        scrollbar.appendChild(thumb);
        wrapper.appendChild(scrollbar);

        // Atualizar tamanho e posição do thumb
        function updateThumb() {
            const ratio = container.clientHeight / container.scrollHeight;
            // Se o conteúdo cabe, esconder scrollbar
            if (ratio >= 1) {
                scrollbar.style.display = 'none';
                return;
            }
            scrollbar.style.display = '';

            // Usar altura real do track (com offsets top/bottom)
            const trackHeight = scrollbar.clientHeight;
            const thumbHeight = Math.max(ratio * trackHeight, 24);
            thumb.style.height = thumbHeight + 'px';

            const scrollRatio = container.scrollTop / (container.scrollHeight - container.clientHeight);
            const maxTop = trackHeight - thumbHeight;
            thumb.style.top = (scrollRatio * maxTop) + 'px';
        }

        // Listeners de scroll e resize
        container.addEventListener('scroll', updateThumb);
        if (typeof ResizeObserver !== 'undefined') {
            const observer = new ResizeObserver(updateThumb);
            observer.observe(container);
            const table = container.querySelector('table');
            if (table) {
                observer.observe(table);
            }
        }
        updateThumb();

        // Suporte robusto a arrastar (drag) o thumb baseado em posicionamento absoluto
        let dragging = false;
        let startOffset = 0; // Distância do clique em relação ao topo do thumb

        thumb.addEventListener('mousedown', e => {
            dragging = true;
            // Calcula onde o usuário clicou dentro do próprio thumb
            startOffset = e.clientY - thumb.getBoundingClientRect().top;
            thumb.classList.add('dragging');
            e.preventDefault();
            e.stopPropagation();
        });

        document.addEventListener('mousemove', e => {
            if (!dragging) return;

            const trackRect = scrollbar.getBoundingClientRect();
            // Posição ideal do topo do thumb em relação ao track
            let newTop = e.clientY - trackRect.top - startOffset;

            // Limites de movimento do thumb
            const maxTop = trackRect.height - thumb.offsetHeight;
            newTop = Math.max(0, Math.min(newTop, maxTop));

            // Calcula o percentual exato de rolagem (de 0 a 1)
            const scrollPercent = maxTop > 0 ? (newTop / maxTop) : 0;

            // Define o scrollTop do container baseado no percentual
            container.scrollTop = scrollPercent * (container.scrollHeight - container.clientHeight);
        });

        document.addEventListener('mouseup', () => {
            if (dragging) {
                dragging = false;
                thumb.classList.remove('dragging');
            }
        });
    });
}

// Inicializar scrollbars quando DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
    // Aguardar um pouco para que as tabelas dinâmicas sejam renderizadas
    setTimeout(initCustomScrollbars, 500);
});

// Exportar para uso em tabelas criadas dinamicamente
window.initCustomScrollbars = initCustomScrollbars;

