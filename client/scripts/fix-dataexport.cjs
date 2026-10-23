const fs = require('fs');
const p = 'src/components/DataExport.tsx';
let s = fs.readFileSync(p, 'utf8');
s = s.replace(/          >\n          �\?"\" ������ؐ��'�\? CSV\n        <\/button>/, '          className="inline-flex items-center gap-1.5">\n          <FileSpreadsheet size={16} />\n          Экспорт CSV\n        </button>');
// fallback simpler: replace the whole two button label lines
s = s.replace(/          �\?"\" ������ؐ��'�\? CSV/, '          <FileSpreadsheet size={16} className="inline" /> Экспорт CSV');
s = s.replace(/          �\?'? ������ؐ��'�\? JSON \(�\+�\?�����\)/, '          <Save size={16} className="inline" /> Экспорт JSON');
fs.writeFileSync(p, s, 'utf8');
console.log('done');
