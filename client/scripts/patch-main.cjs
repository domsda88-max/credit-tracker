const fs = require('fs');
const p = 'src/main.tsx';
const lines = fs.readFileSync(p, 'utf8').split(/\r?\n/);
// Insert after line "if (!registration) return;" (index)
const idx = lines.findIndex((l) => l.trim() === 'if (!registration) return;');
lines.splice(idx + 1, 0, "      registration.addEventListener('updatefound', () => console.log('[SW] updatefound'));");
// Insert console.log before postMessage
const idx2 = lines.findIndex((l) => l.includes("registration.waiting.postMessage"));
lines.splice(idx2, 0, "        console.log('[SW] waiting -> SKIP_WAITING');");
fs.writeFileSync(p, lines.join('\n'), 'utf8');
console.log('done');
