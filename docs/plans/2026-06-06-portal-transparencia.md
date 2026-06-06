# Portal da Transparência Implementation Plan

> **For Antigravity:** REQUIRED WORKFLOW: Use `.agent/workflows/execute-plan.md` to execute this plan in single-flow mode.

**Goal:** Criar um portal da transparência isolado para validação pública de recibos de medicamentos através de um QR Code gerado no PDF.

**Architecture:** O backend do Spring Boot irá gerar QR Codes e expor APIs públicas com validação de reCAPTCHA v3 do Google. O frontend do portal público será uma aplicação estática e independente.

**Tech Stack:** Java 21, Spring Boot, OpenHTMLtoPDF, zxing (QR Code), Vanilla HTML/JS/CSS (Vite).

---

### Task 1: Backend - Adicionar Dependência de QR Code (ZXing)
Adicionar biblioteca ZXing ao `pom.xml` para permitir a geração de QR Codes no backend.

**Files:**
* Modify: `c:/Users/luize/Desktop/Sistema de Medicamentos/medication-system/pom.xml`

**Step 1: Write the failing test**
Neste passo, criaremos um teste simples que tenta instanciar o gerador de QRCode do ZXing. O teste falhará porque a dependência ainda não foi adicionada.
* Create: `c:/Users/luize/Desktop/Sistema de Medicamentos/medication-system/src/test/java/com/luiz/medication_system/services/QrCodeServiceTest.java`

```java
package com.luiz.medication_system.services;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

public class QrCodeServiceTest {
    @Test
    public void testQrCodeGenerationImports() {
        // Tenta usar uma classe do zxing
        assertNotNull(com.google.zxing.qrcode.QRCodeWriter.class);
    }
}
```

**Step 2: Run test to verify it fails**
Run: `mvn test -Dtest=QrCodeServiceTest`
Expected: FAIL (Compilation error: package com.google.zxing does not exist)

**Step 3: Write minimal implementation**
Adicionar a dependência no `pom.xml`:
```xml
<dependency>
    <groupId>com.google.zxing</groupId>
    <artifactId>core</artifactId>
    <version>3.5.3</version>
</dependency>
<dependency>
    <groupId>com.google.zxing</groupId>
    <artifactId>javase</artifactId>
    <version>3.5.3</version>
</dependency>
```

**Step 4: Run test to verify it passes**
Run: `mvn test -Dtest=QrCodeServiceTest`
Expected: PASS

**Step 5: Commit**
```bash
git add pom.xml src/test/java/com/luiz/medication_system/services/QrCodeServiceTest.java
git commit -m "chore: add zxing dependency for QR code generation"
```

---

### Task 2: Backend - Criar QrCodeService para Gerar Imagens de QR Code
Criar o serviço responsável por gerar o QR Code em formato Base64 para ser embutido no HTML do PDF.

**Files:**
* Create: `c:/Users/luize/Desktop/Sistema de Medicamentos/medication-system/src/main/java/com/luiz/medication_system/services/QrCodeService.java`
* Modify: `c:/Users/luize/Desktop/Sistema de Medicamentos/medication-system/src/test/java/com/luiz/medication_system/services/QrCodeServiceTest.java`

**Step 1: Write the failing test**
Adicionar teste que verifica se uma String de URL gera um QR Code em Base64 não-nulo e que começa com o prefixo de imagem png correspondente.
```java
    @Test
    public void testGenerateQrCodeBase64() throws Exception {
        QrCodeService service = new QrCodeService();
        String base64 = service.generateQrCodeBase64("https://exemplo.com/validar?id=123", 150, 150);
        assertNotNull(base64);
        assertTrue(base64.startsWith("data:image/png;base64,"));
    }
```

