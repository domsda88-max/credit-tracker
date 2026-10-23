const fs = require('fs');
const p = 'src/pages/AddCreditPage.tsx';
let s = fs.readFileSync(p, 'utf8');
s = s.replace(/<h1 className="text-heading font-bold text-t1">[^<]*<\/h1>[^<]*<\/h1>/, '<h1 className="text-heading font-bold text-t1">Добавить долг</h1>');
fs.writeFileSync(p, s, 'utf8');
console.log('done');
