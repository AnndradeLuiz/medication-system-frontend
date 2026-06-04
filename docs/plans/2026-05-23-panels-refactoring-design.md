# Design Doc: Refatoração Visual dos Painéis de Conteúdo (Painel Flutuante Único)

**Data:** 2026-05-23  
**Status:** Aprovado (Abordagem A)  
**Autor:** Antigravity AI

## 1. Objetivo e Contexto
Após a implementação bem-sucedida da sidebar flutuante com glassmorphism (margem de 16px, cantos de 20px, fundo translúcido blur), a área principal do sistema (`.main-content`) e seus subcomponentes (cabeçalho, abas e cartões de dados) ficaram visualmente desalinhados. As bordas rígidas coladas nos cantos da tela e os fundos sólidos brancos ou cinzas entram em conflito com o visual leve e flutuante da sidebar.

Este documento especifica a refatoração visual completa da área principal para que ela se comporte como um **Painel Flutuante Único**, perfeitamente alinhado com a sidebar e possuindo rolagem interna de conteúdo no estilo de aplicativo nativo moderno (App-like).

---

## 2. Conceito de Design Aprovado

### Painel Flutuante Único com Abas Modernas (Abordagem A)

```
+-------------------------------------------------------------------+
|  [ SISTEMA DE MEDICAMENTOS - UBS ]                                 |
|                                                                   |
|  +--------------+  +-------------------------------------------+  |
|  |  e-Farma SUS |  |  PAINEL PRINCIPAL (Glassmorphism Suave)   |  |
|  |  (Logo 110px)|  |                                           |  |
|  |              |  |  +-------------------------------------+  |  |
|  |  [o] Início  |  |  | Cabeçalho (Fixo)  [Luiz] [Avatar]   |  |  |
|  |  [ ] Paciente|  |  +-------------------------------------+  |  |
|  |  [ ] Dispensa|  |  | Abas Modernas (Transparente, Fixo)  |  |  |
|  |  [ ] Estoque |  |  +-------------------------------------+  |  |
|  |              |  |  |                                     |  |  |
|  |  [ ] Sair    |  |  | Área de Conteúdo Rolo (Scroll)      |  |  |
|  |              |  |  |                                     |  |  |
|  |              |  |  |  +-------------------------------+  |  |  |
|  |              |  |  |  | Card de Dados (Branco 70%)    |  |  |  |
|  |              |  |  |  +-------------------------------+  |  |  |
|  |              |  |  |                                     |  |  |
|  +--------------+  +-------------------------------------------+  |
+-------------------------------------------------------------------+
```

---

## 3. Especificações Técnicas de CSS

### 3.1 Painel Principal (`.main-content`)
*   **Posicionamento:** `margin: 16px 16px 16px 0;` (16px superior, direita e inferior; e 0 na esquerda aproveitando o espaço do placeholder da sidebar).
*   **Dimensões:** `height: calc(100vh - 32px); width: auto; flex: 1;`.
*   **Fronteira:** `border-radius: 20px; border: 1px solid rgba(255, 255, 255, 0.5);`.
*   **Efeito Glass:** `background-color: rgba(255, 255, 255, 0.45); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);`.
*   **Sombra:** `box-shadow: 0 8px 32px rgba(0,0,0,0.03);`.
*   **Mecânica de Rolagem (App-like):** `display: flex; flex-direction: column; overflow: hidden;`. A área principal NÃO rola a tela inteira; o cabeçalho e abas são fixos e apenas a subseção de conteúdo rola.

### 3.2 Cabeçalho (`.top-header`)
*   **Cantos:** `border-radius: 20px 20px 0 0;` (casa perfeitamente com os cantos do painel).
*   **Estilo:** `background-color: transparent; border-bottom: 1px solid rgba(255, 255, 255, 0.35); box-shadow: none;`.
*   **Espaçamento:** Padding reduzido para `20px 32px;` para melhor aproveitamento vertical.

### 3.3 Barra de Abas (`.tabs-wrapper` e `.tabs-container`)
*   **Estilo:** `background-color: transparent; border-bottom: 1px solid rgba(0,0,0,0.05);`.
*   **Alinhamento:** `.tabs-container` terá `max-width: none; padding: 0 32px;`.
*   **Abas (`.tab`):** Padding de `16px 0;`, cor de hover e ativa baseadas na paleta primária.
*   **Indicador Ativo:** Linha inferior de `3px` com cantos arredondados, gradiente sutil azul moderno e transições suaves de opacidade e movimento.

### 3.4 Área Interna e Rolagem (`.form-content`, `.home-content` etc.)
*   **Scroll Isolado:** `flex: 1; overflow-y: auto; padding: 24px 32px;`.
*   **Scrollbar:** Otimização visual da barra de rolagem interna para ficar sutil e fina, evitando vazamentos laterais.

### 3.5 Cartões Internos (`.card`)
*   **Fundo e Leitura:** `background-color: rgba(255, 255, 255, 0.7);` (um branco translúcido que permite a leitura perfeita e contraste em inputs/tabelas, mas mantém o visual leve de vidro).
*   **Cantos e Bordas:** `border-radius: 16px; border: 1px solid rgba(255, 255, 255, 0.8);`.
*   **Sombra:** `box-shadow: 0 4px 20px rgba(0,0,0,0.02);`.

### 3.6 Aumento da Logo da Sidebar (`.sidebar-header img`)
*   **Ajuste Sidebar:** A `.sidebar-header` passa a ter `padding: 32px 20px;` para economizar espaço vertical.
*   **Logo:** A imagem terá a sua altura máxima alterada para `max-height: 110px;`, dando maior destaque e presença visual no topo.

---

## 4. Benefícios e Impacto Visual
1.  **Sintonia Absoluta:** O sistema se comporta visualmente como um único ecossistema flutuante moderno de vidro (glassmorphism).
2.  **Usabilidade Premium:** A navegação fica muito mais estável, pois o cabeçalho e as abas nunca "somem" da tela durante a rolagem dos dados.
3.  **Contraste Impecável:** A translucidez de 70% nos cards de formulários e tabelas garante que todos os dados e textos fiquem perfeitamente nítidos para uso diário em computadores ou tablets.