**Step 2: Run test to verify it fails**
Run: `mvn test -Dtest=QrCodeServiceTest`
Expected: FAIL (method generateQrCodeBase64 doesn't exist)

**Step 3: Write minimal implementation**
Implementar o método `generateQrCodeBase64` na classe `QrCodeService`:
```java
package com.luiz.medication_system.services;

import com.google.zxing.BarcodeFormat;
import com.google.zxing.client.j2se.MatrixToImageWriter;
import com.google.zxing.common.BitMatrix;
import com.google.zxing.qrcode.QRCodeWriter;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.util.Base64;

@Service
public class QrCodeService {
    public String generateQrCodeBase64(String text, int width, int height) throws Exception {
        QRCodeWriter qrCodeWriter = new QRCodeWriter();
        BitMatrix bitMatrix = qrCodeWriter.encode(text, BarcodeFormat.QR_CODE, width, height);
        ByteArrayOutputStream pngOutputStream = new ByteArrayOutputStream();
        MatrixToImageWriter.writeToStream(bitMatrix, "PNG", pngOutputStream);
        byte[] pngData = pngOutputStream.toByteArray();
        return "data:image/png;base64," + Base64.getEncoder().encodeToString(pngData);
    }
}
```

**Step 4: Run test to verify it passes**
Run: `mvn test -Dtest=QrCodeServiceTest`
Expected: PASS

**Step 5: Commit**
```bash
git add src/main/java/com/luiz/medication_system/services/QrCodeService.java src/test/java/com/luiz/medication_system/services/QrCodeServiceTest.java
git commit -m "feat: implement QrCodeService for Base64 QR code generation"
```

---

### Task 3: Backend - Adicionar QR Code no PDF do Recibo
Modificar o template Thymeleaf do recibo de dispensa para incluir a imagem do QR Code no rodapé e passar a variável contendo o QR Code gerado pelo `QrCodeService`.

**Files:**
* Modify: `c:/Users/luize/Desktop/Sistema de Medicamentos/medication-system/src/main/resources/templates/dispensation-receipt.html`
* Modify: `c:/Users/luize/Desktop/Sistema de Medicamentos/medication-system/src/main/java/com/luiz/medication_system/services/PdfReportService.java`

**Step 1: Write the failing test**
Modificar o teste do PDF para assegurar que ele processa a variável `qrCode` no contexto.
* Modify: `c:/Users/luize/Desktop/Sistema de Medicamentos/medication-system/src/test/java/com/luiz/medication_system/services/PdfReportServiceTest.java` (Criar se não existir)

**Step 2: Run test to verify it fails**
Run: `mvn test -Dtest=PdfReportServiceTest`
Expected: FAIL

**Step 3: Write minimal implementation**
* Adicionar a chamada do `QrCodeService` dentro de `PdfReportService` e passar o resultado para o contexto do Thymeleaf com a chave `qrCode`.
* No HTML do template, adicionar: `<img th:src="${qrCode}" alt="QR Code de Validação" style="width:120px;height:120px;"/>` no rodapé.

**Step 4: Run test to verify it passes**
Run: `mvn test -Dtest=PdfReportServiceTest`
Expected: PASS

**Step 5: Commit**
```bash
git add src/main/resources/templates/dispensation-receipt.html src/main/java/com/luiz/medication_system/services/PdfReportService.java
git commit -m "feat: embed QR Code in dispensation receipt PDF template"
```

---

### Task 4: Backend - Implementar Endpoint Público de Validação com reCAPTCHA
Criar os endpoints públicos `/api/public/dispensations/validate` e `/api/public/dispensations/history` com validação de reCAPTCHA.

**Files:**
* Create: `c:/Users/luize/Desktop/Sistema de Medicamentos/medication-system/src/main/java/com/luiz/medication_system/resources/PublicDispensationResource.java`
* Create: `c:/Users/luize/Desktop/Sistema de Medicamentos/medication-system/src/main/java/com/luiz/medication_system/services/RecaptchaService.java`

**Step 1: Write failing tests for validation logic**
Testar se a validação retorna 400 em caso de dados incorretos ou captcha inválido.

**Step 2: Run tests to verify they fail**
Expected: FAIL

**Step 3: Write implementation**
* Implementar o `RecaptchaService` enviando requisições REST para a API do Google.
* Criar a lógica do endpoint conferindo o CPF e Data de Nascimento do paciente associado à dispensa.

**Step 4: Run tests to verify they pass**
Expected: PASS

**Step 5: Commit**
```bash
git commit -m "feat: implement public endpoints for validation and history with reCAPTCHA"
```

---

### Task 5: Frontend - Criar a Aplicação do Portal da Transparência (Front-end B)
Criar uma estrutura estática limpa usando HTML, CSS e Vanilla JS para a validação.

**Files:**
* Create: `c:/Users/luize/Desktop/Sistema de Medicamentos/front-end-transparencia/index.html`
* Create: `c:/Users/luize/Desktop/Sistema de Medicamentos/front-end-transparencia/style.css`
* Create: `c:/Users/luize/Desktop/Sistema de Medicamentos/front-end-transparencia/app.js`

**Step 1: Scaffold files**
Estruturar o projeto com o formulário de login (CPF + Data de Nascimento + Captcha) e a exibição estilizada do recibo e histórico.

**Step 2: Verification**
Testar o fluxo rodando localmente.
