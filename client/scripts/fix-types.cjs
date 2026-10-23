const fs = require('fs');
const p = 'src/types/index.ts';
let s = fs.readFileSync(p, 'utf8');
s = s.replace(
  "  freeMoney: number | null;\n  accelerator: PayoffAccelerator | null;",
  "  freeMoney: number | null;\n  graceReplenishTotal: number;\n  graceItems: { name: string; amount: number; dueDate: string | null }[];\n  accelerator: PayoffAccelerator | null;"
);
fs.writeFileSync(p, s, 'utf8');
console.log('done');
