---
name: descentralizacao-css
description: Guia e fluxo para descentralizar e modularizar arquivos CSS centralizados em folhas de estilo individuais por página, view ou componente reutilizável.
---

# Skill: Descentralização de CSS por Página/Componente

Esta skill instrui o agente sobre como planejar, executar e validar a refatoração de estilos CSS de uma aplicação, migrando de uma folha de estilo única ("monolito de CSS") para um modelo modularizado por página/view e componente.

---

## Objetivo

Refatorar folhas de estilo centralizadas, organizando as regras de CSS em múltiplos arquivos específicos baseados em páginas (views), componentes compartilhados ou tokens de design globais, reduzindo o acoplamento e melhorando drasticamente a legibilidade e a manutenção.

---

## Processo de Tomada de Decisão (Fluxo)

Para cada regra de estilo ou bloco de CSS encontrado no arquivo de origem, classifique o seletor usando a seguinte lógica:

```text
O estilo é usado na aplicação inteira (ex: reset, layout de estrutura principal, sidebar, header global)?
├─ Sim ➔ global.css (ou global-tokens.css se for variáveis/fontes)
└─ Não
    ├─ O estilo é compartilhado por mais de uma página/view (ex: modais, paginação, cards genéricos)?
    │   ├─ Sim ➔ src/styles/components/[componente].css
    │   └─ Não ➔ Mover para o CSS específico da página/view (ex: src/styles/[view-name].css)
```

---

## Estrutura de Diretórios Recomendada

Ao aplicar esta refatoração, organize a estrutura de estilos da seguinte forma:

```text
src/
├── pages/
│   ├── views/
│   │   ├── home-screen.html
│   │   ├── dispensacao.html
│   │   └── patient.html
│
└── styles/
    ├── global-tokens.css   # Variáveis, fontes e temas base (:root)
    ├── global.css          # Reset, estrutura geral (Sidebar, Header) e utilitários globais (flex, margin)
    ├── home.css            # Estilos específicos da tela inicial
    ├── dispensacao.css     # Estilos específicos de dispensação
    ├── patient.css         # Estilos específicos de pacientes
    └── components/         # CSS de componentes reaproveitáveis (Opcional se houver muitos)
        ├── modal.css
        └── table.css
```

---

## Regras de Refatoração Incremental (Passo a Passo)

Para garantir que a aplicação não quebre visualmente durante a migração, siga rigorosamente as seguintes etapas:

### 1. Mapeamento e Auditoria
Antes de editar qualquer código, mapeie todos os seletores e faça uma lista de dependências das páginas:
- Identifique quais classes são exclusivas de cada página observando as classes nos arquivos `.html`.
- Separe os seletores que pertencem a componentes globais (ex: `.sidebar`, `.modal`, `.loader`).

### 2. Extração Segura e Limpa
- Utilize a ferramenta `replace_file_content` ou `multi_replace_file_content` para remover as regras do arquivo global.
- Use `write_to_file` para criar os novos arquivos `.css` individuais específicos.
- **Importante:** Mantenha comentários de delimitação nos novos arquivos CSS explicando qual é a finalidade das regras.

### 3. Registro dos Imports
- Atualize o arquivo HTML principal (ex: `index.html`) ou o arquivo correspondente de cabeçalho para importar os novos arquivos CSS.
- Mantenha a ordem correta de precedência:
  1. Variáveis e Tokens de Design (`global-tokens.css`)
  2. Estilo Estrutural Geral (`global.css`)
  3. Estilos de Componentes Compartilhados (`components/*.css`)
  4. Estilos Específicos das Páginas (`home.css`, `dispensacao.css`, etc.)

### 4. Critérios de Não-Regressão (Restrições)
- **Não altere seletores ou propriedades:** Apenas mova-os de arquivo. Não altere valores de margens, cores ou tamanhos sem que tenha sido explicitamente solicitado.
- **Preserve responsividade e animações:** Media queries (`@media`) e keyframes (`@keyframes`) específicos de elementos de uma página devem ser movidos para a folha de estilo da respectiva página.
- **Evite duplicação:** Se uma regra for duplicada em múltiplos novos arquivos, ela deve ser promovida a um componente em `components/` ou declarada como utilitária no `global.css`.

---

## Guia de Ferramentas para o Agente

Ao executar essa refatoração, siga esta ordem de ferramentas:
1. **`grep_search`**: Para localizar em quais arquivos `.html` um determinado seletor CSS (ex: `.kpi-card`, `.suggestion-list`) está sendo usado.
2. **`view_file`**: Para inspecionar e copiar blocos de estilo do CSS centralizado.
3. **`write_to_file`**: Para criar os novos arquivos de estilo individuais com conteúdo limpo.
4. **`replace_file_content`**: Para remover as partes extraídas do CSS centralizado e atualizar as chamadas no arquivo HTML correspondente.
