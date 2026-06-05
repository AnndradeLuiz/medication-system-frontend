# Design Doc: Grid e Scrollbars em Pacientes e Estoque Geral (2026-06-04)

Este documento descreve as abordagens e as especificações de design para padronizar o grid e a barra deslizante nas tabelas de **Pacientes** e **Estoque Geral / Inventário / Lotes**.

## Abordagens Consideradas

### Abordagem Única de Padronização (Recomendada)
- **Implementação**:
  - Envolver as tabelas de Pacientes, Lotes de Estoque e Inventário Geral no container `.table-responsive` no `app.html`.
  - Mudar as classes dessas tabelas de `data-table` para `table`.
  - Configurar larguras recomendadas em linha nos `th` para prevenir deslocamentos no carregamento dos dados.
  - Ajustar o renderizador de pacientes em `js/patient.js` para adicionar `class="text-center"` nas células e manter o perfeito alinhamento com os cabeçalhos das colunas (CPF, CNS, Status e Vínculo).
- **Prós**:
  - Uniformidade visual completa: todo o sistema passa a utilizar a mesma identidade visual para tabelas (células com bordas claras e cabeçalhos em cinza azulado).
  - O `ResizeObserver` aprimorado na etapa anterior em `js/components.js` atualizará automaticamente os limites da barra flutuante nestas tabelas quando os dados forem carregados via AJAX.

---

## Detalhes do Design de Cada Tabela

### 1. Tabela de Pacientes
- **Estrutura**:
  - Nome Completo (Restante da largura)
  - CPF: `width: 160px; text-align: center;`
  - CNS: `width: 180px; text-align: center;`
  - Status na UBS: `width: 150px; text-align: center;`
  - Vínculo: `width: 140px; text-align: center;`

### 2. Tabela de Lotes Registrados (Edição de Estoque)
- **Estrutura**:
  - Código Lote: `width: 300px; text-align: center;`
  - Validade: `width: 250px; text-align: center;`
  - Qtd. Inicial: `width: 150px; text-align: center;`
  - Qtd. Restante: `width: 150px; text-align: center;`

### 3. Tabela de Inventário Total (Filtros de Estoque)
- **Estrutura**:
  - Item (Restante da largura - 25% de base)
  - Tipo: `width: 15%; text-align: center;`
  - Categoria: `width: 20%; text-align: center;`
  - Quantidade: `width: 12%; text-align: center;`
  - Validade: `width: 13%; text-align: center;`
  - Situação: `width: 15%; text-align: center;`
