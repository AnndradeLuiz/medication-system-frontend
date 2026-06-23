# Design Doc: Barra Lateral Colapsável e Flutuante (Hover)

Este documento especifica a nova interface da barra lateral do sistema **e-Farma SUS**, focada na remoção do logotipo e na transformação do menu em um componente colapsável que se expande sob o efeito de *hover* (passar o mouse), flutuando sobre a área de trabalho sem mover o conteúdo principal.

---

## 1. Requisitos de Interface

- **Sem Logotipo:** A logo será removida por completo da barra lateral. A navegação começará do topo.
- **Estado Colapsado (Padrão Desktop):**
  - Largura da barra lateral: `80px`.
  - Exibe apenas os ícones de cada seção centralizados.
  - Textos de descrição e rodapé ocultos via opacidade e visibilidade.
- **Estado Expandido (Hover Desktop):**
  - Ao passar o mouse sobre a barra lateral, ela se expande para `260px` de largura.
  - Os nomes das seções e botões de rodapé tornam-se visíveis por meio de transições suaves de opacidade.
  - A barra projeta uma sombra suave para flutuar visualmente por cima do conteúdo.
- **Estabilidade do Conteúdo Centralizado:**
  - A área de trabalho principal (`.main-content`) possui uma margem esquerda estática de `112px` (`16px` de margem externa + `80px` da barra colapsada + `16px` de gap).
  - A expansão do menu ocorre sobre o espaço de margem lateral, mantendo o painel de trabalho totalmente estático.
- **Responsividade (Mobile/Tablet ≤ 1024px):**
  - O menu funcionará como uma gaveta (*drawer*), abrindo na largura total expandida de `260px` ao tocar no botão de menu do topo, sem comportamento colapsado.

---

## 2. Alterações Propostas

### 2.1 HTML (`index.html`)
- Remover a `div` de classe `.sidebar-header`.
- Envolver os textos dos links em tags `<span>` (ex: `<span>Tela Inicial</span>`) para controle independente de visibilidade e transição no CSS.

### 2.2 CSS (`global.css`)
- Ajustar `.sidebar` para `position: absolute; width: 80px; left: 16px; top: 16px; height: calc(100vh - 32px);`.
- Configurar `.sidebar:hover` para `width: 260px; box-shadow: 0 20px 40px rgba(0, 0, 0, 0.12); z-index: 50;`.
- Ajustar `.main-content` para `margin: 16px 16px 16px 112px;` (no desktop).
- Configurar transições e estados de opacidade nos textos (`.sidebar-nav li a span`) e rodapé (`.sidebar-footer`).
- Adicionar regras específicas dentro da media query `@media (max-width: 1024px)` para reverter para o menu gaveta nativo (largura total e estático de `260px`).
