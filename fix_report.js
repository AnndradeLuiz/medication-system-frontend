const fs = require('fs');
let code = fs.readFileSync('src/pages/scripts/report.js', 'utf8');

// 1. Replace fetch GET calls with apiClient.get
code = code.replace(/const\s+response\s*=\s*await\s+fetch\(`\$\{API_URL\}(\/reports\/[^`]+)`,\s*\{\s*headers:\s*getAuthHeaders\(\)\s*\}\);[\s\S]*?if\s*\(!response\.ok\)\s*throw\s*new\s*Error\([^)]*\);[\s\S]*?const\s+(\w+)\s*=\s*await\s+response\.json\(\);/g, (match, url, varName) => {
    return `const { data: ${varName} } = await window.apiClient.get('${url}');`;
});

// 2. Fix dynamic POST call
code = code.replace(/const\s+response\s*=\s*await\s+fetch\(`\$\{API_URL\}(\/reports\/export\/custom)`,\s*\{[\s\S]*?method:\s*'POST',[\s\S]*?body:\s*JSON\.stringify\(selectedCols\)[\s\S]*?\}\);[\s\S]*?if\s*\(!response\.ok\)\s*throw\s*new\s*Error\([^)]*\);[\s\S]*?const\s+(\w+)\s*=\s*await\s+response\.json\(\);/g, (match, url, varName) => {
    return `const { data: ${varName} } = await window.apiClient.post('${url}', selectedCols);`;
});

// 3. Fix exportAnalyticsExcel fetch
code = code.replace(/let\s+url\s*=\s*`\$\{API_URL\}\/reports\/\$\{reportType\}`;[\s\S]*?const\s+response\s*=\s*await\s+fetch\(url,\s*\{\s*headers:\s*getAuthHeaders\(\)\s*\}\);[\s\S]*?if\s*\(!response\.ok\)\s*throw\s*new\s*Error\([^)]*\);[\s\S]*?let\s+data\s*=\s*await\s+response\.json\(\);/g, (match) => {
    return `const { data: responseData } = await window.apiClient.get(\`/reports/\${reportType}\`);\n            let data = responseData;`;
});

// 4. Fix data reference bug in exportAnalyticsExcel
code = code.replace(/\{ Métrica: "Total Hiperdia", Valor: data\.totalHiperdia/g, '{ Métrica: "Total Hiperdia", Valor: responseData.totalHiperdia');
code = code.replace(/\{ Métrica: "Apenas Diabetes", Valor: data\.countDiabeteOnly/g, '{ Métrica: "Apenas Diabetes", Valor: responseData.countDiabeteOnly');
code = code.replace(/\{ Métrica: "Apenas Hipertensão", Valor: data\.countHipertensaoOnly/g, '{ Métrica: "Apenas Hipertensão", Valor: responseData.countHipertensaoOnly');
code = code.replace(/\{ Métrica: "Ambos", Valor: data\.countAmbos/g, '{ Métrica: "Ambos", Valor: responseData.countAmbos');
code = code.replace(/const\s+ageDist\s*=\s*data\.ageDistribution/g, 'const ageDist = responseData.ageDistribution');
code = code.replace(/const\s+therapy\s*=\s*data\.therapyType/g, 'const therapy = responseData.therapyType');
code = code.replace(/const\s+prod\s*=\s*data\.PractitionerProductivity/g, 'const prod = responseData.PractitionerProductivity');
code = code.replace(/const\s+days\s*=\s*data\.weekdayDistribution/g, 'const days = responseData.weekdayDistribution');
code = code.replace(/const\s+flow\s*=\s*data\.hourlyFlow/g, 'const flow = responseData.hourlyFlow');

// 5. Add init
if (!code.includes('window.location.hash === \\'#report\\'')) {
    code = code.replace(/\}\)\(\);\s*$/g, `
    // Inicialização automática para SPA
    if (window.location.hash === '#report' || document.getElementById('rep-sub-dashboard')) {
        setTimeout(() => {
            if (typeof window.switchReportTab === 'function') {
                window.switchReportTab('dashboard');
            }
        }, 100);
    }
})();
`);
}

fs.writeFileSync('src/pages/scripts/report.js', code);
console.log('Done refactoring report.js');
