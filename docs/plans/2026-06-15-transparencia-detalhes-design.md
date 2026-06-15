# Design: Exibição Detalhada e Melhorias no Histórico de Dispensações (Portal de Transparência)

## Visão Geral
Este documento detalha o design para três aprimoramentos no Portal de Transparência (`front-end-transparencia`):
1. **Fallback de Funcionário**: Substituir "Sistema" por "e-Farma SUS".
2. **Gramática Dinâmica para Quantidades**: Exibir "unidade" no singular e "unidades" no plural.
3. **Visualização Completa em Modal**: Permitir que o usuário clique em uma dispensação no histórico para ver todos os detalhes (medicamentos, lotes, recebedor) em um modal moderno.

## Decisões de Design

### 1. Fallback de Funcionário
Para itens históricos onde o dispensador não possui nome registrado, exibiremos "e-Farma SUS" no lugar de "Sistema". Isso padroniza a interface com a marca do aplicativo.

### 2. Formatação Plural de Medicamentos
No JavaScript, onde a tabela e a listagem de histórico são montadas, adicionaremos lógica para verificar a quantidade:
`${item.quantity} ${item.quantity === 1 ? 'unidade' : 'unidades'}`.

### 3. Visualização Completa (Modal)
O usuário escolheu a abordagem do **Modal Elegante**.
*   **Arquitetura Visual**: Um fundo `backdrop-blur` escurece o portal de trás. O modal fica centralizado, com bordas arredondadas e sombras.
*   **Componentes**: 
    *   **Cabeçalho**: Título e botão de fechamento "×".
    *   **Grade de Informações Básicas**: Mostra Data, Dispensador e Terceiro Retirante (se aplicável).
    *   **Tabela de Medicamentos**: Lista os medicamentos dispensados com a mesma gramática dinâmica de unidades e as informações de lote de cada um.
*   **Interatividade**:
    *   Os itens de histórico (`.history-item`) receberão indicativo visual de que são interativos (cursor pointer, animação de hover).
    *   Usaremos *Delegação de Eventos* no contêiner `#history-list` para detectar o clique e abrir o modal correspondente, o que é mais performático.
