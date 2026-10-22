import type { PrismaClient } from '@prisma/client';
import { generateSchedule } from '../../utils/finance/schedule';
import { planPastPayments } from '../../utils/finance/pastPayments';
import { effectiveAnnualRate } from '../../utils/finance/effectiveRate';

/**
 * Данные для пересоздания кредитов пользователя mogiladjon97@gmail.com.
 *
 * Источник — таблица, которую прислал владелец аккаунта. Решения по неоднозначностям:
 *  - дата выдачи отсутствовала → 21.11.2025;
 *  - «долг» из таблицы = фактический остаток НА СЕГОДНЯ (поле outstanding,
 *    без пересчёта из графика — график не строим, ставим остаток как есть);
 *  - principal = первоначальный лимит/сумма (где не указано иное);
 *  - 🧊 заморозка → frozen + freezeCycleDays, раз в период вносится вся сумма долга;
 *  - досрочные платежи → события EARLY_PARTIAL в истории;
 *  - Халва-кредитка → CLOSED с нулевым остатком;
 *  - Сплит → INSTALLMENT с процентом, без цикла заморозки.
 */

const DEFAULT_START = new Date(Date.UTC(2025, 10, 21)); // 21.11.2025

export interface SeedItem {
  name: string;
  type: 'CREDIT_CARD' | 'CONSUMER' | 'MORTGAGE' | 'INSTALLMENT' | 'MICROLOAN' | 'LOAN';
  paymentType: 'ANNUITY' | 'DIFFERENTIAL' | 'MIN_PAYMENT';
  principal: number;
  outstanding: number;
  annualRate: number;
  startDate: Date;
  termMonths: number;
  paymentDay: number | null;
  minPayment?: number | null;
  frozen?: boolean;
  freezeCycleDays?: number | null;
  graceReplenishSum?: number | null;
  graceReplenishDay?: number | null;
  status?: 'ACTIVE' | 'CLOSED';
  earlyPayments?: { amount: number; paidAt: Date }[];
  note?: string;
}

export const RESEED_EMAIL = 'mogiladjon97@gmail.com';

