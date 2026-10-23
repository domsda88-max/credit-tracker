import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const u = await prisma.user.findUnique({ where: { email: 'mogiladjon97@gmail.com' } });
  if (!u) return;
  const credits = await prisma.credit.findMany({
    where: { userId: u.id, frozen: true },
    include: { schedule: { orderBy: { dueDate: 'asc' } } },
  });
  for (const c of credits) {
    console.log(`\n=== ${c.name} (${c.graceReplenishSum} ₽ / день ${c.graceReplenishDay}, цикл ${c.freezeCycleDays}дн) ===`);
    console.log('  всего строк графика:', c.schedule.length, '| оплачено:', c.schedule.filter(s => s.status === 'PAID').length);
    for (const s of c.schedule.slice(0, 6)) {
      console.log(`   ${s.dueDate.toISOString().slice(0,10)}  ${Number(s.amount).toFixed(2)} ₽  (тело ${Number(s.principalPart).toFixed(2)} / проц ${Number(s.interestPart).toFixed(2)})  ${s.status}`);
    }
  }
}
main().finally(() => prisma.$disconnect());
