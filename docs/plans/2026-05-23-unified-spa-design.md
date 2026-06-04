# Documento de Design: SPA Unificada em Arquivo Único (app.html)

**Data:** 2026-05-23  
**Status:** Em Revisão  
**Autor:** Antigravity AI

## 1. Visão Geral
O usuário indicou a preferência de unificar todo o sistema em um **único arquivo HTML** central. Essa abordagem (conhecida como SPA de documento único) resolve por completo as piscadas de tela e problemas de transição de forma robusta e definitiva. Ela também garante compatibilidade total de funcionamento offline e execução local (via protocolo `file://`, ou seja, abrindo os arquivos diretamente do Desktop com duplo clique) sem necessidade de servidores web rodando localmente.

Este documento detalha o design para a criação do arquivo mestre **`app.html`** que conterá todas as visões (telas) do sistema em seções que são mostradas ou ocultadas instantaneamente.

---

## 2. Estrutura Arquitetural

### 2.1 O Documento Mestre `app.html`
O arquivo `app.html` conterá:
1.  **Sidebar Estática:** Integrada diretamente no HTML (com os botões de menu).
2.  **Top Header Estático:** Integrado diretamente no HTML (com o perfil de usuário).
3.  **Seções de Visão (`.view-section`):** Dentro da área `.main-content`, cada tela do sistema será encapsulada em um contêiner `<div id="view-[nome]" class="view-section">` contendo o HTML específico daquela página.

```html
<main class="main-content">
    <header class="top-header">...</header>

    <!-- Seção: Tela Inicial -->
    <div id="view-home-screen" class="view-section active">
        <!-- HTML de home-screen.html -->
    </div>

    <!-- Seção: Pacientes -->
    <div id="view-patient" class="view-section">
        <!-- HTML de patient.html -->
    </div>

    <!-- Seção: Dispensa -->
    <div id="view-dashboard" class="view-section">
        <!-- HTML de dashboard.html -->
    </div>

    <!-- Seção: Estoque -->
    <div id="view-estoque" class="view-section">
        <!-- HTML de estoque.html -->
    </div>

    <!-- Seção: Inventário -->
    <div id="view-inventory-list" class="view-section">
        <!-- HTML de inventory-list.html -->
    </div>

    <!-- Seção: Funcionários -->
    <div id="view-funcionarios" class="view-section">
        <!-- HTML de funcionarios.html -->
    </div>
</main>
```

### 2.2 Controle de Visibilidade de Telas (CSS)
Telas inativas serão ocultadas via CSS nativo ultra veloz usando `display: none`:
```css
.view-section {
    display: none;
    opacity: 0;
    transition: opacity 0.15s ease-in-out;
}

.view-section.active {
    display: block;
    opacity: 1;
}
```

### 2.3 Resolução de Conflitos Globais no JavaScript
Como todas as visões compartilharão o mesmo escopo global do documento `app.html`:
1.  **Compatibilidade de Escopo:** Alteraremos as declarações de variáveis globais `let` e `const` declaradas no início dos scripts das views para `var` (como `var medicationList = []` em `patient.js` e `dashboard.js`). Em JS, variáveis declaradas com `var` e funções podem ser redeclaradas livremente sem gerar erros de sintaxe de redeclaração.
2.  **Resolução de IDs Duplicados:** Modificaremos a ID duplicada de pesquisa (`id="searchInput"`) em `estoque.html` e `estoque.js` para `id="estoqueSearchInput"`, garantindo que não haja colisões de seletores DOM.
3.  **Togle e Histórico de Rotas:** O arquivo `js/router.js` será transformado em um roteador interno de navegação simples que escuta cliques na sidebar, oculta/mostra os contêineres `.view-section` correspondentes, atualiza o título do header e insere o hash na URL (`app.html#patient`) para que o botão voltar/avançar do navegador continue funcionando perfeitamente.

---

## 3. Fluxo de Entrada e Autenticação
*   O arquivo `login.html` continua independente.
*   Após o login bem-sucedido, o usuário é redirecionado em `login-script.js` para `app.html` (em vez de `home-screen.html`).
*   O carregamento inicial de dados (KPIs do dashboard, lista de pacientes, etc.) ocorre em paralelo no carregamento do `app.html`, tornando o aplicativo instantâneo e responsivo desde o primeiro clique.
