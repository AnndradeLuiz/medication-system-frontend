# Plano de Implementação: Mitigação de Flicker e Transição de Página Suave

**Data:** 2026-05-23  
**Status:** Aprovado (Fade-In Suave)  
**Autor:** Antigravity AI

## 1. Objetivo e Contexto
O usuário relatou um desconforto visual na navegação entre as seções: a tela "pisca" (flicker) e o layout sofre um pequeno "salto" durante o carregamento de novas páginas HTML. Isso acontece porque a sidebar e o cabeçalho são injetados de forma assíncrona após as páginas carregarem e darem fetch nos arquivos partials.

Este plano detalha as alterações necessárias no CSS global (`css/dashboard.css`) e no script de inicialização de componentes (`js/components.js`) para implementar um **Fade-In Suave** no corpo da página, garantindo transições elegantes e imperceptíveis semelhantes a aplicativos Single Page Application (SPA).

---

## 2. Alterações Propostas

### 2.1 CSS Global (`css/dashboard.css`)
*   **Alteração:** Configurar a opacidade inicial do corpo da página (`body`) para `0` com transição suave, permitindo que a cor de fundo (`background-color`) se mantenha instantânea para evitar telas inteiramente brancas.
*   **Código esperado:**
    ```css
    body { 
        background-color: var(--color-bg); 
        color: var(--color-text-main); 
        font-family: var(--font-main);
        -webkit-font-smoothing: antialiased;
        opacity: 0;
        transition: opacity 0.12s ease-in-out;
    }
    
    body.ready {
        opacity: 1;
    }
    ```

### 2.2 Script de Componentização (`js/components.js`)
*   **Alteração 1:** Injetar a classe `ready` no `body` após o carregamento assíncrono e a injeção da sidebar e header no DOM.
*   **Alteração 2 (Failsafe):** Adicionar uma redundância de segurança via `setTimeout` de no máximo `200ms` para garantir que, mesmo que haja falha de rede ou de carregamento dos partials, a página se torne visível de qualquer forma.
*   **Código esperado:**
    ```javascript
    // No initComponents():
    async function initComponents() {
        try {
            // ... injeção dos partials ...
            
            // Ativa o fade-in suave ao terminar
            document.body.classList.add('ready');
        } catch (error) {
            console.error("Erro ao carregar componentes:", error);
            document.body.classList.add('ready'); // Garante exibição
        }
    }
    
    // Failsafe de Redundância:
    setTimeout(() => {
        document.body.classList.add('ready');
    }, 200);
    ```

---

## 3. Plano de Verificação e Testes

1.  **Testar Navegação:** Mudar de tela na sidebar (ex: Início -> Pacientes -> Dispensa). O piscar agressivo e saltos de layout devem desaparecer por completo, substituídos por uma transição de fade-in ultra suave e profissional de 120ms.
2.  **Validação de Failsafe:** Simular erro de carregamento (por exemplo, renomear temporariamente a pasta `partials/`). O conteúdo principal deve aparecer normalmente na tela após 200ms, provando que a página nunca ficará eternamente preta ou invisível em caso de queda de rede ou indisponibilidade local.
