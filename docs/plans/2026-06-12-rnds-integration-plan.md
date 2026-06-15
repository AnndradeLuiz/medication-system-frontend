# Integração RNDS - Modelo de Informação RDM (Frontend) Implementation Plan

> **For Antigravity:** REQUIRED WORKFLOW: Use `.agent/workflows/execute-plan.md` to execute this plan in single-flow mode.

**Goal:** Adicionar os campos estruturais exigidos pelo Modelo de Informação de Registro de Dispensação de Medicamentos (RDM) da RNDS à interface de Registro de Dispensação do sistema.

**Architecture:** Modificaremos o layout HTML (`app.html`) para incluir os blocos de dados de "Prescrição" (globais para o atendimento) e "Posologia" (por medicamento). O JavaScript (`dashboard.js`) será atualizado para capturar, validar e anexar esses novos campos ao JSON (`payload`) submetido em `finalizeDispensation`.

**Tech Stack:** Vanilla JS, HTML, CSS.

---

### Task 1: UI HTML Updates

**Files:**
- Modify: `c:\Users\luize\Desktop\Sistema de Medicamentos\front-end\app.html`

**Step 1: Adicionar Bloco de Prescrição**
No arquivo `app.html`, abaixo do `thirdPartySection`, criar uma nova `div` para capturar os dados da prescrição.
Campos a incluir: Data da Prescrição, Nome do Prescritor, Conselho, UF, Número do Conselho e CPF do Prescritor.

**Step 2: Adicionar Campos de Posologia**
No arquivo `app.html`, na área de inclusão de medicamentos (perto de `dispenseMedInput` e `medQuantity`), adicionar:
- Input Numérico: Duração (Dias)
- Input Texto: Orientações de Uso

### Task 2: JavaScript Logic Updates

**Files:**
- Modify: `c:\Users\luize\Desktop\Sistema de Medicamentos\front-end\js\dashboard.js`

**Step 1: Modificar addItemDispensation**
Ler os valores de Duração e Orientações, validá-los opcionalmente, e adicioná-á-los ao objeto inserido em `requestItems`.

**Step 2: Modificar updateTable**
Atualizar o template HTML gerado na tabela para exibir um pequeno subtítulo ou badge caso o medicamento possua orientações de uso e duração (ex: *10 dias - Tomar 1cp ao dia*).

**Step 3: Modificar finalizeDispensation**
Ler os valores do novo bloco de Prescrição. Validar se os preenchidos fazem sentido (ex: UF com 2 letras). Montar um objeto `prescriptionData`.
Modificar a criação do payload para injetar `prescriptionData` e garantir que o loop `itemsForBackend` repasse os atributos `duration` e `instructions`.
