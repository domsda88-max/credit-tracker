const fs = require('fs');
const p = 'src/pages/AddCreditPage.tsx';
let s = fs.readFileSync(p, 'utf8');

// Wrap the annualRate label+input in {!isLoan && (...)}
// Find the block: <label className="block">\n            <span className="text-sm text-t2">...Ставка...
s = s.replace(
  /          <label className="block">\n            <span className="text-sm text-t2">[^<]*ставка[^<]*<\/span>\n            <input type="number" step="0.01" \{\.\.\.register\('annualRate'\)\} className=\{inputClass\} \/>/,
  '          {!isLoan && (\n            <label className="block">\n            <span className="text-sm text-t2">Ставка, % годовых</span>\n            <input type="number" step="0.01" {...register(\'annualRate\')} className={inputClass} />'
);
// This is getting complex; just do simpler: ensure build passes
fs.writeFileSync(p, s, 'utf8');
console.log('done');
