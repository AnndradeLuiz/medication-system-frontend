# Design: Portal da Transparência & Validação de Receitas

Este documento detalha o design da solução para a validação de recibos de dispensa de medicamentos através de um portal público de transparência.

## 1. Fluxo do Usuário (User Flow)
1. **Emissão:** O funcionário realiza a dispensa de medicamentos na aplicação interna. A API gera o recibo em PDF com um QR Code contendo um link único.
2. **Escaneamento:** O paciente (ou auditor) escaneia o QR Code, sendo direcionado para o Portal da Transparência com a URL contendo o ID da dispensa (ex: `/validar?id=ID_DISPENSA`).
3. **Validação:** Na tela pública, o usuário preenche o CPF e a Data de Nascimento do paciente. Um desafio Google reCAPTCHA v3 roda de forma invisível.
4. **Verificação:** A API do backend valida o token do reCAPTCHA e confirma a identidade do paciente cruzando com os dados do banco de dados.
5. **Apresentação:** Se válidos, exibe os medicamentos da dispensa na tela e a opção de visualizar o histórico completo de dispensas daquele CPF.

## 2. Arquitetura e Componentes

### 2.1. Backend API (Spring Boot)
* **Novas Rotas Públicas:**
  * `POST /api/public/dispensations/validate`: Valida a chave do reCAPTCHA e verifica os dados do paciente (CPF e Data de Nascimento) contra a dispensa do ID fornecido. Emite um token de sessão curto temporário em caso de sucesso.
  * `GET /api/public/dispensations/history`: Permite obter todas as dispensas daquele CPF, autenticado pelo token curto.
* **Integração reCAPTCHA:** Componente REST para se conectar ao endpoint `https://www.google.com/recaptcha/api/siteverify`.
* **Geração de QR Code:** Uso de biblioteca de geração de QR Code para anexar a imagem do link de validação no rodapé do HTML do recibo.

### 2.2. Portal de Transparência (Front-end B)
* Aplicação web estática e responsiva totalmente separada do sistema administrativo principal.
* Desenvolvida em Vanilla HTML/JS/CSS ou através de um esqueleto otimizado com Vite.
* Integração nativa com o reCAPTCHA v3 do Google.