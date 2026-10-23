import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.cwd(), 'src');

/** Длинные строки — первыми, иначе короткая заменит часть длинной. */
const MAP = [
  // Фоны карточек и вложенных блоков
  ['bg-white/[0.04]', 'bg-surface2'],
  ['bg-white/[0.02]', 'bg-surface'],
  ['bg-slate-950/70', 'bg-bg/80'],
  ['bg-slate-950/60', 'bg-bg/70'],
  ['bg-slate-950/50', 'bg-bg/60'],
  ['bg-slate-950/40', 'bg-bg/50'],
  ['bg-slate-950/30', 'bg-bg/40'],
  ['bg-slate-950', 'bg-bg'],
  ['bg-slate-900/80', 'bg-surface/90'],
  ['bg-slate-900/60', 'bg-surface/80'],
  ['bg-slate-900/40', 'bg-surface/60'],
  ['bg-slate-900', 'bg-surface'],
  ['bg-slate-800/80', 'bg-surface2'],
  ['bg-slate-800/60', 'bg-surface2'],
  ['bg-slate-800/40', 'bg-surface2'],
  ['bg-slate-800', 'bg-surface2'],
  ['bg-slate-700', 'bg-surface2'],

  // Текст
  ['text-slate-950', 'text-white'],
  ['text-slate-100', 'text-t1'],
  ['text-slate-200', 'text-t1'],
  ['text-slate-300', 'text-t2'],
  ['text-slate-400', 'text-t2'],
  ['text-slate-500', 'text-t3'],

  // Границы
  ['border-white/[0.08]', 'border-line'],
  ['border-white/[0.06]', 'border-line'],
  ['border-slate-800', 'border-line'],
  ['border-slate-700', 'border-line'],
  ['border-slate-600', 'border-t3'],
  ['divide-slate-800', 'divide-line'],

  // Акценты
  ['text-sky-300', 'text-primary'],
  ['text-sky-400', 'text-primary'],
  ['bg-sky-500/15', 'bg-primary/15'],
  ['bg-sky-500/10', 'bg-primary/10'],
  ['bg-sky-500/5', 'bg-primary/5'],
  ['hover:bg-sky-400', 'hover:bg-primary/90'],
  ['bg-sky-500', 'bg-primary'],
  ['border-sky-500/40', 'border-primary/40'],
  ['border-sky-500/30', 'border-primary/30'],
  ['focus:border-sky-500', 'focus:border-primary'],
  ['border-sky-500', 'border-primary'],
  ['accent-sky-500', 'accent-primary'],
  ['ring-sky-500', 'ring-primary'],

  ['text-emerald-300/80', 'text-success/80'],
  ['text-emerald-200', 'text-success'],
  ['text-emerald-300', 'text-success'],
  ['text-emerald-400', 'text-success'],
  ['bg-emerald-500/10', 'bg-success/10'],
  ['bg-emerald-500/5', 'bg-success/5'],
  ['border-emerald-500/30', 'border-success/30'],
  ['border-emerald-500/20', 'border-success/20'],
  ['accent-emerald-500', 'accent-success'],
  ['bg-emerald-500', 'bg-success'],
  ['from-emerald-400', 'from-success'],
  ['to-emerald-400', 'to-success'],

  ['text-amber-300/80', 'text-warning/80'],
  ['text-amber-300', 'text-warning'],
  ['bg-amber-500/10', 'bg-warning/10'],
  ['border-amber-500/40', 'border-warning/40'],

  ['text-rose-300', 'text-danger'],
  ['text-rose-400', 'text-danger'],
  ['bg-rose-500/10', 'bg-danger/10'],
  ['border-rose-500/40', 'border-danger/40'],
  ['hover:bg-rose-500/20', 'hover:bg-danger/20'],

  ['from-sky-500/10', 'from-primary/10'],
  ['from-sky-400', 'from-primary'],
  ['from-sky-500', 'from-primary'],
  ['to-emerald-400/5', 'to-success/5'],
  ['text-sky-300/80', 'text-primary/80'],
  ['from-slate-900', 'from-surface'],
  ['to-slate-900/40', 'to-surface/40'],

  // Радиусы и типографика из токенов
  ['rounded-2xl', 'rounded-card'],
  ['rounded-3xl', 'rounded-card'],
  ['rounded-xl', 'rounded-control'],
];

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.(tsx?|jsx?)$/.test(name)) out.push(full);
  }
  return out;
}

let changed = 0;
for (const file of walk(ROOT)) {
  const before = readFileSync(file, 'utf8');
  let after = before;
  for (const [from, to] of MAP) after = after.split(from).join(to);
  if (after !== before) {
    writeFileSync(file, after, 'utf8');
    changed += 1;
    console.log('·', file.replace(ROOT, 'src'));
  }
}
console.log(`\nОбновлено файлов: ${changed}`);
