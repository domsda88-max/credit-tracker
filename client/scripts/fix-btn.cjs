const fs = require('fs');
const p = 'src/pages/AddCreditPage.tsx';
const lines = fs.readFileSync(p, 'utf8').split(/\r?\n/);
const idx = lines.findIndex((l) => l.includes('mutation.isPending ?'));
lines[idx] = '            {mutation.isPending ? (<><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />Сохраняю…</>) : isLoan ? \'Сохранить\' : \'Сохранить и создать график\'}';
fs.writeFileSync(p, lines.join('\n'), 'utf8');
console.log('done');
