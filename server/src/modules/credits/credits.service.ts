import type { Credit, PaymentType, Prisma, PrepaymentMode } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { AppError } from '../../middlewares/errorHandler';
import { addMonths, addUTCDays, monthsBetween, utcToday } from '../../utils/finance/date';
import { buildMicroloanSchedule } from '../../utils/finance/microloan';
import { planPastPayments } from '../../utils/finance/pastPayments';
import { rebuildSchedule, applyHistoricalPrepayments } from '../../utils/finance/earlyRepayment';
import { generateSchedule } from '../../utils/finance/schedule';
import { effectiveAnnualRate } from '../../utils/finance/effectiveRate';
import { simulateAccelerator } from '../../utils/finance/accelerator';
import { round2, toNumber } from '../../utils/finance/round';
import type { CreateCreditDto, ToggleFreezeDto, UpdateCreditDto } from './credits.schemas';

/** Дополнительный взнос в месяц для прогноза «свобода от долгов» (₽). */
const ACCELERATOR_EXTRA = 10_000;

/** Поля, изменение которых требует пересборки графика платежей. */
const FINANCIAL_FIELDS: (keyof UpdateCreditDto)[] = [
  'principal',
  'annualRate',
  'startDate',
  'termMonths',
  'termDays',
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
    const frozen = dto.frozen ?? false;
    const isLoan = dto.type === 'LOAN';
    const isMicroloan = dto.type === 'MICROLOAN';

    if (isLoan) {
      // Частный заём — без графика, ставка 0%
      return prisma.credit.create({
        data: {
          userId,
          name: dto.name,
          type: 'LOAN' as any,
          paymentType: 'ANNUITY' as any,
          prepaymentMode: (dto.prepaymentMode ?? 'REDUCE_TERM') as PrepaymentMode,
          principal: dto.principal,
          outstanding: dto.outstanding ?? dto.principal,
          annualRate: 0,
          startDate: dto.startDate ?? new Date(),
          termMonths: 0,
          paymentDay: null,
          minPayment: null,
          gracePeriodEnds: null,
          graceReplenishSum: null,
          graceReplenishDay: null,
          frozen: false,
          freezeCycleDays: null,
          freezeStartedAt: null,
          nextFreezeCheckAt: null,
          totalPaid: 0,
        },
      });
    }

    if (isMicroloan) {
      // МФО — баллонный платёж в конце срока (в днях)
      const termDays = dto.termDays ?? 30;
      const termMonthsForStorage = Math.max(1, Math.ceil(termDays / 30));
      const startDate = dto.startDate ?? new Date();

      const schedule = buildMicroloanSchedule({
        principal: dto.principal,
        annualRate: dto.annualRate ?? 0,
        startDate,
        termDays,
        paymentDay: dto.paymentDay,
      });

      return prisma.$transaction(async (tx) => {
        const credit = await tx.credit.create({
          data: {
            userId,
            name: dto.name,
            type: 'MICROLOAN' as any,
            paymentType: 'ANNUITY' as any,
            prepaymentMode: (dto.prepaymentMode ?? 'REDUCE_TERM') as PrepaymentMode,
            principal: dto.principal,
            outstanding: dto.principal,
            annualRate: dto.annualRate ?? 0,
            startDate,
            termMonths: termMonthsForStorage,
            paymentDay: dto.paymentDay ?? null,
            minPayment: null,
            gracePeriodEnds: null,
            graceReplenishSum: null,
            graceReplenishDay: null,
            frozen: false,
            freezeCycleDays: null,
            freezeStartedAt: null,
            nextFreezeCheckAt: null,
            totalPaid: 0,
          },
        });

        await tx.paymentSchedule.createMany({
          data: schedule.map((item) => ({
            creditId: credit.id,
            dueDate: item.dueDate,
            amount: item.amount,
            principalPart: item.principalPart,
            interestPart: item.interestPart,
            status: 'PENDING',
          })),
        });

        return credit;
      });
    }

    const schedule = generateSchedule({
      type: dto.paymentType!,
      principal: dto.principal,
      // Замороженная кредитка: проценты не начисляются → считаем как 0%.
      annualRate: effectiveAnnualRate(dto.annualRate ?? 0, frozen),
      startDate: dto.startDate ?? new Date(),
      termMonths: dto.termMonths ?? 0,
      paymentDay: dto.paymentDay,
      minPayment: dto.minPayment,
      gracePeriodEnds: dto.gracePeriodEnds,
      graceReplenishSum: dto.graceReplenishSum,
      graceReplenishDay: dto.graceReplenishDay,
    });

    // Пустой график допустим для карты в цикле заморозки: минимального платежа
    // и срока у неё нет, платится только сумма обновления периода.
    const freezeCycleCard = frozen && dto.paymentType === 'MIN_PAYMENT';

    if (schedule.length === 0 && !freezeCycleCard) {
      throw new AppError(400, 'Не удалось построить график платежей — проверьте параметры кредита');
    }

    // Кредит, оформленный раньше: платежи, дата которых уже прошла,
    // сразу помечаем внесёнными и вычитаем их тело из остатка долга.
    const markPast =
      dto.markPastAsPaid ??
      ((dto.startDate ? dto.startDate.getTime() < utcToday().getTime() : false) &&
        dto.paymentType !== 'MIN_PAYMENT');
    // markPastAsPaid — явное разрешение импорта; сама по себе дата не считается
    // подтверждением оплаты. Без явного флага поведение остаётся осторожным.
    const past = markPast
      ? planPastPayments(schedule, undefined, {
          assumeAllDuePaid: dto.markPastAsPaid === true,
        })
      : null;

    return prisma.$transaction(async (tx) => {
      const credit = await tx.credit.create({
        data: {
          userId,
          name: dto.name,
          type: dto.type,
          paymentType: dto.paymentType!,
          prepaymentMode: (dto.prepaymentMode ?? 'REDUCE_TERM') as PrepaymentMode,
          principal: dto.principal,
          outstanding: dto.outstanding ?? past?.outstanding ?? dto.principal,
          annualRate: dto.annualRate ?? 0,
          startDate: dto.startDate ?? new Date(),
          termMonths: dto.termMonths!,
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

      if (dto.earlyRepayments && dto.earlyRepayments.length > 0) {
        const { outstanding: newOutstanding, schedule: newSchedule } = applyHistoricalPrepayments(
          dto.principal,
          dto.annualRate ?? 0,
          dto.paymentType!,
          dto.startDate ?? new Date(),
          dto.termMonths ?? 0,
          dto.paymentDay ?? null,
          dto.earlyRepayments.map((er) => ({ amount: er.amount, date: new Date(er.date) })),
        );

        await tx.credit.update({
          where: { id: credit.id },
          data: { outstanding: newOutstanding },
        });

        await tx.paymentSchedule.deleteMany({ where: { creditId: credit.id } });
        await tx.paymentSchedule.createMany({
          data: newSchedule.map((item) => ({
            creditId: credit.id,
            dueDate: item.dueDate,
            amount: item.amount,
            principalPart: item.principalPart,
            interestPart: item.interestPart,
            status: 'PENDING',
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
  async summary(userId: string, extraPerMonth: number = ACCELERATOR_EXTRA) {
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
    let monthlyPayments = 0; // ближайшие обязательные платежи по всем активным долгам
    let graceReplenishTotal = 0;
    let graceItems: { name: string; amount: number; dueDate: string | null }[] = [];

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

      // Ежемесячная нагрузка: сумма платежей, приходящих в ТЕКУЩЕМ
      // календарном месяце (с 1 по последнее число). Не «все платежи
      // по всем кредитам навсегда», а только те, что в этом месяце.
      const isCreditCard = c.type === 'CREDIT_CARD';
      if (!(c.frozen && isCreditCard)) {
        const pending = (c.schedule || []).filter((i: any) => i.status === 'PENDING');
        let mp = 0;
        if (isCreditCard) {
          const nonGrace = pending.find((i: any) => !(toNumber(i.interestPart) === 0 && toNumber(i.amount) === toNumber(c.graceReplenishSum)));
          if (nonGrace) mp = toNumber(nonGrace.amount);
          else if (pending.length > 0) mp = 0; // в грейсе — живёт в блоке грейса
          else mp = toNumber(c.minPayment ?? 0);
        } else {
          const first = pending[0];
          if (first) mp = toNumber(first.amount);
        }
        monthlyPayments += mp;
      }

      // Карты в цикле заморозки: нет обязательного платежа по графику,
      // но есть сумма обновления грейс-периода — показываем отдельно,
      // в «Платежи в месяц» НЕ включаем (это «переливание», не расход).
      if (c.frozen && c.graceReplenishSum) {
        graceReplenishTotal += toNumber(c.graceReplenishSum);
        graceItems.push({
          name: c.name,
          amount: toNumber(c.graceReplenishSum),
          dueDate: c.nextFreezeCheckAt ? c.nextFreezeCheckAt.toISOString() : null,
        });
      }
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { monthlyIncome: true },
    });
    const monthlyIncome = user?.monthlyIncome ? toNumber(user.monthlyIncome) : null;

    // Переплата: сколько процентов сверх тела уйдёт банку, если платить строго по графику.
    const overpay = scheduledTotal - principalSum;

    // Сколько реально внесено за последние 12 месяцев (по журналу платежей).
    const since = new Date();
    since.setUTCFullYear(since.getUTCFullYear() - 1);
    const yearAgg = await prisma.paymentEvent.aggregate({
      where: { credit: { userId }, paidAt: { gte: since } },
      _sum: { amount: true },
      _count: true,
    });

    // Прогноз «что если вносить +10 000 ₽ в месяц в самый дорогой долг».
    //
    // Карты в цикле заморозки НЕ уменьшают тело долга: сумма обновления периода
    // лишь продлевает льготный период. Поэтому в симуляции для них
    // ежемесячное погашение = 0, а ставка = 0 (пока заморожены).
    const baselineMonths = lastDueDate ? Math.max(0, monthsBetween(utcToday(), lastDueDate)) : 0;

    const accelerator = simulateAccelerator({
      extraPerMonth,
      baselineMonths,
      debts: active
        .map((c) => {
          const balance = Math.max(0, toNumber(c.outstanding));
          if (balance <= 0) return null;

          const next = c.schedule.find((s) => s.status === 'PENDING');
          const isFreezeCycle = c.frozen && c.freezeCycleDays !== null;
          const minPayment = isFreezeCycle
            ? 0
            : next
              ? toNumber(next.amount)
              : Math.max(balance * 0.03, 0);

          return {
            id: c.id,
            name: c.name,
            annualRate: isFreezeCycle ? 0 : toNumber(c.annualRate),
            balance,
            minPayment,
          };
        })
        .filter((d): d is NonNullable<typeof d> => d !== null),
    });

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
      paidLast12Months: round2(toNumber(yearAgg._sum.amount ?? 0)),
      paymentsLast12Months: yearAgg._count,
      monthlyPayments: round2(monthlyPayments),
      monthlyIncome: monthlyIncome === null ? null : round2(monthlyIncome),
      freeMoney:
        monthlyIncome === null ? null : round2(monthlyIncome - monthlyPayments),
      graceReplenishTotal: round2(graceReplenishTotal),
      graceItems,
      accelerator,
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

    const freezeChanged = dto.frozen !== undefined && dto.frozen !== current.frozen;
    const financialChanged =
      FINANCIAL_FIELDS.some((field) => dto[field] !== undefined) || dto.outstanding !== undefined || dto.markPastAsPaid !== undefined;

    // Меняются сами условия (сумма/ставка/дата/срок) — тогда график действительно пересобираем.
    // Заморозка меняет эффективную ставку (🧊 = 0%), поэтому тоже требует пересборки.
    const termsChanged =
      FINANCIAL_FIELDS.some((field) => dto[field] !== undefined) || dto.outstanding !== undefined || dto.markPastAsPaid !== undefined;

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

      // Итоговое состояние заморозки: что прислали в dto, иначе — текущее.
      const willBeFrozen = dto.frozen ?? current.frozen;
      const effectiveRate = effectiveAnnualRate(merged.annualRate, willBeFrozen);

      let pastToMark = 0;
      // Значения прошедших платежей для записи в кредит (числа, а не Decimal).
      let totalPaidValue: number | undefined;
      let outstandingValue: number | undefined = dto.outstanding ?? undefined;

      // Готовим план пересборки графика.
      const mergeInput = {
        type: merged.type as PaymentType,
        principal: merged.principal,
        annualRate: effectiveRate,
        startDate: merged.startDate,
        termMonths: merged.termMonths,
        paymentDay: merged.paymentDay,
        minPayment: merged.minPayment,
        gracePeriodEnds: merged.gracePeriodEnds,
        graceReplenishSum: merged.graceReplenishSum,
        graceReplenishDay: merged.graceReplenishDay,
      };
      const freshPlan = planPastPayments(generateSchedule(mergeInput));

      // Карта в цикле заморозки: графика минимальных платежей нет.
      // Пустая пересборка — это норма, а не ошибка; старые строки просто удаляем.
      const freezeCycleCard = willBeFrozen && merged.type === 'MIN_PAYMENT';

      // Если кредит оформлен в прошлом (есть прошедшие платежи) — всегда строим
      // график целиком от исходных условий и заново отмечаем прошедшие.
      // Ручная правка только остатка график не трогает.
      const rebuildFromStart =
        termsChanged && (freezeCycleCard || paidCount === 0 || freshPlan.paidCount > 0);

      const items = rebuildFromStart
        ? (() => {
            const rebuilt = generateSchedule(mergeInput);
            const markPast = dto.markPastAsPaid === true;
            if (markPast) {
              const pastPlan = planPastPayments(rebuilt, undefined, {
                assumeAllDuePaid: dto.markPastAsPaid === true,
              });
              totalPaidValue = pastPlan.paidTotal;
              outstandingValue = dto.outstanding ?? pastPlan.outstanding;
              pastToMark = pastPlan.paidCount;
            } else {
              totalPaidValue = undefined;
              outstandingValue = dto.outstanding !== undefined ? (dto.outstanding ?? undefined) : outstandingValue;
              pastToMark = 0;
            }
            return rebuilt;
          })()
        : (() => {
            const remaining = monthsBetween(
              utcToday(),
              addMonths(merged.startDate, merged.termMonths),
            );
            return rebuildSchedule({
              outstanding: toNumber(updated.outstanding),
              annualRate: effectiveRate,
              paymentType: merged.type as PaymentType,

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

  /**
   * «Я внёс сумму обновления периода» — пользователь подтверждает, что
   * обновил беспроцентный период. Сдвигаем дату следующей проверки
   * на полный цикл вперёд и фиксируем платёж в журнале.
   */
  async renewFreezeCycle(userId: string, creditId: string) {
    const credit = await getOwnedCredit(userId, creditId);

    if (!credit.frozen) throw new AppError(400, 'Кредит не в цикле заморозки');

    const cycleDays = credit.freezeCycleDays ?? 30;
    const amount = credit.graceReplenishSum ? toNumber(credit.graceReplenishSum) : 0;
    const today = utcToday();

    return prisma.$transaction(async (tx) => {
      // Атомарная проверка цикла. Конкурентный или повторный вызов получает
      // count = 0 и не изменяет Credit, даты, балансы и журнал.
      const renewal = await tx.credit.updateMany({
        where: {
          id: creditId,
          userId,
          frozen: true,
          OR: [
            { nextFreezeCheckAt: null },
            { nextFreezeCheckAt: { lte: today } },
          ],
        },
        data: {
          freezeStartedAt: today,
          nextFreezeCheckAt: addUTCDays(today, cycleDays),
          ...(amount > 0
            ? {
                totalPaid: { increment: amount },
                outstanding: { decrement: Math.min(amount, toNumber(credit.outstanding)) },
              }
            : {}),
        },
      });

      if (renewal.count !== 1) {
        throw new AppError(409, 'Льготный период уже обновлён в текущем цикле');
      }

      if (amount > 0) {
        await tx.paymentEvent.create({
          data: {
            creditId,
            kind: 'MIN_PAYMENT',
            amount,
            paidAt: today,
            note: 'Обновление беспроцентного периода',
          },
        });
      }

      return tx.credit.findUnique({ where: { id: creditId } });
    });
  },

  async remove(userId: string, creditId: string) {
    await getOwnedCredit(userId, creditId);
    await prisma.credit.delete({ where: { id: creditId } });
  },
};
