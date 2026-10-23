import { PrismaClient } from '@prisma/client';
import { buildMotivationContext } from '../src/cron/motivation.context';
import { buildMotivationTexts } from '../src/cron/motivation.texts';

const prisma = new PrismaClient();

async function main() {
  const u = await prisma.user.findUnique({ where: { email: 'mogiladjon97@gmail.com' } });
  if (!u) return console.log('нет пользователя');

  const ctx = await buildMotivationContext(u.id);
  const texts = buildMotivationTexts(ctx);

  console.log('КОНТЕКСТ:');
  console.log(
    JSON.stringify(
      {
        activeCount: ctx.activeCount,
        totalDebt: ctx.totalDebt,
        principalSum: ctx.principalSum,
        overpay: ctx.overpay,
        debtFreeDate: ctx.debtFreeDate,
        monthlyTotal: ctx.monthlyTotal,
        mostExpensive: ctx.mostExpensive,
        expensive: ctx.expensive.map((e) => `${e.name} ${e.rate}%`),
        mortgage: ctx.mortgage?.name,
        smallest: ctx.smallest?.name,
        freezeCards: ctx.freezeCards.map((f) => `${f.name} ${f.replenishSum}`),
        closedName: ctx.closedName,
      },
      null,
      2,
    ),
  );

  console.log(`\nТЕКСТОВ: ${texts.length}\n`);
  texts.forEach((t, i) => console.log(`${i + 1}. ${t.title}\n   ${t.body}\n`));
}

main().finally(() => prisma.$disconnect());
