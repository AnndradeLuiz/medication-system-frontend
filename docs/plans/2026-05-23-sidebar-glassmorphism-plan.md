# Sidebar Glassmorphism Implementation Plan

> **For Antigravity:** REQUIRED WORKFLOW: Use `.agent/workflows/execute-plan.md` to execute this plan in single-flow mode.

**Goal:** Transformar a barra lateral em uma sidebar flutuante com efeito glassmorphism (Translúcido, vidro fosco, arredondada e descolada da borda).

**Architecture:** Modificações puramente no CSS (`dashboard.css` e `global-tokens.css` se necessário). A barra `.sidebar` ganhará margens, `border-radius`, fundo rgba e `backdrop-filter: blur`. Os links de navegação terão novo efeito hover (pill animado) em substituição ao block tradicional.

**Tech Stack:** Vanilla CSS3.

---

### Task 1: Estruturar a Sidebar Flutuante

**Files:**
- Modify: `c:/Users/luize/Desktop/Sistema de Medicamentos/front-end/css/dashboard.css`

**Step 1: Modificar CSS base da .sidebar e .main-content**

Atualizar propriedades da classe `.sidebar`:
- `width: 260px` (ou manter 280px se preferir)
- `margin: 16px 0 16px 16px`
- `height: calc(100vh - 32px)`
- `border-radius: 20px`
- `background-color: rgba(255, 255, 255, 0.75)`
- `backdrop-filter: blur(16px)`
- `-webkit-backdrop-filter: blur(16px)`
- `border: 1px solid rgba(255, 255, 255, 0.6)`
- `box-shadow: 0 8px 32px rgba(0, 0, 0, 0.05)`

Atualizar `.main-content`:
- O layout de grid/flex precisará acomodar a margem da sidebar. Em geral, se a sidebar é position fixed ou flex item, ajustar margins. Se a sidebar tem `flex: 0 0 280px`, ajustar para contemplar as margens.

**Step 2: Atualizar efeitos hover nos links**

Atualizar propriedades da `.sidebar-nav a`:
- Adicionar `border-radius: 12px`
- Adicionar margem lateral interna (`margin: 0 12px`)
- `transition: all 0.3s ease`

Atualizar `.sidebar-nav a:hover`:
- Remover preenchimento sólido ocupando toda largura
- Adicionar fundo: `background: linear-gradient(135deg, rgba(37, 99, 235, 0.1), rgba(37, 99, 235, 0.05))` (ou var color primária)
- Transformação `transform: translateX(4px)`
- Sombra sutil `box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03)`

**Step 3: Ajustar CSS Mobile**

Em telas menores (`@media (max-width: 768px)`):
- Ajustar a `.sidebar` para deslizar da esquerda (já o faz), mas com fundo rgba e sem ocupar toda a borda esquerda (ou ocupando de forma orgânica com backdrop-filter).

**Step 4: Aplicar alterações e testar interface**
Garantir que a sidebar esteja flutuando suavemente e os links tenham a animação fluida no mouseover.
