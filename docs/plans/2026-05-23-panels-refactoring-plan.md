# Refatoração dos Painéis e Cabeçalhos (Painel Flutuante Único) Implementation Plan

> **For Antigravity:** REQUIRED WORKFLOW: Use `.agent/workflows/execute-plan.md` to execute this plan in single-flow mode.

**Goal:** Refatorar a área de conteúdo principal (cabeçalho, abas e cartões) de todas as páginas para flutuar em um único painel arredondado com efeito glassmorphism e rolagem interna ultra fluida, alinhando-se perfeitamente com a nova sidebar e aumentando o destaque da logo.

**Architecture:** A área `.main-content` deixa de ser estática e colada nas bordas e passa a ser um container flutuante (`margin: 16px 16px 16px 0`, `height: calc(100vh - 32px)`, `border-radius: 20px`, `backdrop-filter`). O cabeçalho e abas são fixados no topo dele (`display: flex; flex-direction: column; overflow: hidden;`), e a área interna (`.form-content`, `.home-content` etc.) rola de forma isolada (`overflow-y: auto; flex: 1;`).

**Tech Stack:** Vanilla HTML, Vanilla CSS, FontAwesome.

---

### Task 1: Refatorar Estrutura de Painel Principal e Cabeçalho
**Files:**
*   Modify: `css/dashboard.css:446-479` (Estrutura da classe `.main-content` e `.top-header`)

**Step 1: Modificar classe `.main-content` no CSS**
Substituir a declaração atual de `.main-content` para aplicar o posicionamento flutuante, cantos de 20px, efeito glassmorphism suave de fundo e ocultar transbordo vertical geral para preparar a rolagem de app nativo.
Código esperado:
```css
.main-content { 
    flex: 1; 
    display: flex; 
    flex-direction: column; 
    height: calc(100vh - 32px);
    margin: 16px 16px 16px 0;
    border-radius: 20px;
    background-color: rgba(255, 255, 255, 0.45);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border: 1px solid rgba(255, 255, 255, 0.5);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.03);
    overflow: hidden; 
}
```

**Step 2: Ajustar a classe `.top-header` no CSS**
Modificar o cabeçalho superior para se fundir de forma translúcida ao topo do painel principal flutuante, ajustando os cantos superiores e reduzindo levemente o padding.
Código esperado:
```css
.top-header { 
    background-color: rgba(255, 255, 255, 0.2); 
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    padding: 20px 32px; 
    display: flex; 
    justify-content: space-between; 
    align-items: center; 
    border-bottom: 1px solid rgba(255, 255, 255, 0.35); 
    border-radius: 20px 20px 0 0;
    box-shadow: none;
}
```

**Step 3: Ajustar Margem no Mobile (Media Queries)**
Pesquisar e ajustar o comportamento no mobile para que o painel principal use 100% da tela sem margens flutuantes quando a sidebar for ocultada.
Modify: `css/dashboard.css` na seção de responsividade `@media` (linha ~1113).
Código esperado:
```css
@media (max-width: 1024px) {
    .main-content {
        margin: 0;
        height: 100vh;
        border-radius: 0;
        border: none;
    }
    .top-header {
        border-radius: 0;
        padding: 16px 20px;
    }
}
```

---

### Task 2: Modernizar a Barra de Abas e a Logo da Sidebar
**Files:**
*   Modify: `css/dashboard.css:517-550` (Estilização de `.tabs-wrapper`, `.tabs-container` e `.tab`)
*   Modify: `css/dashboard.css:348-369` (Ajustes da `.sidebar-header` e logo)

**Step 1: Otimizar o Cabeçalho da Sidebar e Aumento de Logo no CSS**
Ajustar o preenchimento da `.sidebar-header` para liberar espaço vertical, e estilizar o tamanho máximo do logo da sidebar para se destacar.
Código esperado:
```css
.sidebar-header { 
    padding: 32px 20px; 
    display: flex; 
    flex-direction: column; 
    align-items: center; 
    gap: 12px; 
    color: var(--color-text-main); 
}
.sidebar-header img {
    max-height: 110px !important;
    width: auto;
    object-fit: contain;
}
```

**Step 2: Tornar o `.tabs-wrapper` translúcido/transparente no CSS**
Remover fundos cinzas e brancos rígidos das abas para integrá-las de forma leve.
Código esperado:
```css
.tabs-wrapper { 
    background-color: transparent; 
    border-bottom: 1px solid rgba(0, 0, 0, 0.05); 
    display: flex; 
    justify-content: center; 
}
.tabs-container { 
    width: 100%; 
    max-width: none; 
    display: flex; 
    gap: 40px; 
    padding: 0 32px; 
}
```

