# Insumos Dinâmicos por Categoria de Programa Implementation Plan

> **For Antigravity:** REQUIRED WORKFLOW: Use `.agent/workflows/execute-plan.md` to execute this plan in single-flow mode.

**Goal:** Dinamizar a classificação de insumos médicos vinculando-os a Programas Clínicos (como Saúde da Mulher), eliminando a lista rígida (hardcoded) do front-end e permitindo que novos insumos cadastrados no banco de dados sejam filtrados de forma 100% dinâmica.

**Architecture:** Adicionar o atributo `programCategory` (Enum) ao modelo e DTOs de `Supply` no backend Java. No front-end, adicionar o seletor de programas no cadastro e edição de insumos e refatorar o filtro de requisições de pedidos (`request.js`) para usar a categoria retornada da API.

**Tech Stack:** Java, Spring Boot, MongoDB, HTML, CSS, JavaScript.

---

### Task 1: Modificar Entidades e DTOs no Backend (medication-system)

**Files:**
- Modify: [Supply.java](file:///c:/Users/luize/Desktop/Sistema%20de%20Medicamentos/medication-system/src/main/java/com/luiz/medication_system/dominio/Supply.java)
- Modify: [SupplyRequestDTO.java](file:///c:/Users/luize/Desktop/Sistema%20de%20Medicamentos/medication-system/src/main/java/com/luiz/medication_system/dto/SupplyRequestDTO.java)
- Modify: [SupplyResponseDTO.java](file:///c:/Users/luize/Desktop/Sistema%20de%20Medicamentos/medication-system/src/main/java/com/luiz/medication_system/dto/SupplyResponseDTO.java)

**Ações:**
1. No `Supply.java`, adicionar o atributo `private ProgramCategoryEnum programCategory;` com os respectivos métodos getter/setter, e atualizar o construtor que recebe parâmetros de criação.
2. No `SupplyRequestDTO.java`, adicionar o campo `ProgramCategoryEnum programCategory` ao record.
3. No `SupplyResponseDTO.java`, adicionar o campo `ProgramCategoryEnum programCategory` ao record e mapear `supply.getProgramCategory()` no construtor.

---

### Task 2: Modificar Serviço de Insumos no Backend (medication-system)

**Files:**
- Modify: [MedicalSupplyService.java](file:///c:/Users/luize/Desktop/Sistema%20de%20Medicamentos/medication-system/src/main/java/com/luiz/medication_system/services/MedicalSupplyService.java)

**Ações:**
1. No método `fromDto` do `MedicalSupplyService.java`, associar `medicalDto.programCategory()` à entidade criada.
2. No método `updateData` do `MedicalSupplyService.java`, copiar a propriedade `programCategory` do objeto de atualização para o objeto persistido.

---

### Task 3: Modificar Interfaces de Cadastro e Edição no Frontend (front-end)

**Files:**
- Modify: [inventory.html](file:///c:/Users/luize/Desktop/Sistema%20de%20Medicamentos/front-end/src/pages/views/inventory.html)
- Modify: [inventory.js](file:///c:/Users/luize/Desktop/Sistema%20de%20Medicamentos/front-end/src/pages/scripts/inventory.js)

**Ações:**
1. No `inventory.html`, adicionar o campo select `Programa Clínico` dentro da div `#insumoFields` (cadastro) e dentro da div `#insumoFieldsEdit` (edição), permitindo associar insumos a programas (como `BASIC_PHARMACY` ou `WOMENS_HEALTH`).
2. No `inventory.js`:
   - No método `saveNewItem()`, incluir a categoria selecionada no payload para insumos.
   - No método `saveEdit()`, capturar a categoria selecionada e enviar no payload de atualização para insumos.
   - No método `selectItemToEdit()`, carregar e preencher o valor de `programCategory` no select correspondente se o item editado for um insumo.

---

### Task 4: Dinamizar os Filtros de Requisição no Frontend (front-end)

**Files:**
- Modify: [request.js](file:///c:/Users/luize/Desktop/Sistema%20de%20Medicamentos/front-end/src/pages/scripts/request.js)

**Ações:**
1. Remover a lista rígida `saudeMulherInsumos` do script de pedidos.
2. Alterar o filtro de `suppliesList` na seção de `saude-mulher`:
   - Filtrar insumos cujo `programCategory` seja `WOMENS_HEALTH` ou `SAUDE_DA_MULHER`.
3. Alterar o filtro de `suppliesList` na seção de Farmácia Básica (bloco `else`):
   - Excluir insumos que pertencem a categorias de programas especiais (ou seja, manter apenas os que não têm categoria de programa ou pertencem à `BASIC_PHARMACY`).

---

### Task 5: Verificação do Fluxo e Execução de Testes

**Ações:**
1. Recompilar e reiniciar os containers Docker do backend.
2. Criar um novo insumo de teste (ex: "Especulo Descartável") selecionando o programa "Saúde da Mulher".
3. Abrir a tela de Pedidos, selecionar o tipo "Saúde da Mulher / Rede Materna" e verificar se o novo insumo aparece listado dinamicamente nos insumos disponíveis para requisição.