export const RESEED_ITEMS: SeedItem[] = [
  // ——— ЦИКЛ ЗАМОРОЗКИ ———
  {
    name: 'Тинькофф — Кубышка',
    type: 'CREDIT_CARD',
    paymentType: 'MIN_PAYMENT',
    principal: 40000,
    outstanding: 40000,
    annualRate: 53.9,
    startDate: DEFAULT_START,
    termMonths: 12,
    paymentDay: 28,
    frozen: true,
    freezeCycleDays: 7,
    graceReplenishSum: 40000,
    graceReplenishDay: 28,
    note: 'Внесение 40 000 ₽ каждую неделю для обновления беспроцентного периода',
  },
  {
    name: 'Тинькофф — Кредитка',
    type: 'CREDIT_CARD',
    paymentType: 'MIN_PAYMENT',
    principal: 40000,
    outstanding: 40000,
    annualRate: 39.9,
    startDate: DEFAULT_START,
    termMonths: 12,
    paymentDay: 30,
    frozen: true,
    freezeCycleDays: 30,
    graceReplenishSum: 40000,
    graceReplenishDay: 30,
    note: 'Беспроцентный период 1 месяц, внесение всей суммы раз в месяц',
  },
  {
    name: 'Райффайзен — Кредитка №1',
    type: 'CREDIT_CARD',
    paymentType: 'MIN_PAYMENT',
    principal: 45000,
    outstanding: 45000,
    annualRate: 49,
    startDate: DEFAULT_START,
    termMonths: 12,
    paymentDay: 30,
    frozen: true,
    freezeCycleDays: 30,
    graceReplenishSum: 45000,
    graceReplenishDay: 30,
    note: 'Беспроцентный период при соблюдении цикла заморозки',
  },
  {
    name: 'Райффайзен — Кредитка №2',
    type: 'CREDIT_CARD',
    paymentType: 'MIN_PAYMENT',
    principal: 45000,
    outstanding: 45000,
    annualRate: 49,
    startDate: DEFAULT_START,
    termMonths: 12,
    paymentDay: 30,
    frozen: true,
    freezeCycleDays: 30,
    graceReplenishSum: 45000,
    graceReplenishDay: 30,
    note: 'Беспроцентный период при соблюдении цикла заморозки',
  },
  {
    name: 'Райффайзен — Кредитка №3',
    type: 'CREDIT_CARD',
    paymentType: 'MIN_PAYMENT',
    principal: 45000,
    outstanding: 45000,
    annualRate: 49,
    startDate: DEFAULT_START,
    termMonths: 12,
    paymentDay: 30,
    frozen: true,
    freezeCycleDays: 30,
    graceReplenishSum: 45000,
    graceReplenishDay: 30,
    note: 'Беспроцентный период при соблюдении цикла заморозки',
  },
  {
    name: 'Альфабанк — Кредитка',
    type: 'CREDIT_CARD',
    paymentType: 'MIN_PAYMENT',
    principal: 40000,
    outstanding: 40000,
    annualRate: 34.5,
    startDate: DEFAULT_START,
    termMonths: 12,
    paymentDay: 30,
    frozen: true,
    freezeCycleDays: 30,
    graceReplenishSum: 40000,
    graceReplenishDay: 30,
    note: 'Беспроцентный период при соблюдении цикла заморозки',
  },

  // ——— БЕЗ ЗАМОРОЗКИ ———
  {
    name: 'Сбербанк — Кредитка',
    type: 'CREDIT_CARD',
    paymentType: 'MIN_PAYMENT',
    principal: 224279,
    outstanding: 224279,
    annualRate: 36,
    startDate: new Date(Date.UTC(2026, 10, 30)), // с 30.11.26
    termMonths: 12,
    paymentDay: 30,
    minPayment: 7034,
    note: 'Беспроцентный период с 30.11.26 по 30.11.27',
  },
  {
    name: 'ДарьяФинанс — Кредит',
    type: 'CONSUMER',
    paymentType: 'ANNUITY',
    principal: 284000,
    outstanding: 180000,
    annualRate: 37.2,
    startDate: new Date(Date.UTC(2025, 7, 1)), // 01.08.25
    termMonths: 60,
    paymentDay: 9,
    minPayment: 10483,
    earlyPayments: [{ amount: 30000, paidAt: new Date(Date.UTC(2026, 8, 10)) }], // 10.09.2026
    note: 'Срок 5 лет, был досрочный платёж 30 000 ₽',
  },
  {
    name: 'Халва — Кредитка',
    type: 'CREDIT_CARD',
    paymentType: 'MIN_PAYMENT',
    principal: 0,
    outstanding: 0,
    annualRate: 39,
    startDate: DEFAULT_START,
    termMonths: 1,
    paymentDay: 20,
    status: 'CLOSED',
    note: 'Закрыта',
  },
  {
    name: 'Сбербанк — Ипотека',
    type: 'MORTGAGE',
    paymentType: 'ANNUITY',
    principal: 2133000,
    outstanding: 2036541,
    annualRate: 19.8,
    startDate: new Date(Date.UTC(2024, 6, 16)), // 16.07.2024
    termMonths: 240, // 20 лет
    paymentDay: 20,
    minPayment: 35901,
    earlyPayments: [{ amount: 50000, paidAt: new Date(Date.UTC(2024, 7, 20)) }], // 20.08.2024
    note: 'Сумма 2 133 000 ₽ на 20 лет, досрочный платёж 50 000 ₽',
  },
  {
    name: 'Халва — Кредит',
    type: 'CONSUMER',
    paymentType: 'ANNUITY',
    principal: 83174,
    outstanding: 63667,
    annualRate: 24.9,
    startDate: new Date(Date.UTC(2024, 10, 15)), // 15.11.2024
    termMonths: 59, // по 18.10.2029
    paymentDay: 20,
    minPayment: 2513,
    note: 'Сумма 83 174 ₽ на 59 месяцев (по 18.10.2029)',
  },
  {
    name: 'Сплит',
    type: 'INSTALLMENT',
    paymentType: 'MIN_PAYMENT',
    principal: 79690,
    outstanding: 79690,
    annualRate: 34.99,
    startDate: DEFAULT_START,
    termMonths: 10,
    paymentDay: 25,
    minPayment: 8132,
    note: 'Рассрочка с процентом на 10 месяцев, без цикла заморозки',
  },
];