**Step 3: Refinar o estilo visual das abas e efeito ativo**
Atualizar as abas `.tab` e seu indicador de linha ativa. A linha de seleção ativa terá cantos arredondados e gradiente azul moderno.
Código esperado:
```css
.tab { 
    padding: 16px 0; 
    color: var(--color-text-muted); 
    font-weight: 600; 
    cursor: pointer; 
    display: flex; 
    align-items: center; 
    gap: 10px; 
    font-size: 15px; 
    border-bottom: 3px solid transparent; 
    transition: all 0.3s ease; 
}
.tab:hover { 
    color: var(--color-primary); 
}
.tab.active { 
    color: var(--color-primary); 
    border-bottom: 3px solid var(--color-primary);
    border-radius: 0 0 3px 3px;
}
```

---

### Task 3: Implementar Área Interna com Scroll e Estilo Premium de Cards
**Files:**
*   Modify: `css/dashboard.css` (Áreas de conteúdo como `.form-content`, `.home-content`, e classe `.card`)

**Step 1: Configurar Rolagem Isolada nas Áreas de Conteúdo**
Identificar todas as classes que envelopam os conteúdos das telas (`.form-content`, `.home-content`, `.estoque-content` se houver) e definir a rolagem independente com preenchimento limpo.
Código esperado:
```css
.form-content, .home-content {
    flex: 1;
    overflow-y: auto;
    padding: 24px 32px;
}
/* Opcional: Estilizar as barras de rolagem internas de forma elegante */
.form-content::-webkit-scrollbar, 
.home-content::-webkit-scrollbar,
.main-content::-webkit-scrollbar {
    width: 6px;
    height: 6px;
}
.form-content::-webkit-scrollbar-track,
.home-content::-webkit-scrollbar-track {
    background: transparent;
}
.form-content::-webkit-scrollbar-thumb,
.home-content::-webkit-scrollbar-thumb {
    background: rgba(0, 0, 0, 0.1);
    border-radius: 10px;
}
.form-content::-webkit-scrollbar-thumb:hover,
.home-content::-webkit-scrollbar-thumb:hover {
    background: rgba(0, 0, 0, 0.2);
}
```

**Step 2: Estilizar a Classe `.card` com Fundo Branco Translúcido 70%**
Garantir o perfeito balanço entre beleza glassmorphism e legibilidade, configurando os cards internos para serem brancos com 70% de opacidade, com bordas brancas sutis e cantos arredondados de 16px.
Código esperado:
```css
.card {
    background-color: rgba(255, 255, 255, 0.7);
    border: 1px solid rgba(255, 255, 255, 0.8);
    border-radius: 16px;
    padding: 24px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.02);
    margin-bottom: 20px;
}
```

**Step 3: Corrigir Potenciais Conflitos com Tabelas e Outros Cards**
Assegurar que cartões especializados e cabeçalhos de tabela (`thead` com `.bg-light`) fiquem limpos e adequados com o novo estilo translúcido de card.
Código esperado:
```css
.data-table thead tr {
    background-color: rgba(241, 245, 249, 0.5) !important;
}
```

---

### Task 4: Verificação de Telas e Ajustes Finais
**Files:**
*   Verify: `home-screen.html` (Painel Geral)
*   Verify: `patient.html` (Gestão de Pacientes)
*   Verify: `dashboard.html` (Dispensa de Medicamentos)
*   Verify: `estoque.html` (Estoque Geral)

**Step 1: Testar layout nas quatro páginas principais**
Verificar visualmente se todas as páginas estão renderizando os painéis e o cabeçalho de forma alinhada com a sidebar.
*   **Critério de Sucesso:** A altura do painel principal deve ser exatamente igual à da sidebar no desktop (`height: calc(100vh - 32px)`), e o topo de ambos deve ficar perfeitamente nivelado a 16px do topo físico da tela.
*   **Critério de Leitura:** Todos os textos, tabelas e botões nos cards de 70% de opacidade devem apresentar contraste e leitura excelentes.

**Step 2: Validar o Scrollbar e Responsividade**
Verificar se o scroll funciona apenas de forma interna na área de conteúdo de cada página e se a barra de rolagem não sobrepõe ou causa "jitter" lateral. No mobile, assegurar que o painel principal ocupe 100% do viewport como esperado.
