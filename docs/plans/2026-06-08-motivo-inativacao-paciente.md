# Plano de Implementação: Motivo de Inativação de Pacientes (Enum)

Este plano detalha a inclusão de um campo de motivo de inativação (`InactivationReasonEnum`) na entidade de Paciente no back-end (Java/Spring Boot) de forma complementar ao campo de `status` atual, e os ajustes de interface e consistência automática no front-end e back-end.

---

## Proposed Changes

### Back-end (medication-system)

#### [NEW] [InactivationReasonEnum.java](file:///c:/Users/luize/Desktop/Sistema%20de%20Medicamentos/medication-system/src/main/java/com/luiz/medication_system/dominio/enums/InactivationReasonEnum.java)
* Criar um novo enum contendo as causas padrão de inativação no SUS:
  * `DEATH` (Óbito)
  * `TERRITORY_CHANGE` (Mudança de Território)
  * `DUPLICATE_REGISTER` (Cadastro Duplicado)
  * `ADMINISTRATIVE_BLOCK` (Bloqueio Administrativo)
  * `OTHER` (Outros)

#### [MODIFY] [Patient.java](file:///c:/Users/luize/Desktop/Sistema%20de%20Medicamentos/medication-system/src/main/java/com/luiz/medication_system/dominio/Patient.java)
* Adicionar a propriedade `private InactivationReasonEnum inactivationReason;` na classe de modelo do paciente.
* Incluir os métodos getters e setters correspondentes.

#### [MODIFY] [PatientService.java](file:///c:/Users/luize/Desktop/Sistema%20de%20Medicamentos/medication-system/src/main/java/com/luiz/medication_system/services/PatientService.java)
* **Consistência de Segurança:** Na lógica de cadastro e atualização (métodos `insert` e `update`), adicionar a validação de segurança:
  * Se o status do paciente for Ativo (`status == true`), forçar o valor de `inactivationReason` para `null` antes de persistir no MongoDB, garantindo que não haja inconsistência de dados.

---

### Front-end (front-end)

#### [MODIFY] [app.html](file:///c:/Users/luize/Desktop/Sistema%20de%20Medicamentos/front-end/app.html)
* No modal de visualização e edição de paciente (`patientModal`), adicionar no formulário de edição um contêiner `<div id="editInactivationReasonGroup">` contendo o select do motivo com as opções em português:
  * Óbito
  * Mudança de Território
  * Cadastro Duplicado
  * Bloqueio Administrativo
  * Outros
* No layout de visualização (`viewMode`), adicionar um campo `<span id="viewInactivationReason">` para renderizar o motivo de forma amigável ao lado do status quando o paciente estiver inativo.

#### [MODIFY] [patient.js](file:///c:/Users/luize/Desktop/Sistema%20de%20Medicamentos/front-end/js/patient.js)
* **Visualização:** Atualizar `openPatientModal()` para que, caso o paciente tenha `status == false`, exiba o motivo de inativação traduzido para português ao lado do status "Inativo".
* **Edição (Inicialização):** Em `enableEditMode()`, carregar o valor de `patient.inactivationReason` no select de edição. Se o status inicial for ativo, esconder o contêiner do select.
* **Comportamento Interativo:** Adicionar um event listener ao checkbox de status (`editStatus`) na edição do paciente:
  * Se o usuário marcar como **Ativo**, o contêiner de motivo de inativação é ocultado imediatamente.
  * Se o usuário desmarcar (ficar **Inativo**), o contêiner de motivo de inativação é exibido e focado.
* **Salvar:** No método `savePatientEdit()`:
  * Se o status for ativo (`editStatus.checked == true`), incluir `inactivationReason: null` no payload de atualização.
  * Se o status for inativo, capturar o valor selecionado no select do motivo e incluir no payload.

---

## Verification Plan

### Automated Tests
* Compilar e rodar o back-end usando `./mvnw.cmd clean compile` (se o ambiente local permitir) para verificar integridade sintática do Java.

### Manual Verification
1. Abrir a aplicação, acessar a lista de pacientes e clicar em um paciente ativo para editar.
2. Desmarcar o checkbox "Paciente Ativo no Sistema" e verificar se o select de "Motivo da Inativação" aparece na tela instantaneamente.
3. Escolher um motivo (ex: "Mudança de Território") e salvar a edição.
4. Validar se na listagem de busca o status aparece como `Inativo (Mudança de Território)`.
5. Reabrir a edição do mesmo paciente, marcar o checkbox "Paciente Ativo no Sistema" novamente (o select de motivo deve sumir) e salvar.
6. Confirmar se o paciente voltou a ficar ativo e se o motivo foi limpo no banco de dados MongoDB.
