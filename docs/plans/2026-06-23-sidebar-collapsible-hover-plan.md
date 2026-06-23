# Barra Lateral Colapsável com Hover Flutuante Implementation Plan

> **For Antigravity:** REQUIRED WORKFLOW: Use `.agent/workflows/execute-plan.md` to execute this plan in single-flow mode.

**Goal:** Transformar a barra lateral em um menu colapsável de `80px` (exibindo apenas ícones) que se expande para `260px` no *hover* (passando o mouse) flutuando sobre a área de trabalho sem mover o conteúdo principal, removendo completamente o logotipo em todos os momentos.

**Architecture:** A barra lateral será posicionada de forma absoluta no desktop, reservando um espaço estático na margem esquerda da área de trabalho principal (`.main-content`). Os textos dos links serão encapsulados em tags `<span>` para transicionar a opacidade no hover. No mobile, o comportamento original de menu gaveta estático com largura total de `260px` será mantido.

**Tech Stack:** HTML5, CSS3 Vanilla, JavaScript Vanilla.

---

### Task 1: Modificar Estrutura HTML (`index.html`)

**Files:**
- Modify: [index.html](file:///c:/Users/luize/Desktop/Sistema%20de%20Medicamentos/front-end/index.html)

**Prazos e Ações:**
- Remover a `div` de classe `sidebar-header` (linhas 63-67).
- Adicionar padding-top à lista ou sidebar para compensar a perda de espaço da logo.
- Envolver todos os textos de links de navegação (`Tela Inicial`, `Pacientes`, etc.) e do rodapé (`Sobre / Créditos`, `Sair do Sistema`) em elementos `<span>` para controle suave de opacidade.

---

### Task 2: Modificar Estilos CSS (`global.css`)

**Files:**
- Modify: [global.css](file:///c:/Users/luize/Desktop/Sistema%20de%20Medicamentos/front-end/src/styles/global.css)

**Prazos e Ações:**
- Garantir que `.app-container` tenha `position: relative;`.
- Redefinir a classe `.sidebar` no desktop:
  - Definir `width: 80px;`.
  - Definir `position: absolute; left: 0; top: 0;`.
  - Adicionar `transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.3s ease;`.
  - Definir `overflow: hidden;`.
- Adicionar estilo de expansão sob hover (apenas em telas desktop: `min-width: 1025px`):
  - `.sidebar:hover { width: 260px; box-shadow: 0 20px 40px rgba(0, 0, 0, 0.12); z-index: 50; }`.
- Ajustar `.main-content` no desktop:
  - Definir `margin: 16px 16px 16px 112px;` (espaço reservado para a barra colapsada de `80px` + margens).
- Controlar a transição suave de opacidade e visibilidade dos textos:
  - `.sidebar-nav li a span, .sidebar-footer a span { opacity: 0; visibility: hidden; transition: opacity 0.2s ease, visibility 0.2s ease; white-space: nowrap; }`.
  - `.sidebar:hover .sidebar-nav li a span, .sidebar:hover .sidebar-footer a span { opacity: 1; visibility: visible; }`.
- Garantir comportamento responsivo completo dentro de `@media (max-width: 1024px)`:
  - Forçar opacidade/visibilidade total das tags `span` no mobile.
  - Manter `.sidebar` com largura fixa de `260px` quando aberto.

---

### Task 3: Verificação Visual e Ajustes Finos

**Ações:**
- Abrir a aplicação no navegador.
- Testar a interação de passar o mouse na barra lateral e verificar se ela se expande perfeitamente por cima da área de trabalho, sem deslocar tabelas ou campos da tela.
- Validar se a navegação continua 100% funcional.
- Testar no modo responsivo (mobile/tablet) para confirmar que o menu gaveta continua abrindo com textos visíveis por padrão.
