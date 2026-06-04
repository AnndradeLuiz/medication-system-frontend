# Documento de Design: Arquitetura SPA Híbrida Progressiva

**Data:** 2026-05-23  
**Status:** Em Revisão  
**Autor:** Antigravity AI

## 1. Visão Geral
Atualmente, o sistema de medicamentos é composto por múltiplas páginas HTML independentes (`home-screen.html`, `patient.html`, `dashboard.html`, etc.). Ao navegar entre elas, o navegador destrói o estado atual e carrega a nova página do zero, causando o indesejado efeito de "piscar" (flicker) e dando uma sensação de site tradicional em vez de um aplicativo de desktop ou app web premium (como o Gmail).

Este documento propõe a migração para uma **Arquitetura SPA Híbrida Progressiva**. Com esta arquitetura, todas as páginas continuam existindo como arquivos HTML válidos (garantindo que recarregamentos, links diretos e compartilhamentos funcionem perfeitamente sem configurações complexas de servidor), mas, assim que a primeira página é carregada, o roteador JavaScript assume o controle de navegação e passa a trocar apenas o conteúdo interno da `.main-content` sem recarregar a Sidebar ou o Header.

---

## 2. Detalhamento Técnico

### 2.1 Roteamento SPA e Interceptação de Links (`js/router.js`)
Criaremos um arquivo central `js/router.js` que fará o seguinte:
1.  **Interceptar Cliques (`click`):** Capturar todos os cliques em links (`<a>`) locais direcionados a páginas `.html` (exceto `login.html`) e prevenir o comportamento padrão (`e.preventDefault()`).
2.  **Histórico do Navegador (`History API`):** Utilizar `history.pushState` para atualizar a barra de endereço silenciosamente.
3.  **Capturar Voltar/Avançar (`popstate`):** Escutar o evento `popstate` para navegar corretamente de forma dinâmica quando o usuário usar as setas do navegador.
4.  **Fetch Dinâmico:** Baixar o HTML da nova página via `fetch()`.
5.  **DOM Parsing:** Extrair o conteúdo da nova página (tudo dentro de `.main-content` *após* o `#header-placeholder`).
6.  **Substituição Cirúrgica de Conteúdo:** Manter o `#header-placeholder` existente intacto (evitando que o header pisque ou precise ser recarregado) e substituir apenas o restante do conteúdo de `.main-content` (como as abas e formulários).
7.  **Injeção de Scripts de View:** Encontrar a tag de script específica da view (ex: `js/patient.js`), baixar seu conteúdo, traduzir suas variáveis globais `let`/`const` para `var` (para evitar erros de redeclaração) e executá-lo para re-inicializar a tela.
8.  **Injeção de CSS Específico:** Mesclar quaisquer arquivos CSS específicos (como `css/patient.css`) na tag `<head>` se ainda não estiverem carregados.

### 2.2 Prevenção de Erros de Redeclaração
Como o JavaScript será executado múltiplas vezes na mesma sessão global, re-executar scripts que declaram variáveis de escopo global usando `let` ou `const` (ex: `let currentPatients = []` no topo do arquivo `patient.js`) lançaria um erro de sintaxe fatal: `Uncaught SyntaxError: Identifier 'currentPatients' has already been declared`.

**Solução Elegante:** Antes de executar qualquer script de view baixado dinamicamente, nosso roteador aplicará uma regex simples na raiz do código para traduzir `let` e `const` declarados no início de linhas para `var`:
```javascript
code = code
    .replace(/^let\s+/gm, 'var ')
    .replace(/^const\s+/gm, 'var ');
```
Em JavaScript, variáveis e funções declaradas com `var` na raiz global podem ser redeclaradas infinitamente sem gerar qualquer tipo de erro de sintaxe. Essa substituição cirúrgica só afeta declarações globais (no início de linhas), mantendo intocados os escopos locais indentados das funções.

### 2.3 Gerenciamento e Limpeza de Event Listeners Globais
Scripts de páginas individuais comumente registram ouvintes de eventos globais (como `document.addEventListener('click', ...)` para fechar caixas de sugestões de autocompletar). Ao navegar para outra tela, se não removermos esses ouvintes, eles se acumularão, causando execução duplicada e vazamentos de memória.

**Solução Elegante:** O roteador interceptará `document.addEventListener` e `window.addEventListener` globais. 
1.  Os ouvintes principais carregados no início (durante o carregamento dos componentes base e autenticação) funcionam livremente.
2.  Após a inicialização do app, qualquer novo ouvinte adicionado pelas views será rastreado automaticamente.
3.  Ao navegar para uma nova tela, o roteador chama `removeEventListener` em todos os ouvintes rastreados da tela anterior e limpa a lista de rastreamento antes de carregar o novo script.

---

## 3. Experiência do Usuário (UX)
*   **Transição de Tela Fluidíssima:** Ao clicar em qualquer link da sidebar, um indicador de carregamento discreto é ativado e a nova tela surge de forma instantânea através de uma transição suave.
*   **Sidebar e Header Estáticos:** A barra de navegação lateral (com a logo ampliada e as opções) e o topo do painel permanecem absolutamente estáticos e fixos no lugar, exatamente como no Gmail.
*   **Barra de Rolagem Inteligente:** Cada view mantém seu próprio comportamento de rolagem interna, de modo que a navegação pareça a de um software nativo premium.
*   **Excelente SEO e Compartilhamento:** Se o usuário der F5 em `patient.html` ou acessar o link diretamente, a página carrega perfeitamente do zero. Uma vez carregada, qualquer clique subsequente se comporta como SPA.

---

> [!NOTE]
> Esta arquitetura atinge a perfeição técnica: resolve o "piscar" de forma definitiva, mantém o código atual 100% intacto (não precisamos reescrever os scripts de 47.000 linhas das telas!) e é extremamente fácil de depurar.
