# Plano de Implementação: SPA Unificada em Arquivo Único (app.html)

**Objetivo:** Consolidar todas as páginas do sistema de medicamentos em um único arquivo mestre `app.html`, configurando uma transição de tela instantânea baseada em visibilidade e resolvendo conflitos de JavaScript/HTML de forma definitiva.

---

## 1. Cronograma de Tarefas Granulares

### 📦 Fase 1: Resolução de Conflitos e Preparação de Scripts
*   **Tarefa 1.1:** Renomear `id="searchInput"` em `estoque.html` e `js/estoque.js` para `id="estoqueSearchInput"` para evitar colisão com o campo de busca de pacientes.
*   **Tarefa 1.2:** Alterar declarações de variáveis globais `let` e `const` para `var` no topo dos seguintes arquivos:
    *   `js/patient.js`
    *   `js/dashboard.js`
    *   `js/estoque.js`
    *   `js/inventory-list.js`
    *   `js/home.js`
    *   `js/funcionarios.js`

### 📦 Fase 2: O Roteador de Abas Internas (`js/router.js`)
*   **Tarefa 2.1:** Reescrever `js/router.js` para gerenciar a troca de visibilidade das seções `.view-section` na mesma página, atualizar a URL com `#secao` e sincronizar os títulos/subtítulos do header dinamicamente.

### 📦 Fase 3: Montagem do HTML Mestre (`app.html`)
*   **Tarefa 3.1:** Criar o arquivo `app.html` incorporando a estrutura da Sidebar e Header.
*   **Tarefa 3.2:** Integrar os blocos de conteúdo principal de cada página dentro de contêineres `.view-section` em `app.html`.
*   **Tarefa 3.3:** Importar as folhas de estilo globais/específicas no `<head>` de `app.html` e todos os scripts na base do `app.html`.

### 📦 Fase 4: Redirecionamento de Login e Limpeza
*   **Tarefa 4.1:** Modificar o arquivo `js/login-script.js` para redirecionar o usuário após o login para `app.html` em vez de `home-screen.html`.
*   **Tarefa 4.2:** Testar o aplicativo localmente para certificar-se de que a navegação e todas as funcionalidades estão 100% integradas e operacionais de forma instantânea.

---

## 2. Plano de Verificação e Testes

1.  **Navegação Instantânea Real:** Trocar de seção pela sidebar e certificar-se de que a troca de tela ocorre instantaneamente, sem nenhuma piscada de tela, mesmo se o arquivo for aberto diretamente do Desktop (protocolo `file://`).
2.  **Verificação de Autocompletar e Formulários:** Testar o autocompletar na busca de pacientes (Pacientes) e de medicamentos (Dispensação/Estoque) para validar que os scripts co-existem e operam de forma isolada e perfeita.
3.  **Fluxo de Login Completo:** Realizar o login a partir de `login.html` e conferir se o direcionamento vai diretamente para `app.html` e abre a Tela Inicial por padrão.
