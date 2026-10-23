import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const u = await prisma.user.findUnique({ where: { email: 'mogiladjon97@gmail.com' } });
  if (!u) return console.log('нет пользователя');

  const credits = await prisma.credit.findMany({
    where: { userId: u.id },
    orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
    include: { schedule: { where: { status: 'PENDING' }, orderBy: { dueDate: 'asc' }, take: 2 } },
  });

  for (const c of credits) {
    console.log(
      JSON.stringify({
        name: c.name,
        type: c.type,
        paymentType: c.paymentType,
        status: c.status,
        frozen: c.frozen,
        principal: Number(c.principal),
        outstanding: Number(c.outstanding),
        rate: Number(c.annualRate),
        termMonths: c.termMonths,
        paymentDay: c.paymentDay,
        minPayment: c.minPayment ? Number(c.minPayment) : null,
        gracePeriodEnds: c.gracePeriodEnds,
        graceReplenishSum: c.graceReplenishSum ? Number(c.graceReplenishSum) : null,
        graceReplenishDay: c.graceReplenishDay,
        freezeCycleDays: c.freezeCycleDays,
        freezeStartedAt: c.freezeStartedAt,
        nextFreezeCheckAt: c.nextFreezeCheckAt,
        nextPayment: c.schedule[0]
          ? { due: c.schedule[0].dueDate, amount: Number(c.schedule[0].amount) }
          : null,
      }),
    );
  }
}

main().finally(() => prisma.$disconnect());
