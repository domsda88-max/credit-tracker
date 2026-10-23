const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const u = await p.user.findUnique({ where: { email: 'mogiladjon97@gmail.com' } });
  const credits = await p.credit.findMany({ where: { userId: u.id }, include: { schedule: true } });
  const now = new Date();
  const y = now.getUTCFullYear(), m = now.getUTCMonth();
  let monthSum = 0;
  const monthItems = [];
  const upcoming = [];
  const today = new Date(); today.setHours(0,0,0,0);
  const horizon = new Date(today); horizon.setDate(horizon.getDate()+30);
  for (const c of credits) {
    if (c.status !== 'ACTIVE') continue;
    for (const s of c.schedule) {
      const d = new Date(s.dueDate);
      if (d.getUTCFullYear()===y && d.getUTCMonth()===m) { monthSum += Number(s.amount); monthItems.push({name:c.name, date:d.toISOString().slice(0,10), amount:s.amount}); }
      if (d >= today && d <= horizon) upcoming.push({name:c.name, date:d.toISOString().slice(0,10), amount:s.amount});
    }
  }
  console.log('=== Платежи текущего месяца ===');
  console.log(JSON.stringify(monthItems, null, 2));
  console.log('Сумма за месяц:', monthSum);
  console.log('=== Ближайшие 30 дней ===');
  upcoming.sort((a,b)=>a.date.localeCompare(b.date));
  console.log(JSON.stringify(upcoming, null, 2));
  console.log('Доход 130000, свободно:', 130000 - monthSum);
  await p.$disconnect();
})();
