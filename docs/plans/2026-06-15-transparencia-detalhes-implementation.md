# Modal de Detalhes da Dispensação Implementation Plan

> **For Antigravity:** REQUIRED WORKFLOW: Use `.agent/workflows/execute-plan.md` to execute this plan in single-flow mode.

**Goal:** Adicionar fallback para funcionário, formatar gramática de unidades de medicamentos e criar um modal de visualização de detalhes para itens de histórico no Portal de Transparência.

**Architecture:** Modificações simples de HTML/CSS para criar o modal e estilizar os itens do histórico. Modificações em JS Vanilla para delegar eventos de clique e preencher o modal dinamicamente a partir de um array em memória.

**Tech Stack:** HTML5, CSS3, JavaScript (Vanilla).

---

### Task 1: Estrutura HTML do Modal

**Files:**
- Modify: `c:\Users\luize\Desktop\Sistema de Medicamentos\front-end-transparencia\index.html`

**Step 1: Inserir a estrutura HTML do modal**
- Adicionar no final do arquivo `index.html` a `div#details-modal`.

**Step 2: Commit**
```bash
git add index.html
git commit -m "feat: add modal structure to index.html"
```

### Task 2: Estilos CSS para o Modal e Interações

**Files:**
- Modify: `c:\Users\luize\Desktop\Sistema de Medicamentos\front-end-transparencia\style.css`

**Step 1: Inserir as classes CSS do modal**
- Adicionar os estilos para `.modal-overlay`, `.modal-content`, e os itens `.history-item` (hover, cursor).

**Step 2: Commit**
```bash
git add style.css
git commit -m "style: add modal and history-item styles"
```

### Task 3: Lógica JS para Abrir/Fechar Modal e Formatação

**Files:**
- Modify: `c:\Users\luize\Desktop\Sistema de Medicamentos\front-end-transparencia\app.js`

**Step 1: Ajustar a formatação de unidades**
- Substituir `un` fixo pela lógica de plural `${item.quantity} ${item.quantity === 1 ? 'unidade' : 'unidades'}` em `renderValidationResult` e `renderHistoryList`.

**Step 2: Ajustar o fallback do funcionário**
- Substituir `'Sistema'` por `'e-Farma SUS'` em `renderHistoryList`.

**Step 3: Adicionar a lógica de abertura do modal**
- Adicionar função `openDetailsModal(disp)`.
- Adicionar os event listeners no contêiner de histórico e no botão de fechar o modal.

**Step 4: Commit**
```bash
git add app.js
git commit -m "feat: implement modal logic and quantity formatting"
```
