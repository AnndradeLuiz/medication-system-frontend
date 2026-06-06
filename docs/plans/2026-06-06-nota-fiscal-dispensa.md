# Impressão de Recibo da Dispensação Implementation Plan

> **For Antigravity:** REQUIRED WORKFLOW: Use `.agent/workflows/execute-plan.md` to execute this plan in single-flow mode.

**Goal:** Adicionar um botão "Imprimir Nota" no modal de resumo da dispensação que gera um recibo/comprovante de dispensação formatado e abre a janela de impressão do navegador.

**Architecture:** 
1. Adicionar o botão no rodapé do modal `dispensationSummaryModal` no arquivo `app.html`.
2. Armazenar os dados da última dispensação realizada com sucesso no escopo global/módulo do arquivo `js/dashboard.js`.
3. Criar a função `printDispensationReceipt()` que gera o layout de impressão em HTML com estilos inline limpos e dispara a impressão nativa.

**Tech Stack:** HTML5, CSS3, JavaScript (ES6)

---

### Task 1: Adicionar Botão "Imprimir Nota" em app.html

**Files:**
- Modify: `c:/Users/luize/Desktop/Sistema de Medicamentos/front-end/app.html`

**Step 1: Adicionar o botão**
Adicionar o botão de impressão antes do botão "Concluir e Fechar" no modal `dispensationSummaryModal`.

```html
                            <div class="modal-footer d-flex justify-end p-20"
                                style="border-top: 1px solid var(--color-border); padding: 20px;">
                                <button onclick="printDispensationReceipt()"
                                    class="btn-success-outline d-flex align-center gap-8 mr-10"
                                    style="margin-right: 10px; background: transparent; border: 1.5px solid #22c55e; color: #15803d; border-radius: 6px; padding: 8px 16px; font-weight: 600; cursor: pointer; transition: all 0.2s;">
                                    <i class="fa-solid fa-print"></i> Imprimir Nota
                                </button>
                                <button onclick="closeDispensationSummary()"
                                    class="btn btn-primary d-flex align-center gap-8">
                                    <i class="fa-solid fa-check"></i> Concluir e Fechar
                                </button>
                            </div>
```

---

### Task 2: Implementar Variável e Função de Impressão em js/dashboard.js

**Files:**
- Modify: `c:/Users/luize/Desktop/Sistema de Medicamentos/front-end/js/dashboard.js`

**Step 1: Declarar variável global no módulo**
Adicionar `let lastDispensationResponse = null;` no início ou escopo do módulo para guardar os dados.

**Step 2: Salvar os dados em `showDispensationSummary`**
```javascript
function showDispensationSummary(data) {
    lastDispensationResponse = data;
    // ... restante da lógica existente ...
}
```

