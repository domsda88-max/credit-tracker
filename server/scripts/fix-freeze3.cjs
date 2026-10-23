const fs = require('fs');
const p = 'src/modules/credits/credits.service.ts';
const lines = fs.readFileSync(p, 'utf8').split(/\r?\n/);
// find line with "const financialChanged ="
const i = lines.findIndex((l) => l.includes('const financialChanged ='));
// replace lines i..i+1 (the assignment) and the termsChanged block
// financialChanged value line is i+1
lines[i + 1] = '      FINANCIAL_FIELDS.some((field) => dto[field] !== undefined) || dto.outstanding !== undefined;';
// find termsChanged
const j = lines.findIndex((l) => l.includes('const termsChanged ='));
// replace the value line (j+1)
lines[j + 1] = '      FINANCIAL_FIELDS.some((field) => dto[field] !== undefined) || dto.outstanding !== undefined;';
fs.writeFileSync(p, lines.join('\n'), 'utf8');
console.log('done');
