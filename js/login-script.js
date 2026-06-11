// Limpa qualquer "resto" de sessão antiga ao carregar a tela de login
localStorage.clear();

// Verifica se veio redirecionado por sessão expirada
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get('expired') === 'true') {
    const errorEl = document.getElementById('errorMessage');
    if (errorEl) {
        errorEl.innerText = 'Sua sessão expirou por inatividade ou acesso inválido. Por favor, entre novamente.';
        errorEl.classList.remove('d-none');
        errorEl.style.display = 'block';
    }
}

const loginInput = document.getElementById('loginDocument');
const passwordInput = document.getElementById('password');
const loginForm = document.getElementById('loginForm');
const errorMessage = document.getElementById('errorMessage');

loginInput.addEventListener('input', function (e) {
    let value = e.target.value;

    const hasLetters = /[a-zA-Z]/.test(value);

    if (!hasLetters) {
        value = value.replace(/\D/g, '');

        if (value.length > 11) {
            value = value.slice(0, 11);
        }

        if (value.length > 9) {
            value = value.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
        } else if (value.length > 6) {
            value = value.replace(/(\d{3})(\d{3})(\d{1,3})/, "$1.$2.$3");
        } else if (value.length > 3) {
            value = value.replace(/(\d{3})(\d{1,3})/, "$1.$2");
        }
    } else {
        value = value.toUpperCase();
    }
    e.target.value = value;
});

loginForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    errorMessage.style.display = 'none';
    errorMessage.classList.add('d-none');

    let rawLogin = loginInput.value;
    const password = passwordInput.value;

    const hasLetters = /[a-zA-Z]/.test(rawLogin);
    if (!hasLetters) {
        rawLogin = rawLogin.replace(/\D/g, '');
    }

    const payload = {
        login: rawLogin,
        password: password
    };

    try {
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include', // Obrigatório para o navegador aceitar e salvar o Cookie
            body: JSON.stringify(payload)
        });

        console.log('[Login] Status:', response.status);
        const data = await response.json();
        console.log('[Login] Resposta do Servidor:', data);

        if (response.ok) {
            // VERIFICAÇÃO DE STATUS ATIVO
            if (data.status === false) {
                errorMessage.innerText = 'Acesso negado. Este usuário está desativado.';
                errorMessage.classList.remove('d-none');
                errorMessage.style.display = 'block';
                return;
            }

            localStorage.setItem('sgdm_userName', data.name || 'Usuário');
            localStorage.setItem('sgdm_practitionerId', data.id);

            const role = data.role || data.practitionerRoleEnum || data.position || data.cargo || 'undefined';
            localStorage.setItem('sgdm_userRole', role);

            console.log('[Login] Role Salvo no LocalStorage:', role);

            if (data.registration) {
                localStorage.setItem('sgdm_practitionerRegistration', data.registration);
            }
            // O Token JWT agora vem no Cookie HttpOnly (segurança contra XSS)
            // Lemos o token da resposta apenas para extrair a data de expiração e salvar no localStorage
            if (data.token) {
                try {
                    const payloadBase64 = data.token.split('.')[1];
                    const payloadJson = JSON.parse(atob(payloadBase64));
                    localStorage.setItem('sgdm_token_exp', payloadJson.exp);
                } catch (e) {
                    console.error("Erro ao decodificar expiração do token:", e);
                }
                console.log('[Auth] Sessão autenticada. Token recebido via Cookie.');
            }

            window.location.href = 'app.html';
        } else if (response.status === 429) {
            // Rate Limiting — muitas tentativas de login
            errorMessage.innerText = data.message || 'Muitas tentativas de login. Aguarde alguns minutos antes de tentar novamente.';
            errorMessage.classList.remove('d-none');
            errorMessage.style.display = 'block';
            // Desabilita o botão pelo tempo do bloqueio (2 min)
            const submitBtn = loginForm.querySelector('button[type="submit"]');
            if (submitBtn) {
                submitBtn.disabled = true;
                let countdown = 120; // 2 minutos em segundos
                submitBtn.innerText = `Bloqueado (${Math.floor(countdown / 60)}:${String(countdown % 60).padStart(2, '0')})`;
                const timer = setInterval(() => {
                    countdown--;
                    if (countdown <= 0) {
                        clearInterval(timer);
                        submitBtn.disabled = false;
                        submitBtn.innerText = 'Entrar no Sistema';
                    } else {
                        submitBtn.innerText = `Bloqueado (${Math.floor(countdown / 60)}:${String(countdown % 60).padStart(2, '0')})`;
                    }
                }, 1000);
            }
        } else {
            // Verifica se o servidor enviou aviso de tentativas restantes
            const remaining = response.headers.get('X-RateLimit-Remaining');
            
            if (remaining !== null && parseInt(remaining) >= 0) {
                const r = parseInt(remaining);
                if (r === 0) {
                    errorMessage.innerText = '⚠️ Última tentativa! Na próxima vez você será bloqueado temporariamente.';
                } else {
                    errorMessage.innerText = `Usuário ou senha inválidos. Você ainda tem ${r} tentativa(s) restante(s).`;
                }
            } else {
                errorMessage.innerText = data.message || 'Usuário ou senha inválidos.';
            }
            errorMessage.classList.remove('d-none');
            errorMessage.style.display = 'block';
        }
    } catch (error) {
        console.error("Erro de conexão:", error);
        errorMessage.innerText = 'Não foi possível conectar ao servidor. Verifique se o backend está rodando.';
        errorMessage.classList.remove('d-none');
        errorMessage.style.display = 'block';
    }
});