/**
 * Удаляет все кредиты пользователя и создаёт их заново по RESEED_ITEMS.
 * Возвращает количество удалённых и созданных продуктов.
 */
export async function reseedCredits(prisma: PrismaClient, email = RESEED_EMAIL) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error(`Пользователь ${email} не найден`);

  const deleted = await prisma.credit.deleteMany({ where: { userId: user.id } });

  for (const item of RESEED_ITEMS) {
    const early = item.earlyPayments ?? [];
    const totalPaid = early.reduce((s, p) => s + p.amount, 0);

    const credit = await prisma.credit.create({
      data: {
        userId: user.id,
        name: item.name,
        type: item.type,
        paymentType: item.paymentType,
        prepaymentMode: 'REDUCE_PAYMENT',
        principal: item.principal,
        outstanding: item.outstanding,
        annualRate: item.annualRate,
        startDate: item.startDate,
        termMonths: item.termMonths,
        paymentDay: item.paymentDay,
        minPayment: item.minPayment ?? null,
        gracePeriodEnds: null,
        graceReplenishSum: item.graceReplenishSum ?? null,
        graceReplenishDay: item.graceReplenishDay ?? null,
        frozen: item.frozen ?? false,
        freezeCycleDays: item.freezeCycleDays ?? null,
        freezeStartedAt: item.frozen ? new Date() : null,
        nextFreezeCheckAt:
          item.frozen && item.freezeCycleDays
            ? new Date(Date.now() + item.freezeCycleDays * 86_400_000)
            : null,
        status: item.status ?? 'ACTIVE',
        closedAt: item.status === 'CLOSED' ? new Date() : null,
        totalPaid,
      },
    });

    if (early.length) {
      await prisma.paymentEvent.createMany({
        data: early.map((p) => ({
          creditId: credit.id,
          kind: 'EARLY_PARTIAL' as const,
          amount: p.amount,
          paidAt: p.paidAt,
          note: item.note ?? null,
        })),
      });
    }

    // Строим график платежей, чтобы приложение показывало ближайший платёж,
    // дату свободы от долгов и переплату. Замороженные кредитки считаем как 0%.
    if (item.status !== 'CLOSED' && item.termMonths > 0) {
      const schedule = generateSchedule({
        type: item.paymentType,
        principal: item.principal,
        annualRate: effectiveAnnualRate(item.annualRate, item.frozen ?? false),
        startDate: item.startDate,
        termMonths: item.termMonths,
        paymentDay: item.paymentDay,
        minPayment: item.minPayment ?? null,
        gracePeriodEnds: null,
        graceReplenishSum: item.graceReplenishSum ?? null,
        graceReplenishDay: item.graceReplenishDay ?? null,
      });

      if (schedule.length > 0) {
        const isFixedSchedule = item.paymentType !== 'MIN_PAYMENT';
        const past = isFixedSchedule ? planPastPayments(schedule) : null;

        await prisma.paymentSchedule.createMany({
          data: schedule.map((row, index) => {
            const isPast = past !== null && index < past.paidCount;
            return {
              creditId: credit.id,
              dueDate: row.dueDate,
              amount: row.amount,
              principalPart: row.principalPart,
              interestPart: row.interestPart,
              status: isPast ? ('PAID' as const) : ('PENDING' as const),
              paidAt: isPast ? row.dueDate : null,
              paidAmount: isPast ? row.amount : null,
            };
          }),
        });
      }
    }
  }

  return { email, userId: user.id, deleted: deleted.count, created: RESEED_ITEMS.length };
}
