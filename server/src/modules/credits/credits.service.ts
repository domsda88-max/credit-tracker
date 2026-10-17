import type { Credit, PaymentType, Prisma, PrepaymentMode } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { AppError } from '../../middlewares/errorHandler';
import { addMonths, addUTCDays, monthsBetween, utcToday } from '../../utils/finance/date';
import { rebuildSchedule } from '../../utils/finance/earlyRepayment';
import { generateSchedule } from '../../utils/finance/schedule';
import { toNumber } from '../../utils/finance/round';
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

    return prisma.$transaction(async (tx) => {
      const credit = await tx.credit.create({
        data: {
          userId,
          name: dto.name,
          type: dto.type,
          paymentType: dto.paymentType,
          prepaymentMode: (dto.prepaymentMode ?? 'REDUCE_PAYMENT') as PrepaymentMode,
          principal: dto.principal,
          outstanding: dto.principal,
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
        },
      });

      await tx.paymentSchedule.createMany({
        data: schedule.map((item) => ({
          creditId: credit.id,
          dueDate: item.dueDate,
          amount: item.amount,
          principalPart: item.principalPart,
          interestPart: item.interestPart,
        })),
      });

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

  /** Обновление. Если меняются финансовые условия — график пересобирается. */
  async update(userId: string, creditId: string, dto: UpdateCreditDto) {
    const current = await getOwnedCredit(userId, creditId);

    const data: Prisma.CreditUpdateInput = {};
    for (const [key, value] of Object.entries(dto)) {
      if (value !== undefined) {
        (data as Record<string, unknown>)[key] = value;
      }
    }

    const financialChanged = FINANCIAL_FIELDS.some((field) => dto[field] !== undefined);

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

      // Нет оплаченных строк — строим график заново по новым условиям.
      const items =
        paidCount === 0
          ? generateSchedule(merged)
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

      await tx.paymentSchedule.deleteMany({ where: { creditId, status: 'PENDING' } });
      await tx.paymentSchedule.createMany({
        data: items.map((item) => ({
          creditId,
          dueDate: item.dueDate,
          amount: item.amount,
          principalPart: item.principalPart,
          interestPart: item.interestPart,
        })),
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
