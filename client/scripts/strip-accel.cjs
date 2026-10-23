const fs = require('fs');
const p = 'src/components/DebtOverview.tsx';
const lines = fs.readFileSync(p, 'utf8').split(/\r?\n/);
const start = lines.findIndex((l) => l.includes('Accelerator block temporarily removed'));
// find the closing of that block: the line with ')' followed by blank then overpay
let end = -1;
for (let i = start; i < lines.length; i++) {
  if (lines[i].includes('summary.overpay > 0')) { end = i - 2; break; }
}
const out = [...lines.slice(0, start + 1), ...lines.slice(end + 1)];
// remove leftover closing paren line
fs.writeFileSync(p, out.join('\n'), 'utf8');
console.log('removed lines', start, 'to', end);
