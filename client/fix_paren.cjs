const fs=require('fs');
const p='src/pages/CreditDetailPage.tsx';
let s=fs.readFileSync(p,'utf8');
s=s.replace("формата awaiting","формата awaiting");
s=s.replace("return;", "return;");
// fix specific missing paren
s=s.replace(
 "Отменить платёж ${formatMoney(item.amount)} от ${formatDate(item.dueDate)}? Статус изменится на «Не оплачен», график пересчитается.`) return;",
 "Отменить платёж ${formatMoney(item.amount)} от ${formatDate(item.dueDate)}? Статус изменится на «Не оплачен», график пересчитается.`)) return;"
);
fs.writeFileSync(p,s,'utf8');
console.log('ok');
