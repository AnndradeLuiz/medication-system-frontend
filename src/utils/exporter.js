/**
 * src/utils/exporter.js - Serviço centralizado de exportações XLSX / CSV
 */
window.ExporterUtils = {
    toExcel(data, fileName, sheetName = 'Dados') {
        if (typeof XLSX === 'undefined') {
            console.error('[Exporter] Biblioteca XLSX não encontrada.');
            alert('Erro: Biblioteca de exportação Excel não carregada.');
            return;
        }
        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
        XLSX.writeFile(workbook, fileName);
    },

    toCSV(data, fileName, sheetName = 'Dados') {
        if (typeof XLSX === 'undefined') {
            console.error('[Exporter] Biblioteca XLSX não encontrada.');
            alert('Erro: Biblioteca de exportação CSV não carregada.');
            return;
        }
        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
        XLSX.writeFile(workbook, fileName, { bookType: 'csv' });
    }
};
