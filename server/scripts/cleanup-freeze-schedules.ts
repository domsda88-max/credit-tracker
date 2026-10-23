import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Очистка «мусорного» графика у карт в цикле заморозки.
 *
 * Раньше таким картам генерировались строки минимальных платежей
 * (40 000 / 12 = 3333 ₽ и т.п.), хотя минимального платежа и срока у них нет.
 * Теперь график для них пустой: платится только сумма обновления периода.
 */
async function main() {
  const user = await prisma.user.findUnique({ where: { email: 'mogiladjon97@gmail.com' } });
  if (!user) return console.log('нет пользователя');

  const credits = await prisma.credit.findMany({
    where: {
      userId: user.id,
      frozen: true,
      status: 'ACTIVE',
      freezeCycleDays: { not: null },
      gracePeriodEnds: null,
    },
  });

  for (const credit of credits) {
    const del = await prisma.paymentSchedule.deleteMany({
      where: { creditId: credit.id, status: 'PENDING' },
    });
    console.log(`${credit.name}: удалено строк графика — ${del.count}`);
  }

  console.log('\nИтог:');
  const list = await prisma.credit.findMany({
    where: { userId: user.id },
    orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
    include: {
      schedule: { where: { status: 'PENDING' }, orderBy: { dueDate: 'asc' }, take: 1 },
    },
  });
  for (const c of list) {
    console.log(
      `  ${c.name} | ${c.type} | ${c.status} | заморожена=${c.frozen} | ` +
        `обновить=${c.graceReplenishSum ? Number(c.graceReplenishSum) : '—'} | ` +
        `след.платёж=${c.schedule[0] ? c.schedule[0].dueDate.toISOString().slice(0, 10) : '—'}`,
    );
  }
}

main()
  .catch((e) => {
    console.error('ОШИБКА:', e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
