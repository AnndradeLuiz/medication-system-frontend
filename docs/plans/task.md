# Checklist de Refatoração

| Status | Descrição | Arquivo |
| :---: | --- | --- |
| [x] | Deletar `app.html` monolítico obsoleto | `app.html` |
| [x] | Incluir `src/utils/formatters.js` no `index.html` | `index.html` |
| [x] | Mover funções de CPF para `formatters.js` e remover duplicações | `components.js`, `dashboard.js`, `funcionarios.js` |
| [x] | Refatorar lógica duplicada do construtor de receitas | `patient.js` |
| [x] | Criar cliente de API centralizado | `src/services/api.js` |
| [ ] | Substituir `fetch` isolados pelo novo cliente de API | Diversos scripts |
