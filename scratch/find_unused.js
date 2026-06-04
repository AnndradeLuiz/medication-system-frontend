const fs = require('fs');
const path = require('path');

const jsDir = path.join(__dirname, '../js');
const rootDir = path.join(__dirname, '..');

// Find all JS and HTML files
function getAllFiles(dir, extList, fileList = []) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        if (file === 'node_modules' || file === '.agent' || file === 'scratch' || file === 'dist' || file === 'tests' || file === 'playwright-report') continue;
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
            getAllFiles(filePath, extList, fileList);
        } else {
            if (extList.includes(path.extname(file))) {
                fileList.push(filePath);
            }
        }
    }
    return fileList;
}

const allFiles = getAllFiles(rootDir, ['.js', '.html']);

// Parse functions
const functions = new Map(); // name -> { file, occurrences: [] }

for (const file of allFiles) {
    if (!file.endsWith('.js')) continue;
    const content = fs.readFileSync(file, 'utf8');
    
    let match;
    const regex1 = /function\s+([a-zA-Z0-9_]+)\s*\(/g;
    while ((match = regex1.exec(content)) !== null) {
        if (!['if', 'for', 'while', 'switch', 'catch'].includes(match[1])) {
            functions.set(match[1], { file, occurrences: [] });
        }
    }
    
    const regex2 = /(?:const|let|var)\s+([a-zA-Z0-9_]+)\s*=\s*(?:async\s*)?function/g;
    while ((match = regex2.exec(content)) !== null) {
        functions.set(match[1], { file, occurrences: [] });
    }

    const regex3 = /(?:const|let|var)\s+([a-zA-Z0-9_]+)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[a-zA-Z0-9_]+)\s*=>/g;
    while ((match = regex3.exec(content)) !== null) {
        functions.set(match[1], { file, occurrences: [] });
    }
    
    const regex4 = /window\.([a-zA-Z0-9_]+)\s*=\s*(?:async\s*)?(?:function|\([^)]*\)\s*=>|[a-zA-Z0-9_]+\s*=>)/g;
    while ((match = regex4.exec(content)) !== null) {
        functions.set(match[1], { file, occurrences: [] });
    }
}

const ignoreList = ['Math', 'JSON', 'console', 'document', 'window', 'localStorage', 'sessionStorage', 'alert', 'confirm', 'prompt', 'fetch', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'require', 'exports', 'module', 'data', 'id'];
ignoreList.forEach(name => functions.delete(name));

for (const file of allFiles) {
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        for (const [funcName, data] of functions.entries()) {
            const regex = new RegExp(`\\b${funcName}\\b`, 'g');
            const matches = line.match(regex);
            if (matches) {
                // record each match
                for(let m = 0; m < matches.length; m++) {
                    data.occurrences.push({ file: path.basename(file), lineNum: i + 1, text: line.trim() });
                }
            }
        }
    }
}

const unused = [];
for (const [funcName, data] of functions.entries()) {
    if (data.occurrences.length <= 2) {
        // If length is 1, it's definitely unused (only declared)
        // If length is 2, check if both are in the exact same line (e.g. `window.foo = function foo()`) or if one is the declaration and the other is `window.foo = foo`
        if (data.occurrences.length === 1) {
            unused.push({ funcName, file: path.basename(data.file), reason: 'Only declared, never used or exported.' });
        } else if (data.occurrences.length === 2) {
            const o1 = data.occurrences[0];
            const o2 = data.occurrences[1];
            
            // if both are in the same file and second is just assigning to window or similar export
            if (o1.file === o2.file) {
                if (o2.text.includes(`window.${funcName}`) || o2.text.includes(`module.exports.${funcName}`)) {
                    unused.push({ funcName, file: path.basename(data.file), reason: 'Exported but never used anywhere else.' });
                } else if (o1.lineNum === o2.lineNum) {
                    unused.push({ funcName, file: path.basename(data.file), reason: 'Only used twice in the same line (likely `window.foo = function foo()`).' });
                }
            }
        }
    }
}

// Sort by file name and then function name
unused.sort((a, b) => a.file.localeCompare(b.file) || a.funcName.localeCompare(b.funcName));
console.log(JSON.stringify(unused, null, 2));
