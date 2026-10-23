import { prisma } from '../config/prisma';
import { toNumber } from '../utils/finance/round';

/** Кредит глазами мотивационной рассылки. */
export interface DebtSnippet {
  name: string;
  rate: number;
  balance: number;
  frozen: boolean;
  /** Сумма обновления беспроцентного периода (для карт в заморозке). */
  replenishSum: number | null;
  replenishDay: number | null;
  cycleDays: number | null;
}

/**
 * Всё, что нужно шаблонам текстов, чтобы обратиться к пользователю лично:
 * его самые дорогие долги, ипотека, замороженные карты, закрытые кредиты,
 * общая сумма долга и дата свободы.
 */
export interface MotivationContext {
  name: string | null;
  activeCount: number;
  totalDebt: number;
  principalSum: number;
  overpay: number;
  debtFreeDate: Date | null;
  monthlyTotal: number;
  /** Самый дорогой по ставке долг, который реально гасится. */
  mostExpensive: DebtSnippet | null;
  /** До трёх самых дорогих долгов (по убыванию ставки). */
  expensive: DebtSnippet[];
  /** Ипотека (самый крупный и длинный долг), если есть. */
  mortgage: DebtSnippet | null;
  /** Самый маленький по остатку долг — его быстрее всего закрыть. */
  smallest: DebtSnippet | null;
  /** Карты в цикле заморозки. */
  freezeCards: DebtSnippet[];
  /** Последний закрытый кредит (для «ты уже закрыл…»). */
  closedName: string | null;
}

/** Собирает контекст мотивации из реальных данных пользователя. */
export async function buildMotivationContext(userId: string): Promise<MotivationContext> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true },
  });

  const credits = await prisma.credit.findMany({
    where: { userId },
    include: {
      schedule: { where: { status: 'PENDING' }, orderBy: { dueDate: 'asc' } },
    },
  });

  const active = credits.filter((c) => c.status === 'ACTIVE');
  const closed = credits.filter((c) => c.status === 'CLOSED');

  const toSnippet = (c: (typeof credits)[number]): DebtSnippet => ({
    name: c.name,
    rate: toNumber(c.annualRate),
    balance: Math.max(0, toNumber(c.outstanding)),
    frozen: c.frozen,
    replenishSum: c.graceReplenishSum ? toNumber(c.graceReplenishSum) : null,
    replenishDay: c.graceReplenishDay ?? c.paymentDay,
    cycleDays: c.freezeCycleDays,
  });

  const withDebt = active.filter((c) => toNumber(c.outstanding) > 0).map(toSnippet);

  // Замороженные карты в расчёте «дороговизны» не участвуют: пока заморожены,
  // проценты по ним не начисляются.
  const accruing = withDebt.filter((d) => !(d.frozen && d.cycleDays !== null));

  const expensive = [...(accruing.length > 0 ? accruing : withDebt)].sort(
    (a, b) => b.rate - a.rate,
  );

  const mortgageCredit = active.find((c) => c.type === 'MORTGAGE');
  const mortgage = mortgageCredit ? toSnippet(mortgageCredit) : null;

  const smallest = [...withDebt].sort((a, b) => a.balance - b.balance)[0] ?? null;

  const freezeCards = active
    .filter((c) => c.frozen && c.freezeCycleDays !== null)
    .map(toSnippet);

  const monthlyTotal = active.reduce((acc, c) => {
    const next = c.schedule[0];
    return acc + (next ? toNumber(next.amount) : 0);
  }, 0);

  // Переплата и дата свободы — по графику активных кредитов.
  let scheduledTotal = 0;
  let lastDue: Date | null = null;
  for (const c of active) {
    for (const item of c.schedule) {
      scheduledTotal += toNumber(item.amount);
      if (!lastDue || item.dueDate.getTime() > lastDue.getTime()) lastDue = item.dueDate;
    }
  }
  const principalSum = active.reduce((acc, c) => acc + toNumber(c.principal), 0);

  return {
    name: user?.name ?? null,
    activeCount: active.length,
    totalDebt: withDebt.reduce((acc, d) => acc + d.balance, 0),
    principalSum,
    overpay: Math.max(0, scheduledTotal - principalSum),
    debtFreeDate: lastDue,
    monthlyTotal,
    mostExpensive: expensive[0] ?? null,
    expensive: expensive.slice(0, 3),
    mortgage,
    smallest,
    freezeCards,
    closedName: closed[closed.length - 1]?.name ?? null,
  };
}
