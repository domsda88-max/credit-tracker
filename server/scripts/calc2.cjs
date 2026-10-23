const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const u = await p.user.findUnique({ where: { email: 'mogiladjon97@gmail.com' } });
  const credits = await p.credit.findMany({ where: { userId: u.id }, include: { schedule: true } });
  const targetY = 2026, targetM = 10; // November (0-indexed: 10 = November)
  let monthSum = 0;
  const monthItems = [];
  for (const c of credits) {
    if (c.status !== 'ACTIVE') continue;
    for (const s of c.schedule) {
      const d = new Date(s.dueDate);
      if (d.getUTCFullYear()===targetY && d.getUTCMonth()===targetM) { monthSum += Number(s.amount); monthItems.push({name:c.name, date:d.toISOString().slice(0,10), amount:s.amount, status:s.status}); }
    }
  }
  console.log('=== Платежи за НОЯБРЬ 2026 ===');
  console.log(JSON.stringify(monthItems, null, 2));
  console.log('Сумма за ноябрь:', monthSum);
  console.log('Доход 130000, свободно:', 130000 - monthSum);
  await p.$disconnect();
})();
