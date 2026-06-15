# Design Document: Integração RNDS (Frontend)

## Visão Geral
O sistema precisará integrar-se à RNDS (Rede Nacional de Dados em Saúde) para o envio do Registro de Dispensação de Medicamentos (RDM) e para a consulta do histórico clínico/receituário dos pacientes. A arquitetura escolhida define que o backend em Java lidará com toda a complexidade estrutural (FHIR) e de segurança (mTLS/Certificado ICP-Brasil). O frontend será responsável apenas pela orquestração da UX/UI consumindo as novas APIs.

## Abordagem de UX (Híbrida)
Considerando o histórico de instabilidades da RNDS/ConecteSUS, foi aprovada a **Abordagem Híbrida**:
1. O envio da dispensação é disparado automaticamente de forma síncrona/assíncrona ao concluir a dispensação no backend.
2. Em caso de falha de comunicação com o Ministério da Saúde, o usuário verá um feedback visual no Histórico de Dispensações, permitindo o re-envio manual.
3. A consulta de dados (histórico do paciente) será puramente sob demanda, para evitar atrasos no carregamento do perfil do paciente.

## Modificações Visuais e Fluxos

### 1. Histórico de Dispensações (`dashboard.js` / `home.js`)
- **Nova Coluna/Ícone de Status RNDS:** 
  Na listagem do histórico de dispensações, cada linha receberá um indicador visual (badge ou ícone) com os seguintes estados:
  - `Sincronizado` (Verde)
  - `Pendente/Falha` (Vermelho)
  - `Não Elegível` (Cinza, se aplicável)
- **Ação de Retentativa:**
  Caso o status seja "Falha", um botão de "Re-enviar para RNDS" ficará visível. Ao clicar, o sistema chama o endpoint `/api/rnds/dispensations/{id}/sync` e atualiza a interface.

### 2. Finalização de Dispensação (`dashboard.js`)
- **Integração Invisível no Sucesso:**
  Na chamada de `finalizeDispensation`, a resposta do backend deve trazer um flag de `rndsStatus`. O toast de sucesso pode ser estendido: *"Dispensação concluída e sincronizada com a RNDS!"* ou *"Dispensação concluída (Falha na RNDS - tente novamente mais tarde)"*.

### 3. Perfil do Paciente (`patient.js`)
- **Botão de Consulta RNDS:**
  Adicionar um botão de destaque secundário ou primário com o logotipo do SUS ou ícone de conectividade (ex: `fa-solid fa-cloud-arrow-down`) na área de dados principais do paciente. Label: "Consultar Histórico na RNDS".
- **Modal de Histórico RNDS (`#modalRNDSHistory`):**
  Ao clicar no botão, uma chamada é feita à API `/api/rnds/patients/{id}/history`. Um modal se abrirá exibindo uma tabela ou linha do tempo com:
  - Medicamento / Produto
  - Data de Dispensação / Prescrição
  - Origem (Estabelecimento de Saúde)
  - Responsável

## Endpoints Esperados (Contrato Backend)
Embora estejamos focados no frontend, esperamos que o backend proveja:
- `POST /api/dispensations` (modificado para tentar enviar à RNDS no ato).
- `POST /api/rnds/dispensations/{id}/sync` (para re-tentativas manuais).
- `GET /api/rnds/patients/{id}/history` (para buscar o histórico FHIR em formato legível para o frontend).

## Próximos Passos
Invocar a skill `writing-plans` para converter este design document em um Plano de Implementação (Implementation Plan) acionável para o Antigravity.
