const fs = require('fs');
const p = 'src/components/DataExport.tsx';
const lines = fs.readFileSync(p, 'utf8').split(/\r?\n/);
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('CSV')) lines[i] = '          <FileSpreadsheet size={16} className="inline-block" /> Экспорт CSV';
  if (lines[i].includes('JSON (')) lines[i] = '          <Save size={16} className="inline-block" /> Экспорт JSON';
}
fs.writeFileSync(p, lines.join('\n'), 'utf8');
console.log('done');
