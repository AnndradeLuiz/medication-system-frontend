(function () {
    let rawContraceptiveData = null;
    let activeFilter = 'all';
    const notifiedPatients = new Set();

    async function initWomensHealth() {
        document.body.classList.add('theme-womens-health');

        await loadWomensHealthData();

        const filterSelect = document.getElementById('whStatusFilter');
        if (filterSelect) {
            filterSelect.value = 'all';
        }
    }

    async function loadWomensHealthData() {
        try {
            const response = await window.apiClient.get('/patients/contraceptives/monitoring');
            rawContraceptiveData = response.data;

            updateMetrics(rawContraceptiveData);
            applyWomensHealthFilter();
        } catch (error) {
            console.error("Erro ao carregar dados de Saúde da Mulher:", error);
            if (window.showToast) {
                window.showToast("Erro ao carregar dados do monitoramento.", "danger");
            }
        }
    }

    function updateMetrics(data) {
        if (!data || !data.all) return;

        const totalEl = document.getElementById('whMetricTotal');
        const expiringEl = document.getElementById('whMetricExpiring');
        const expiredEl = document.getElementById('whMetricExpired');

        let totalCount = data.all.length;
        let expiringCount = 0;
        let expiredCount = 0;

        data.all.forEach(patient => {
            const info = patient.contraceptiveInfo;
            if (!info) return;
            const expirationDate = calculateExpirationDate(info.appliedDate, info.durationDays);
            const statusType = determineStatusType(expirationDate, info);
            if (statusType === 'expiring') {
                expiringCount++;
            } else if (statusType === 'expired') {
                expiredCount++;
            }
        });

        if (totalEl) totalEl.textContent = totalCount;
        if (expiringEl) expiringEl.textContent = expiringCount;
        if (expiredEl) expiredEl.textContent = expiredCount;
    }

    window.filterWomensHealth = function (filterType) {
        const filterSelect = document.getElementById('whStatusFilter');
        if (filterSelect) {
            filterSelect.value = filterType;
        }
        applyWomensHealthFilter();
    };

    window.applyWomensHealthFilter = function () {
        if (!rawContraceptiveData) return;

        const filterSelect = document.getElementById('whStatusFilter');
        const filterType = filterSelect ? filterSelect.value : 'all';
        activeFilter = filterType;

        let listToRender = [];
        if (filterType === 'all') {
            listToRender = rawContraceptiveData.all || [];
        } else if (filterType === 'expiring') {
            listToRender = rawContraceptiveData.all ? rawContraceptiveData.all.filter(patient => {
                const info = patient.contraceptiveInfo;
                if (!info) return false;
                const expirationDate = calculateExpirationDate(info.appliedDate, info.durationDays);
                return determineStatusType(expirationDate, info) === 'expiring';
            }) : [];
        } else if (filterType === 'expired') {
            listToRender = rawContraceptiveData.all ? rawContraceptiveData.all.filter(patient => {
                const info = patient.contraceptiveInfo;
                if (!info) return false;
                const expirationDate = calculateExpirationDate(info.appliedDate, info.durationDays);
                return determineStatusType(expirationDate, info) === 'expired';
            }) : [];
        } else if (filterType === 'regular') {
            listToRender = rawContraceptiveData.all ? rawContraceptiveData.all.filter(patient => {
                const info = patient.contraceptiveInfo;
                if (!info) return false;
                const expirationDate = calculateExpirationDate(info.appliedDate, info.durationDays);
                return determineStatusType(expirationDate, info) === 'regular';
            }) : [];
        }

        renderTable(listToRender);
    };

    function renderTable(list) {
        const tbody = document.getElementById('womensHealthTableBody');
        if (!tbody) return;

        tbody.innerHTML = '';

        if (!list || list.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="empty-msg">Nenhuma paciente encontrada com o filtro selecionado.</td></tr>`;
            return;
        }

        list.forEach(patient => {
            const info = patient.contraceptiveInfo;
            if (!info) return;

            const tr = document.createElement('tr');

            const appliedDateFormatted = info.appliedDate ? formatDate(info.appliedDate) : '-';
            const expirationDate = calculateExpirationDate(info.appliedDate, info.durationDays);
            const expirationDateFormatted = expirationDate ? formatDate(expirationDate) : '-';
            const daysLeft = calculateDaysLeft(expirationDate);
            const daysLeftText = formatDaysLeftFriendly(daysLeft);

            // Status badge e cor da linha
            let statusBadge = '';
            let rowClass = '';
            const statusType = determineStatusType(expirationDate, info);
            if (statusType === 'expired') {
                statusBadge = `<span class="badge-wh badge-wh-expired">Vencido</span>`;
                rowClass = 'row-danger';
            } else if (statusType === 'expiring') {
                statusBadge = `<span class="badge-wh badge-wh-expiring">A vencer</span>`;
                rowClass = 'row-warning';
            } else {
                statusBadge = `<span class="badge-wh badge-wh-regular">Regular</span>`;
            }

            if (rowClass) tr.className = rowClass;

            const primaryPhone = patient.phones && patient.phones[0] ? patient.phones[0] : '';

            tr.innerHTML = `
                <td>
                    <div class="fw-600">${escapeHTML(patient.name)}</div>
                    <div class="fs-12 text-muted">CNS: ${escapeHTML(patient.cns || '-')}</div>
                </td>
                <td>${escapeHTML(info.medicationName || 'Método não especificado')}</td>
                <td style="text-align: center;">${appliedDateFormatted}</td>
                <td style="text-align: center;">${expirationDateFormatted}</td>
                <td style="text-align: center;">${daysLeftText}</td>
                <td style="text-align: center;">${statusBadge}</td>
                <td style="text-align: center;">
                    ${notifiedPatients.has(patient.id)
                    ? `<button type="button" disabled
                                style="padding: 6px 12px; margin: 0; display: inline-flex; align-items: center; gap: 6px;
                                       background-color: #6b7280; border: 1px solid #6b7280; color: #fff;
                                       border-radius: var(--radius-md); font-size: 13px; cursor: not-allowed; opacity: 0.75;">
                               <i class="fa-solid fa-check"></i> Já Notificado
                           </button>`
                    : `<button type="button" id="btn-notify-${patient.id}" class="btn-success btn-sm d-inline-flex align-center gap-6"
                               onclick="sendContraceptiveNotification('${patient.id}', '${escapeJS(patient.name)}', '${escapeJS(info.medicationName)}', '${expirationDateFormatted}', '${primaryPhone}', ${info.durationDays || 0})"
                               style="padding: 6px 12px; margin: 0; background-color: var(--color-primary); border-color: var(--color-primary);"</i> Notificar
                           </button>`
                }
                </td>
            `;

            tbody.appendChild(tr);
        });
    }

    function calculateExpirationDate(appliedDateStr, durationDays) {
        if (!appliedDateStr || !durationDays) return null;
        const date = new Date(appliedDateStr);
        date.setDate(date.getDate() + durationDays);
        return date;
    }

    function calculateDaysLeft(expirationDate) {
        if (!expirationDate) return null;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const exp = new Date(expirationDate);
        exp.setHours(0, 0, 0, 0);
        const diffTime = exp.getTime() - today.getTime();
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    function formatDaysLeftFriendly(daysLeft) {
        if (daysLeft === null) return '-';
        if (daysLeft < 0) {
            return `Vencido há ${Math.abs(daysLeft)} dias`;
        }
        if (daysLeft === 0) {
            return 'Vence hoje';
        }
        if (daysLeft === 1) {
            return 'Vence amanhã';
        }

        if (daysLeft >= 365) {
            const years = Math.floor(daysLeft / 365);
            const remainingDays = daysLeft % 365;
            const months = Math.floor(remainingDays / 30);

            let text = `Faltam ${years} ${years === 1 ? 'ano' : 'anos'}`;
            if (months > 0) {
                text += ` e ${months} ${months === 1 ? 'mês' : 'meses'}`;
            }
            return text;
        }

        if (daysLeft >= 30) {
            const months = Math.floor(daysLeft / 30);
            const remainingDays = daysLeft % 30;
            const weeks = Math.floor(remainingDays / 7);

            let text = `Faltam ${months} ${months === 1 ? 'mês' : 'meses'}`;
            if (weeks > 0) {
                text += ` e ${weeks} ${weeks === 1 ? 'semana' : 'semanas'}`;
            }
            return text;
        }

        if (daysLeft >= 7) {
            const weeks = Math.floor(daysLeft / 7);
            const remainingDays = daysLeft % 7;

            let text = `Faltam ${weeks} ${weeks === 1 ? 'semana' : 'semanas'}`;
            if (remainingDays > 0) {
                text += ` e ${remainingDays} ${remainingDays === 1 ? 'dia' : 'dias'}`;
            }
            return text;
        }

        return `Faltam ${daysLeft} dias`;
    }

    function determineStatusType(expirationDate, info) {
        if (!expirationDate || !info) return 'regular';
        const daysLeft = calculateDaysLeft(expirationDate);
        if (daysLeft === null) return 'regular';
        if (daysLeft < 0) return 'expired';

        const durationDays = info.durationDays || 0;
        if (durationDays >= 365) {
            if (daysLeft <= 365) return 'expiring';
        } else if (durationDays > 28) {
            if (daysLeft <= 30) return 'expiring';
        } else {
            if (daysLeft <= 7) return 'expiring';
        }
        return 'regular';
    }

    function formatDate(dateInput) {
        const date = new Date(dateInput);
        if (isNaN(date.getTime())) return '-';
        return date.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
    }

    window.sendContraceptiveNotification = async function (patientId, patientName, contraceptiveName, expDate, phone, durationDays) {
        if (!phone) {
            if (window.showToast) {
                window.showToast("Paciente não possui telefone cadastrado.", "warning");
            }
            return;
        }

        let message = '';
        if (durationDays >= 365) {
            message = `Olá, ${patientName}! Lembramos que o período de eficácia do seu dispositivo contraceptivo está se aproximando do fim, expira dia ${expDate}. Por favor, entre em contato com a UBS para agendar a consulta médica de renovação ou substituição.`;
        } else if (durationDays > 28) {
            message = `Olá, ${patientName}! Lembramos que a data da próxima aplicação do seu anticoncepcional injetável está se aproximando, vence em ${expDate}. Por favor, compareça à UBS para realizar a nova aplicação dentro do prazo indicado.`;
        } else {
            message = `Olá, ${patientName}! Lembramos que a sua cartela de anticoncepcional está chegando ao fim. Lembre-se de comparecer à UBS do seu bairro para retirar sua próxima cartela.`;
        }

        try {
            if (window.showToast) {
                window.showToast("Enviando mensagem...", "info");
            }

            await window.apiClient.post(`/patients/${patientId}/contraceptive-notification`, { message: message });

            if (window.showToast) {
                window.showToast(`Notificação enviada para o WhatsApp de ${patientName}!`, "success");
            }

            notifiedPatients.add(patientId);
            const btn = document.getElementById(`btn-notify-${patientId}`);
            if (btn) {
                btn.disabled = true;
                btn.style.backgroundColor = '#6b7280';
                btn.style.borderColor = '#6b7280';
                btn.style.cursor = 'not-allowed';
                btn.style.opacity = '0.75';
                btn.innerHTML = '<i class="fa-solid fa-check"></i> Já Notificado';
                btn.onclick = null;
                btn.removeAttribute('id');
            }
        } catch (error) {
            console.error("Erro ao enviar:", error.message);
            if (window.showToast) {
                window.showToast("Falha no disparo automático. Abrindo WhatsApp Web...", "warning");
            }

            const cleanPhone = phone.replace(/\D/g, '');
            const whatsappUrl = `https://api.whatsapp.com/send?phone=55${cleanPhone}&text=${encodeURIComponent(message)}`;
            window.open(whatsappUrl, '_blank');
        }
    };

    function escapeHTML(str) {
        if (!str) return '';
        return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    }

    function escapeJS(str) {
        if (!str) return '';
        return str.replace(/'/g, "\\'").replace(/"/g, '\\"');
    }

    function switchWomensHealthTab(tabId, tabEl) {
        document.querySelectorAll('#view-womens-health .tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('#view-womens-health .tab-section').forEach(s => s.classList.remove('active-section'));

        tabEl.classList.add('active');
        const target = document.getElementById(tabId);
        if (target) target.classList.add('active-section');
    }

    function destroyWomensHealth() {
        document.body.classList.remove('theme-womens-health');
    }

    window.WomensHealthController = {
        init: initWomensHealth,
        destroy: destroyWomensHealth
    };
})();
