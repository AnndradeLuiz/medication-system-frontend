async function initComponents() {
    try {
        highlightActiveLink();

        const loggedpractitionerName = sessionStorage.getItem('sgdm_userName');
        const loggedUserEl = document.getElementById('loggedUser');
        if (loggedUserEl && loggedpractitionerName) {
            loggedUserEl.innerText = loggedpractitionerName;
        }

        const statusEl = document.querySelector('.user-status');
        const practitionerRoleRaw = sessionStorage.getItem('sgdm_userRole');
        if (statusEl) {
            let displayRole = 'Funcionário';
            if (practitionerRoleRaw && practitionerRoleRaw !== 'undefined') {
                const roleMap = window.ROLE_LABELS || {};
                displayRole = roleMap[practitionerRoleRaw.toUpperCase()] ||
                    practitionerRoleRaw.charAt(0).toUpperCase() + practitionerRoleRaw.slice(1).toLowerCase();
            }
            statusEl.innerText = displayRole;
        }

        if (typeof setupMobileMenu === 'function') {
            setupMobileMenu();
        }
        if (!window.navigateTo) {
            console.log("[Components] Carregando o roteador SPA dinamicamente...");
            const routerScript = document.createElement('script');
            routerScript.src = 'src/components/router.js';
            routerScript.onload = () => {
                if (typeof initSpaRouter === 'function') {
                    initSpaRouter();
                }
                document.body.classList.add('ready');
            };
            routerScript.onerror = () => {
                console.error("[Components] Falha ao carregar js/router.js");
                document.body.classList.add('ready');
            };
            document.body.appendChild(routerScript);
        } else {
            document.body.classList.add('ready');
        }

    } catch (error) {
        console.error("Erro ao carregar componentes:", error);
        document.body.classList.add('ready');
    }
}

function highlightActiveLink() {
    const currentPath = window.location.pathname.split('/').pop() || 'home.html';
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

document.addEventListener('DOMContentLoaded', initComponents);

function setButtonLoading(buttonId, isLoading, originalHtml = '') {
    const btn = document.getElementById(buttonId);
    if (!btn) return;

    if (isLoading) {
        if (!originalHtml) btn.dataset.originalHtml = btn.innerHTML;
        btn.classList.add('btn-loading');
        btn.disabled = true;
    } else {
        btn.classList.remove('btn-loading');
        btn.disabled = false;

        if (originalHtml) {
            btn.innerHTML = originalHtml;
        } else if (btn.dataset.originalHtml) {
            btn.innerHTML = btn.dataset.originalHtml;
        }
    }
}

function setGlobalLoading(isLoading) {
    if (isLoading) {
        showGlobalLoader();
    } else {
        hideGlobalLoader();
    }
}

function setLoading(buttonId, isLoading, originalHtml = '') {
    if (typeof buttonId === 'boolean') {
        setGlobalLoading(buttonId);
    } else {
        setButtonLoading(buttonId, isLoading, originalHtml);
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


// Temporizador de fallback de segurança para garantir que a página fique visível caso o roteador ou outro script falhe
setTimeout(() => {
    document.body.classList.add('ready');
}, 500);

window.setLoading = setLoading;
window.setButtonLoading = setButtonLoading;
window.setGlobalLoading = setGlobalLoading;
window.showGlobalLoader = showGlobalLoader;
window.hideGlobalLoader = hideGlobalLoader;



function initCustomScrollbars() {
    document.querySelectorAll('.table-responsive').forEach(container => {
        if (container.parentElement?.classList.contains('table-scroll-wrapper')) return;

        const wrapper = document.createElement('div');
        wrapper.className = 'table-scroll-wrapper';

        const styleAttr = container.getAttribute('style') || '';
        if (container.style.flex || container.style.flexGrow || styleAttr.includes('flex')) {
            wrapper.style.flex = container.style.flex || '1';
            wrapper.style.minHeight = container.style.minHeight || '0';
            wrapper.style.display = 'flex';
            wrapper.style.flexDirection = 'column';

            container.style.height = '100%';
            container.style.flex = '1';
            container.style.minHeight = '0';
        }

        container.parentNode.insertBefore(wrapper, container);
        wrapper.appendChild(container);

        const scrollbar = document.createElement('div');
        scrollbar.className = 'table-custom-scrollbar';
        const thumb = document.createElement('div');
        thumb.className = 'table-custom-scrollbar-thumb';
        scrollbar.appendChild(thumb);
        wrapper.appendChild(scrollbar);
        function updateThumb() {
            const ratio = container.clientHeight / container.scrollHeight;
            if (ratio >= 1) {
                scrollbar.style.display = 'none';
                return;
            }
            scrollbar.style.display = '';

            const trackHeight = scrollbar.clientHeight;
            const thumbHeight = Math.max(ratio * trackHeight, 24);
            thumb.style.height = thumbHeight + 'px';

            const scrollRatio = container.scrollTop / (container.scrollHeight - container.clientHeight);
            const maxTop = trackHeight - thumbHeight;
            thumb.style.top = (scrollRatio * maxTop) + 'px';
        }

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

        let dragging = false;
        let startOffset = 0;

        thumb.addEventListener('mousedown', e => {
            dragging = true;
            startOffset = e.clientY - thumb.getBoundingClientRect().top;
            thumb.classList.add('dragging');
            e.preventDefault();
            e.stopPropagation();
        });

        document.addEventListener('mousemove', e => {
            if (!dragging) return;

            const trackRect = scrollbar.getBoundingClientRect();
            let newTop = e.clientY - trackRect.top - startOffset;

            const maxTop = trackRect.height - thumb.offsetHeight;
            newTop = Math.max(0, Math.min(newTop, maxTop));

            const scrollPercent = maxTop > 0 ? (newTop / maxTop) : 0;

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

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(initCustomScrollbars, 500);
});

window.initCustomScrollbars = initCustomScrollbars;

// ================= LAYOUT E NOTIFICAÇÕES GLOBAIS =================

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

window.setupMobileMenu = function () {
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
};

window.injectOfflineOverlay = function () {
    if (document.getElementById('server-offline-overlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'server-offline-overlay';

    overlay.innerHTML = `
        <div class="offline-card">
            <div class="offline-icon">
                <i class="fa-solid fa-circle-exclamation"></i>
            </div>
            <p class="offline-title">Erro ao comunicar-se com o servidor.</p>
            <div class="offline-status">
                <i class="fa-solid fa-circle-notch fa-spin"></i>
                <span>Tentando reconectar...</span>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);
};

window.showOfflineOverlay = function () {
    const overlay = document.getElementById('server-offline-overlay');
    if (overlay) overlay.style.display = 'flex';
};

window.hideOfflineOverlay = function () {
    const overlay = document.getElementById('server-offline-overlay');
    if (overlay) overlay.style.display = 'none';
};

window.showToast = function (message, type = 'success') {
    let toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        document.body.appendChild(toastContainer);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let icon = 'fa-check-circle';
    if (type === 'error') {
        icon = 'fa-circle-xmark';
    } else if (type === 'warning') {
        icon = 'fa-triangle-exclamation';
    } else if (type === 'info') {
        icon = 'fa-circle-info';
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

document.addEventListener('DOMContentLoaded', () => {
    window.injectOfflineOverlay();
    window.setupMobileMenu();
});


