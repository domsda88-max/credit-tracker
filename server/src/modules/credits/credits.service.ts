import type { Credit, PaymentType, Prisma, PrepaymentMode } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { AppError } from '../../middlewares/errorHandler';
import { addMonths, addUTCDays, monthsBetween, utcToday } from '../../utils/finance/date';
import { planPastPayments } from '../../utils/finance/pastPayments';
import { rebuildSchedule } from '../../utils/finance/earlyRepayment';
import { generateSchedule } from '../../utils/finance/schedule';
import { round2, toNumber } from '../../utils/finance/round';
import type { CreateCreditDto, ToggleFreezeDto, UpdateCreditDto } from './credits.schemas';

/** Поля, изменение которых требует пересборки графика платежей. */
const FINANCIAL_FIELDS: (keyof UpdateCreditDto)[] = [
  'principal',
  'annualRate',
  'startDate',
  'termMonths',
  'paymentType',
  'paymentDay',
];

async function getOwnedCredit(userId: string, creditId: string): Promise<Credit> {
  const credit = await prisma.credit.findFirst({ where: { id: creditId, userId } });
  if (!credit) throw new AppError(404, 'Кредит не найден');
  return credit;
}

export const creditsService = {
  /** Создание кредита + генерация графика платежей одной транзакцией. */
  async create(userId: string, dto: CreateCreditDto) {
    const schedule = generateSchedule({
      type: dto.paymentType,
      principal: dto.principal,
      annualRate: dto.annualRate,
      startDate: dto.startDate,
      termMonths: dto.termMonths,
      paymentDay: dto.paymentDay,
      minPayment: dto.minPayment,
      gracePeriodEnds: dto.gracePeriodEnds,
      graceReplenishSum: dto.graceReplenishSum,
      graceReplenishDay: dto.graceReplenishDay,
    });

    if (schedule.length === 0) {
      throw new AppError(400, 'Не удалось построить график платежей — проверьте параметры кредита');
    }

    const frozen = dto.frozen ?? false;

    // Кредит, оформленный раньше: платежи, дата которых уже прошла,
    // сразу помечаем внесёнными и вычитаем их тело из остатка долга.
    const markPast =
      dto.markPastAsPaid ??
      (dto.startDate.getTime() < utcToday().getTime() && dto.paymentType !== 'MIN_PAYMENT');
    const past = markPast ? planPastPayments(schedule) : null;

    return prisma.$transaction(async (tx) => {
      const credit = await tx.credit.create({
        data: {
          userId,
          name: dto.name,
          type: dto.type,
          paymentType: dto.paymentType,
          prepaymentMode: (dto.prepaymentMode ?? 'REDUCE_PAYMENT') as PrepaymentMode,
          principal: dto.principal,
          outstanding: dto.outstanding ?? past?.outstanding ?? dto.principal,
          annualRate: dto.annualRate,
          startDate: dto.startDate,
          termMonths: dto.termMonths,
          paymentDay: dto.paymentDay ?? null,
          minPayment: dto.minPayment ?? null,
          gracePeriodEnds: dto.gracePeriodEnds ?? null,
          graceReplenishSum: dto.graceReplenishSum ?? null,
          graceReplenishDay: dto.graceReplenishDay ?? null,
          frozen,
          freezeCycleDays: dto.freezeCycleDays ?? null,
          freezeStartedAt: frozen ? new Date() : null,
          nextFreezeCheckAt: frozen && dto.freezeCycleDays ? addUTCDays(new Date(), dto.freezeCycleDays) : null,
          totalPaid: past?.paidTotal ?? 0,
        },
      });

      await tx.paymentSchedule.createMany({
        data: schedule.map((item, index) => {
          const isPast = past !== null && index < past.paidCount;
          return {
            creditId: credit.id,
            dueDate: item.dueDate,
            amount: item.amount,
            principalPart: item.principalPart,
            interestPart: item.interestPart,
            status: isPast ? 'PAID' : 'PENDING',
            paidAt: isPast ? item.dueDate : null,
            paidAmount: isPast ? item.amount : null,
          };
        }),
      });

      // Журнал: оплаченные ранее платежи отражаются в истории.
      if (past && past.paidCount > 0) {
        const kind = dto.paymentType === 'MIN_PAYMENT' ? 'MIN_PAYMENT' : 'SCHEDULED';
        await tx.paymentEvent.createMany({
          data: schedule.slice(0, past.paidCount).map((item) => ({
            creditId: credit.id,
            kind,
            amount: item.amount,
            paidAt: item.dueDate,
            note: 'Учтён как оплаченный при добавлении',
          })),
        });
      }

      return credit;
    });
  },

  /** Список кредитов с ближайшим платежом и сводкой. */
  async list(userId: string) {
    const credits = await prisma.credit.findMany({
      where: { userId },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      include: {
        schedule: {
          where: { status: 'PENDING' },
          orderBy: { dueDate: 'asc' },
          take: 1,
        },
      },
    });

    return credits.map(({ schedule, ...credit }) => ({
      ...credit,
      nextPayment: schedule[0] ?? null,
    }));
  },

  /**
   * Сводка по всем кредитам: общий прогресс, дата финансовой свободы и переплата.
   * Дата свободы = последний платёж по графику среди активных кредитов.
   * Переплата = сумма всех платежей по графику − первоначальный долг (если бы платили по графику).
   */
  async summary(userId: string) {
    const credits = await prisma.credit.findMany({
      where: { userId },
      include: { schedule: { orderBy: { dueDate: 'asc' } } },
    });

    const active = credits.filter((c) => c.status === 'ACTIVE');

    let principalSum = 0;
    let outstandingSum = 0;
    let totalPaidSum = 0;
    let scheduledTotal = 0; // сколько всего ещё и уже запланировано по графику
    let lastDueDate: Date | null = null;

    for (const c of active) {
      principalSum += toNumber(c.principal);
      outstandingSum += Math.max(0, toNumber(c.outstanding));
      totalPaidSum += toNumber(c.totalPaid);

      for (const item of c.schedule) {
        scheduledTotal += toNumber(item.amount);
        if (!lastDueDate || item.dueDate.getTime() > lastDueDate.getTime()) {
          lastDueDate = item.dueDate;
        }
      }
    }

    // Переплата: сколько процентов сверх тела уйдёт банку, если платить строго по графику.
    const overpay = scheduledTotal - principalSum;

    return {
      activeCount: active.length,
      closedCount: credits.length - active.length,
      principalSum: round2(principalSum),
      outstandingSum: round2(outstandingSum),
      paidByPrincipal: round2(Math.max(0, principalSum - outstandingSum)),
      totalPaidSum: round2(totalPaidSum),
      scheduledTotal: round2(scheduledTotal),
      overpay: round2(Math.max(0, overpay)),
      debtFreeDate: lastDueDate ? lastDueDate.toISOString() : null,
    };
  },

  /** Полная карточка кредита: график + журнал платежей. */
  async getById(userId: string, creditId: string) {
    const credit = await prisma.credit.findFirst({
      where: { id: creditId, userId },
      include: {
        schedule: { orderBy: { dueDate: 'asc' } },
        events: { orderBy: { paidAt: 'desc' }, take: 50 },
      },
    });

    if (!credit) throw new AppError(404, 'Кредит не найден');
    return credit;
  },

  /**
   * Полный экспорт данных пользователя: кредиты с графиками и журналом платежей.
   * Не привязан к формату — клиент превращает это в JSON-файл (бэкап) или CSV.
   */
  async exportData(userId: string) {
    const credits = await prisma.credit.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      include: {
        schedule: { orderBy: { dueDate: 'asc' } },
        events: { orderBy: { paidAt: 'asc' } },
      },
    });

    return {
      exportedAt: new Date().toISOString(),
      version: 1,
      credits,
    };
  },

  /** Обновление. Если меняются финансовые условия — график пересобирается. */
  async update(userId: string, creditId: string, dto: UpdateCreditDto) {
    const current = await getOwnedCredit(userId, creditId);

    const data: Prisma.CreditUpdateInput = {};
    // Служебные поля создания не пишем напрямую в кредит.
    const SKIP_FIELDS = new Set(['markPastAsPaid', 'outstanding']);
    for (const [key, value] of Object.entries(dto)) {
      if (value !== undefined && !SKIP_FIELDS.has(key)) {
        (data as Record<string, unknown>)[key] = value;
      }
    }

    const financialChanged =
      FINANCIAL_FIELDS.some((field) => dto[field] !== undefined) || dto.outstanding !== undefined;

    // Меняются сами условия (сумма/ставка/дата/срок) — тогда график действительно пересобираем.
    const termsChanged = FINANCIAL_FIELDS.some((field) => dto[field] !== undefined);

    // Управление «снежинкой» 🧊
    if (dto.frozen !== undefined) {
      if (dto.frozen && !current.frozen) {
        data.freezeStartedAt = new Date();
        data.nextFreezeCheckAt = current.freezeCycleDays
          ? addUTCDays(new Date(), current.freezeCycleDays)
          : null;
      }
      if (!dto.frozen) {
        data.freezeStartedAt = null;
        data.nextFreezeCheckAt = null;
      }
    }

    return prisma.$transaction(async (tx) => {
      const updated = await tx.credit.update({ where: { id: creditId }, data });

      if (!financialChanged) return updated;

      const paidCount = await tx.paymentSchedule.count({
        where: { creditId, status: 'PAID' },
      });
      const nextPending = await tx.paymentSchedule.findFirst({
        where: { creditId, status: 'PENDING' },
        orderBy: { dueDate: 'asc' },
      });

      const merged = {
        type: dto.paymentType ?? current.paymentType,
        principal: dto.principal ?? toNumber(current.principal),
        annualRate: dto.annualRate ?? toNumber(current.annualRate),
        startDate: dto.startDate ?? current.startDate,
        termMonths: dto.termMonths ?? current.termMonths,
        paymentDay: dto.paymentDay ?? current.paymentDay,
        minPayment: dto.minPayment ?? (current.minPayment ? toNumber(current.minPayment) : null),
        gracePeriodEnds: dto.gracePeriodEnds ?? current.gracePeriodEnds,
        graceReplenishSum:
          dto.graceReplenishSum ?? (current.graceReplenishSum ? toNumber(current.graceReplenishSum) : null),
        graceReplenishDay: dto.graceReplenishDay ?? current.graceReplenishDay,
      };

      let pastToMark = 0;
      // Значения прошедших платежей для записи в кредит (числа, а не Decimal).
      let totalPaidValue: number | undefined;
      let outstandingValue: number | undefined = dto.outstanding ?? undefined;

      // Готовим план пересборки графика.
      const mergeInput = {
        type: merged.type as PaymentType,
        principal: merged.principal,
        annualRate: merged.annualRate,
        startDate: merged.startDate,
        termMonths: merged.termMonths,
        paymentDay: merged.paymentDay,
        minPayment: merged.minPayment,
        gracePeriodEnds: merged.gracePeriodEnds,
        graceReplenishSum: merged.graceReplenishSum,
        graceReplenishDay: merged.graceReplenishDay,
      };
      const freshPlan = planPastPayments(generateSchedule(mergeInput));

      // Если кредит оформлен в прошлом (есть прошедшие платежи) — всегда строим
      // график целиком от исходных условий и заново отмечаем прошедшие.
      // Ручная правка только остатка график не трогает.
      const rebuildFromStart = termsChanged && (paidCount === 0 || freshPlan.paidCount > 0);

      const items = rebuildFromStart
        ? (() => {
            const rebuilt = generateSchedule(mergeInput);
            const pastPlan = planPastPayments(rebuilt);
            totalPaidValue = pastPlan.paidTotal;
            outstandingValue = dto.outstanding ?? pastPlan.outstanding;
            pastToMark = pastPlan.paidCount;
            return rebuilt;
          })()
        : (() => {
            const remaining = monthsBetween(
              utcToday(),
              addMonths(merged.startDate, merged.termMonths),
            );
            return rebuildSchedule({
              outstanding: toNumber(updated.outstanding),
              annualRate: merged.annualRate,
              paymentType: merged.type as PaymentType,
              mode: updated.prepaymentMode as PrepaymentMode,
              remainingTermMonths: Math.max(1, remaining),
              nextDueDate: nextPending ? nextPending.dueDate : addMonths(utcToday(), 1),
              paymentDay: merged.paymentDay,
              previousPayment: nextPending ? toNumber(nextPending.amount) : null,
              previousPrincipalPart: nextPending ? toNumber(nextPending.principalPart) : null,
            });
          })();

      // Ручная правка только остатка — расписание и история оплат остаются как есть,
      // но сам остаток долга записываем.
      if (!termsChanged) {
        if (dto.outstanding != null) {
          return tx.credit.update({ where: { id: creditId }, data: { outstanding: dto.outstanding } });
        }
        return updated;
      }

      // Все ранее оплаченные строки заменяются новыми — старые удаляем целиком.
      await tx.paymentSchedule.deleteMany({ where: { creditId } });
      await tx.paymentSchedule.createMany({
        data: items.map((item, index) => {
          const isPast = index < pastToMark;
          return {
            creditId,
            dueDate: item.dueDate,
            amount: item.amount,
            principalPart: item.principalPart,
            interestPart: item.interestPart,
            status: isPast ? 'PAID' : 'PENDING',
            paidAt: isPast ? item.dueDate : null,
            paidAmount: isPast ? item.amount : null,
          };
        }),
      });

      await tx.credit.update({
        where: { id: creditId },
        data: {
          ...(totalPaidValue !== undefined ? { totalPaid: totalPaidValue } : {}),
          ...(outstandingValue !== undefined ? { outstanding: outstandingValue } : {}),
        },
      });

      return updated;
    });
  },

  /** Переключить «снежинку» (цикл заморозки). */
  async toggleFreeze(userId: string, creditId: string, dto: ToggleFreezeDto) {
    return this.update(userId, creditId, { frozen: dto.frozen });
  },

  async remove(userId: string, creditId: string) {
    await getOwnedCredit(userId, creditId);
    await prisma.credit.delete({ where: { id: creditId } });
  },
};