**Step 3: Implementar a função `printDispensationReceipt()`**
```javascript
window.printDispensationReceipt = function () {
    if (!lastDispensationResponse) {
        showToast("Nenhum dado de dispensação encontrado para imprimir.", "error");
        return;
    }
    
    const data = lastDispensationResponse;
    const patientName = currentDispensePatientData ? currentDispensePatientData.name : "Não Informado";
    const patientCpf = currentDispensePatientData && currentDispensePatientData.cpf ? currentDispensePatientData.cpf : "Não Informado";
    const patientCns = currentDispensePatientData && currentDispensePatientData.cns ? currentDispensePatientData.cns : "Não Informado";
    
    // Formata a data/hora
    const momentDate = data.moment ? new Date(data.moment).toLocaleString('pt-BR') : new Date().toLocaleString('pt-BR');
    
    let itemsHtml = '';
    if (data.items && data.items.length > 0) {
        data.items.forEach(item => {
            itemsHtml += `
                <tr style="border-bottom: 1px solid #e2e8f0;">
                    <td style="padding: 10px 0; font-weight: 600; color: #1e293b;">${item.medicationName} (${item.concentration})</td>
                    <td style="padding: 10px 0; text-align: center; font-family: monospace; color: #0284c7;">${item.lotCode || '-'}</td>
                    <td style="padding: 10px 0; text-align: right; font-weight: 700; color: #ea580c;">${item.quantity} un</td>
                </tr>
            `;
        });
    }

    let thirdPersonHtml = '';
    if (data.thirdPerson) {
        thirdPersonHtml = `
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px; margin-top: 15px; font-size: 14px;">
                <h4 style="margin: 0 0 8px 0; color: #0f172a; font-size: 14px;"><i class="fa-solid fa-user-check"></i> Retirado por (Retirante)</h4>
                <p style="margin: 3px 0;"><strong>Nome:</strong> ${data.thirdPerson.name}</p>
                <p style="margin: 3px 0;"><strong>CPF:</strong> ${data.thirdPerson.cpf}</p>
                <p style="margin: 3px 0;"><strong>Vínculo/Obs:</strong> ${data.thirdPerson.observation || '-'}</p>
            </div>
        `;
    }

    const receiptHtml = `
        <html>
        <head>
            <title>Recibo de Dispensação - ${patientName}</title>
            <style>
                body { font-family: 'Inter', sans-serif; color: #334155; margin: 20px; line-height: 1.5; }
                .receipt-container { max-width: 600px; margin: auto; border: 1px solid #e2e8f0; border-radius: 8px; padding: 25px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); }
                .header { text-align: center; border-bottom: 2px solid #3b82f6; padding-bottom: 15px; margin-bottom: 20px; }
                .header h2 { margin: 0; color: #1e3a8a; font-size: 22px; }
                .header p { margin: 5px 0 0 0; font-size: 13px; color: #64748b; }
                .section-title { font-weight: 700; text-transform: uppercase; font-size: 13px; color: #475569; letter-spacing: 0.5px; border-bottom: 1px solid #cbd5e1; padding-bottom: 5px; margin-top: 20px; margin-bottom: 10px; }
                .grid-info { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 14px; }
                .info-item { margin-bottom: 6px; }
                .table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 14px; }
                .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-top: 50px; text-align: center; font-size: 13px; }
                .sig-line { border-top: 1px solid #94a3b8; margin-top: 40px; padding-top: 5px; }
                @media print {
                    body { margin: 0; }
                    .receipt-container { border: none; box-shadow: none; padding: 0; }
                    button { display: none; }
                }
            </style>
        </head>
        <body>
            <div class="receipt-container">
                <div class="header">
                    <h2>e-Farma SUS</h2>
                    <p>Recibo de Dispensação de Medicamentos</p>
                </div>
                
                <div class="section-title">Dados do Atendimento</div>
                <div class="grid-info">
                    <div class="info-item"><strong>ID da Dispensa:</strong> ${data.id}</div>
                    <div class="info-item"><strong>Data/Hora:</strong> ${momentDate}</div>
                    <div class="info-item" style="grid-column: span 2;"><strong>Dispensador por:</strong> ${data.employee ? data.employee.name : "Operador do Sistema"}</div>
                </div>

                <div class="section-title">Dados do Paciente</div>
                <div class="grid-info">
                    <div class="info-item" style="grid-column: span 2;"><strong>Nome:</strong> ${patientName}</div>
                    <div class="info-item"><strong>CPF:</strong> ${patientCpf}</div>
                    <div class="info-item"><strong>CNS:</strong> ${patientCns}</div>
                </div>

                ${thirdPersonHtml}

                <div class="section-title">Medicamentos Entregues</div>
                <table class="table">
                    <thead>
                        <tr style="border-bottom: 2px solid #cbd5e1; text-align: left; font-size: 12px; color: #64748b;">
                            <th style="padding-bottom: 8px;">Item / Concentração</th>
                            <th style="padding-bottom: 8px; text-align: center;">Lote</th>
                            <th style="padding-bottom: 8px; text-align: right;">Quantidade</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsHtml}
                    </tbody>
                </table>

                <div class="signatures">
                    <div>
                        <div class="sig-line">Assinatura do Recebedor</div>
                    </div>
                    <div>
                        <div class="sig-line">Dispensador / UBS</div>
                    </div>
                </div>
            </div>
            <script>
                window.onload = function() {
                    window.print();
                };
            </script>
        </body>
        </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
        printWindow.document.write(receiptHtml);
        printWindow.document.close();
    } else {
        showToast("Erro ao abrir janela de impressão. Por favor, libere os pop-ups para este site.", "warning");
    }
};
```

---

### Task 3: Build e Testes Unitários/Funcionais

**Files:**
- Modify: N/A

**Step 1: Recompilar e rodar build**
Executar o build para atualizar o frontend empacotado.
Run: `npm run build`
Cwd: `c:/Users/luize/Desktop/Sistema de Medicamentos/front-end`
