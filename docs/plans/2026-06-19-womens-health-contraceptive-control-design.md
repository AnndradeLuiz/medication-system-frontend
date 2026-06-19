# Design: Controle de Anticoncepcionais e Saúde da Mulher

Este documento descreve a proposta de arquitetura, modelagem de dados e design visual para o novo requisito funcional de Saúde da Mulher e Controle de Anticoncepcionais.

---

## 1. Abordagens Propostas e Trade-offs

### Abordagem 1: Armazenamento embutido (`ContraceptiveInfo`) no Paciente (Recomendada)
- **Descrição**: No backend, a entidade `Patient` ganha os atributos de `gender` (MASCULINO, FEMININO, IGNORADO) e um objeto embutido opcional `contraceptiveInfo`.
- **Vantagens**: Organização e encapsulamento dos dados relacionados ao método contraceptivo. Evita poluir a classe `Patient` com campos avulsos. Perfeito para o MongoDB que lida muito bem com documentos aninhados.
- **Desvantagens**: Requer a criação de uma nova classe simples no backend Java (`ContraceptiveInfo.java`).

### Abordagem 2: Campos planos (flat) diretamente na entidade `Patient`
- **Descrição**: Todos os campos (como `usesContraceptive`, `contraceptiveMedicationId`, etc.) são adicionados como atributos diretos na classe `Patient`.
- **Vantagens**: Mapeamento extremamente direto e simples.
- **Desvantagens**: Polui o modelo de dados de pacientes masculinos ou ignorados com campos específicos de saúde feminina.

### Abordagem 3: Vinculação no array de inscrições de programas (`PatientEnrollment`)
- **Descrição**: O anticoncepcional é tratado puramente como um medicamento dentro do `PatientEnrollment` do programa `WOMENS_HEALTH` com metadados adicionais.
- **Vantagens**: Reutiliza a estrutura de programas de saúde existente.
- **Desvantagens**: Torna a modelagem muito complexa e difícil de consultar diretamente, pois os metadados do lote/método (data de aplicação, validade) teriam que ser injetados em um medicamento comum.

---

## 2. Design Técnico da Abordagem Recomendada (Abordagem 1)

### 2.1 Backend (Java & MongoDB)

1. **Enum de Gênero (`GenderEnum.java`)**:
   ```java
   public enum GenderEnum {
       MASCULINO,
       FEMININO,
       IGNORADO
   }
   ```

2. **Classe Embutida `ContraceptiveInfo.java`**:
   ```java
   public class ContraceptiveInfo implements Serializable {
       private Boolean active;
       private String medicationId;
       private String medicationName;
       private Instant appliedDate;
       private Integer durationDays;
       
       // Getters, Setters, Construtores
   }
   ```

3. **Modificações em `Patient.java`**:
   Adicionar os campos:
   ```java
   private GenderEnum gender; // MASCULINO, FEMININO, IGNORADO
   private ContraceptiveInfo contraceptiveInfo;
   ```

4. **Modificações em `PatientRequestDTO.java` e `PatientResponseDTO.java`**:
   Adicionar os campos correspondentes para tráfego via API.

5. **Modificações em `PatientService.java`**:
   Garantir a cópia dos novos campos do DTO para a entidade no método `fromDto` e `updateData`.

6. **Novo endpoint de Alertas de Contraceptivos**:
   Adicionar um endpoint em `PatientResource.java` (ou lógica de busca) para trazer pacientes com anticoncepcionais com vencimento próximo (antecedência configurável ou baseada nos 7-14 dias solicitados pelo usuário).

### 2.2 Frontend (HTML, CSS, JS)

1. **Campo Sexo (Gênero) no Cadastro/Edição de Paciente**:
   - Adicionar um dropdown select `<select id="newPatientGender">` com opções: Masculino, Feminino, Ignorado.
   - Idem para edição no modal (`editPatientGender`).

2. **Seção Condicional de Anticoncepcionais**:
   - No cadastro/edição, quando a categoria "Saúde da Mulher" (`WOMENS_HEALTH`) for selecionada **E** o gênero do paciente for `FEMININO`, exibir uma seção opcional: `"Paciente faz uso de algum método contraceptivo?"`.
   - Se ativada (checkbox), exibe:
     - Dropdown de métodos contraceptivos comuns (pré-cadastrados com sua duração padrão, ex: DIU de Cobre - 10 anos, Implanon - 3 anos, Injetável Trimestral - 3 meses, Injetável Mensal - 1 mês).
     - Campo de Data de Inserção/Aplicação.
     - Campo de Duração (auto-preenchido baseado no método, mas editável).

3. **Nova Seção "Saúde da Mulher" no Menu Lateral**:
   - Novo item de navegação no menu lateral.
   - Ao ser clicado, mudará o tema do sistema para rosa claro (injetando uma classe CSS no body como `.theme-womens-health` or modificando variáveis CSS customizadas de cores).
   - Tela com:
     - KPI Cards: "Total Mulheres Acompanhadas", "Contraceptivos Próximos ao Vencimento" (1-2 semanas), "Vencidos".
     - Tabela das pacientes com status dos métodos.
     - Ação de "Avisar via WhatsApp" (dispara chamada para `EvolutionApiService` via backend com um texto amigável formatado).

4. **Painel Geral (Home)**:
   - Adicionar um card KPI na Home mostrando o total de anticoncepcionais a vencer/vencidos. Ao clicar, redireciona o usuário para a seção "Saúde da Mulher".

---

## 3. Plano de Verificação

### Testes Manuais:
- Cadastrar paciente feminina e validar se o campo "Saúde da Mulher" permite configurar o anticoncepcional.
- Validar se para pacientes masculinos ou sem o programa ativo o campo fica oculto.
- Validar a transição do tema para rosa clarinho ao entrar na seção "Saúde da Mulher".
- Simular datas de vencimento curtas (ex: expirando em 5 dias) e testar o surgimento do alerta no painel e na tela de Saúde da Mulher.
- Testar o clique no botão de aviso via WhatsApp.
