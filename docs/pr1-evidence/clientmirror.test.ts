import { readFileSync } from 'fs';
const client = readFileSync('../client/src/utils/finance/accelerator.ts', 'utf8');
const server = readFileSync('src/utils/finance/accelerator.ts', 'utf8');
// нормализуем: уберём комментарии и пробельные строки, сравним тело функции
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*/g, '').replace(/\s+/g, ' ').trim();
console.log('IDENTICAL:', strip(client) === strip(server));
console.log('client len', client.length, 'server len', server.length);
