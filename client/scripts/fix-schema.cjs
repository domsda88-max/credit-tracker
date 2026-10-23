const fs = require('fs');
const p = 'src/pages/AddCreditPage.tsx';
let s = fs.readFileSync(p, 'utf8');
// Make annualRate optional with default 0
s = s.replace(/annualRate: z\.coerce\.number\(\)\.min\(0\)\.max\(100\),/, "annualRate: z.coerce.number().min(0).max(100).optional().default(0),");
// Make startDate optional
s = s.replace(/startDate: z\.string\(\)\.min\(1, [^)]*\),/, "startDate: z.string().optional().default(''),");
fs.writeFileSync(p, s, 'utf8');
console.log('done');
// verify
const lines = fs.readFileSync(p,'utf8').split(/\r?\n/);
for (const l of lines) if (l.includes('annualRate: z') || l.includes('startDate: z')) console.log(l.trim());
