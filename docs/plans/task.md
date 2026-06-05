# Task: Padronização de Tabelas (Grid) e Scrollbars

- [x] Criar/ajustar estilos globais em `css/pedidos.css` para a classe `.table` padrão e `.table-responsive`
- [x] Aplicar estilo customizado de scrollbar invisível/hover em `.table-responsive`
- [x] Aplicar grid e scrollbar customizado na tabela de Funcionários
- [x] Aplicar grid e scrollbar customizado na tabela de Pacientes
- [x] Aplicar grid e scrollbar customizado nas tabelas de Estoque Geral (Lotes e Inventário)
- [x] Ajustar altura máxima (`max-height: calc(100vh - 430px)`) nas tabelas de Inventário Geral e Pacientes para evitar cortes na paginação
- [x] Corrigir bug matemático de arrasto (`drag`) da scrollbar customizada no `js/components.js` usando `scrollbar.clientHeight`
- [x] Validar as tabelas em Auditoria, Pedidos, Relatórios, Funcionários, Pacientes e Estoque (Compilação do build validada com sucesso; testes funcionais delegados ao usuário)
- [x] Corrigir precisão e fim de curso no arrasto do scrollbar customizado usando posicionamento absoluto do cursor em js/components.js
- [x] Aplicar layout estrutural Flexbox dinâmico nas seções de Inventário, Pacientes e Funcionários em app.html
- [x] Limitar a altura da tabela de Auditoria para exibir cerca de 7 linhas (height: 470px) em app.html
- [x] Ajustar wrapper do scrollbar customizado para suportar flexbox dinamicamente em js/components.js
- [x] Adicionar cargo ACS em Funcionários com campo obrigatório de Microárea (1-6) e restrição de acesso total no painel
- [x] Substituir campo único de telefones por 4 campos individuais (1 obrigatório, 3 opcionais) em Pacientes no HTML e JS
- [x] Centralizar coluna de concentração nas tabelas de relatórios analíticos (Controle de Validade e CMM) no HTML e JS
- [x] Corrigir comportamento de duplo toggle na sidebar responsiva (mobile) ao remover onclick redundantes ou ajustar JS
