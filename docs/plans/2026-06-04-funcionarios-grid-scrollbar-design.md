# Design Doc: Grid e Scrollbar na Tabela de Funcionários (2026-06-04)

Este documento descreve as abordagens e a arquitetura proposta para unificar o visual da tabela de Funcionários com a tabela de Auditoria.

## Abordagens Consideradas

### Abordagem 1 (Recomendada)
- **Implementação**: Envolver a tabela `#employeeTable` com `.table-responsive` diretamente no `app.html` e mudar sua classe para `table`. Além disso, atualizar o script global `js/components.js` para que seu `ResizeObserver` monitore também a tabela (`table`) interna ao container `.table-responsive`.
- **Prós**:
  - Limpo e reutilizável para todas as tabelas dinâmicas do sistema.
  - O visual do grid com bordas é herdado diretamente de `css/pedidos.css`.
  - A scrollbar se adapta automaticamente quando a tabela é preenchida via AJAX sem precisar de acoplamento direto no arquivo `js/funcionarios.js`.
- **Contras**: Nenhuma desvantagem significativa.

### Abordagem 2
- **Implementação**: Fazer a mudança visual no HTML, mas em vez de atualizar o `ResizeObserver`, acoplar uma chamada direta de re-inicialização (`window.initCustomScrollbars()`) toda vez que a tabela de funcionários for renderizada em `js/funcionarios.js`.
- **Prós**: Resolve o problema de atualização imediata da barra ao carregar funcionários.
- **Contras**:
  - Adiciona acoplamento rígido de lógica de renderização de scroll no módulo de dados dos funcionários.
  - Se houver outras tabelas assíncronas no futuro, cada uma precisará chamar a inicialização manualmente.

---

## Detalhes do Design

### Arquitetura de Componentes
A tabela de funcionários `#employeeTable` passa a ter a mesma estrutura de Auditoria:
```
[table-scroll-wrapper] (Gerado pelo initCustomScrollbars)
  ├── [table-responsive] (Overflow-y auto, scrollbar nativa oculta)
  │     └── [table] (Grid, bordas cinzas, cabeçalho #f8fafc)
  └── [table-custom-scrollbar] (Barra flutuante absoluta no hover)
        └── [table-custom-scrollbar-thumb] (Cursor arrastável)
```
Ao monitorar a tabela com `ResizeObserver`, qualquer mudança de tamanho na tabela interna disparará `updateThumb()`, garantindo que a scrollbar sempre exiba o tamanho correto.
