import { API_URL } from './config.js';

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const dispensationId = urlParams.get('id');

    const loadingSection = document.getElementById('loadingSection');
    const resultSection = document.getElementById('resultSection');

    if (!dispensationId) {
        showError("ID da dispensação não fornecido no link.");
        return;
    }

    try {
        // Tentamos buscar a dispensação, sem enviar token de autorização, 
        // já que o endpoint deveria ser público ou acessível para validação.
        // Se a API exigir Auth para esse endpoint, a API precisará de ajustes 
        // para permitir validação pública, mas vamos testar assim primeiro.
        const response = await fetch(`${API_URL}/dispensations/${dispensationId}`);

        if (response.ok) {
            const data = await response.json();
            showSuccess(data);
        } else if (response.status === 404) {
            showError("Documento não encontrado ou ID inválido.");
        } else {
            showError("Não foi possível validar o documento no momento.");
        }
    } catch (error) {
        console.error("Erro na validação:", error);
        showError("Erro de conexão ao tentar validar o documento.");
    }

    function showSuccess(data) {
        loadingSection.classList.add('d-none');
        resultSection.classList.remove('d-none');

        const dateObj = new Date(data.moment);
        const formattedDate = dateObj.toLocaleDateString('pt-BR') + ' às ' + dateObj.toLocaleTimeString('pt-BR');

        let itemsHtml = '';
        if (data.items && data.items.length > 0) {
            itemsHtml = data.items.map(item => `
                <div class="item-row">
                    <div>
                        <strong>${item.activeIngredient || 'Medicamento'}</strong>
                        <br><span style="font-size: 0.85em; color: var(--color-text-muted);">${item.concentration || ''} (Lote: ${item.lotCode || '-'})</span>
                    </div>
                    <div style="font-weight: 600;">${item.quantity} un</div>
                </div>
            `).join('');
        } else {
            itemsHtml = '<p>Nenhum item detalhado.</p>';
        }

        const patientName = data.targetPatient ? data.targetPatient.name : 'Não Informado';
        const profName = data.Practitioner ? data.Practitioner.name : 'Não Informado';

        resultSection.innerHTML = `
            <i class="fa-solid fa-circle-check status-icon status-valid"></i>
            <h2 class="validation-title" style="color: var(--color-success);">Documento Válido</h2>
            <p>Este comprovante de dispensação é autêntico e foi emitido pelo sistema <strong>e-Farma SUS</strong>.</p>
            
            <div class="details-box">
                <p><strong>Paciente:</strong> ${patientName}</p>
                <p><strong>Data de Emissão:</strong> ${formattedDate}</p>
                <p><strong>Dispensado por:</strong> ${profName}</p>
                
                <h4 style="margin-top: 15px; margin-bottom: 10px;">Itens Dispensados:</h4>
                <div class="items-list">
                    ${itemsHtml}
                </div>
            </div>
        `;
    }

    function showError(message) {
        loadingSection.classList.add('d-none');
        resultSection.classList.remove('d-none');

        resultSection.innerHTML = `
            <i class="fa-solid fa-circle-xmark status-icon status-invalid"></i>
            <h2 class="validation-title" style="color: var(--color-danger);">Documento Inválido</h2>
            <p>${message}</p>
            <p style="margin-top: 15px; font-size: 0.9em; color: var(--color-text-muted);">
                Por favor, verifique se o link ou QR Code foi lido corretamente. Em caso de dúvidas, contate a unidade de saúde.
            </p>
        `;
    }
});
