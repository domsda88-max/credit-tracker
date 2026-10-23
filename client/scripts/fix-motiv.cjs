const fs = require('fs');
const p = 'src/components/MotivationSettings.tsx';
let s = fs.readFileSync(p, 'utf8');
// Replace the enabled-block paragraph with progress bar
const marker = '{enabled && (';
const idx = s.indexOf(marker);
const end = s.indexOf(')}', idx) + 2;
const replacement = `{enabled && (
        <div className="mt-3">
          <div className="flex items-center justify-between text-caption">
            <span className="text-t3">Прогресс цикла</span>
            <span className="tabular text-t2">день {user.motivationDay ?? 1} из 30</span>
          </div>
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface2">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary to-success"
              style={{ width: \`\${((user.motivationDay ?? 1) / 30) * 100}%\` }}
            />
          </div>
        </div>
      )}`;
s = s.slice(0, idx) + replacement + s.slice(end);
fs.writeFileSync(p, s, 'utf8');
console.log('done');
