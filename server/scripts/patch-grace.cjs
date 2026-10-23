const fs = require('fs');
const p = 'src/modules/credits/credits.service.ts';
const lines = fs.readFileSync(p, 'utf8').split(/\r?\n/);
const idx = lines.findIndex((l) => l.includes('let monthlyPayments = 0'));
lines.splice(idx + 1, 0, '    let graceReplenishTotal = 0;', '    let graceItems: { name: string; amount: number; dueDate: string | null }[] = [];');
fs.writeFileSync(p, lines.join('\n'), 'utf8');
console.log('done');
