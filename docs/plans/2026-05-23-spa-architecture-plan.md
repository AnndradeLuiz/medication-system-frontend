# Plano de Implementação: Arquitetura SPA Híbrida Progressiva

> **Para o Antigravity:** FLUXO DE EXECUÇÃO: Executar este plano passo a passo no modo de fluxo único (Single-Flow).

**Objetivo:** Transformar o sistema multi-páginas atual em uma Single Page Application (SPA) Híbrida Progressiva altamente responsiva e fluida, eliminando por completo o "piscar" e mantendo a Sidebar e Header fixos na tela.

---

## 1. Cronograma de Tarefas Granulares

### 📦 Fase 1: O Roteador Central (`js/router.js`)
*   **Tarefa 1.1:** Criar o arquivo `js/router.js` com a lógica de interceptação de cliques e histórico (`History API`).
*   **Tarefa 1.2:** Implementar a lógica de interceptação global de ouvintes (`document.addEventListener` e `window.addEventListener`) para rastrear e limpar ouvintes de views anteriores.
*   **Tarefa 1.3:** Implementar a função `navigateTo(path, pushState)` para buscar, analisar, substituir o conteúdo e gerenciar scripts/CSS dinamicamente com suporte a tradução de `let`/`const` para `var` via Regex.

### 📦 Fase 2: Integração com o Inicializador (`js/components.js`)
*   **Tarefa 2.1:** Modificar o arquivo `js/components.js` para importar e acionar a inicialização do roteador dinâmico após o carregamento completo do Header e Sidebar.
*   **Tarefa 2.2:** Integrar o estado `window.spaRouterReady = true` para ativar o rastreamento seletivo de ouvintes.

### 📦 Fase 3: Ajustes e Mitigação de Efeitos Colaterais nas Views
*   **Tarefa 3.1:** Analisar as views individuais para garantir que não haja conflitos de escopo ou de variáveis.
*   **Tarefa 3.2:** Testar navegação bidirecional rápida (ex: Início -> Pacientes -> Estoque -> Início) para assegurar que não haja acúmulo de ouvintes e que o autocompletar continue funcionando perfeitamente em todas as telas.

---

## 2. Plano de Verificação e Testes

### 🧪 Testes Automatizados / Manuais
1.  **Navegação Sem Recarregamento (SPA):** Clicar nas seções da sidebar e observar o console e a aba Network do navegador. A página não deve piscar e nenhum arquivo `.css` global ou `components.js` deve ser baixado novamente. Apenas a view desejada e seu script correspondente devem ser requisitados.
2.  **Verificação de Histórico:** Usar os botões "Voltar" e "Avançar" do navegador. As telas devem trocar perfeitamente e atualizar os dados corretos sem piscar.
3.  **Funcionamento dos Formulários e Autocompletar:** Acessar *Pacientes* ou *Estoque*, preencher dados e testar as listas de sugestões (autocompletar). Mudar de página, voltar a ela e certificar-se de que o autocompletar continua funcionando sem duplicar as sugestões.
4.  **Recarregamento F5 (Fallback):** Pressionar `F5` ou `Ctrl + F5` em qualquer página (ex: `patient.html`). A página deve carregar perfeitamente a partir do servidor e, ao clicar na sidebar a seguir, comportar-se como SPA instantaneamente.
