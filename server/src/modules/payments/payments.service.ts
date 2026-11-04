import type { PaymentType, PrepaymentMode } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { AppError } from '../../middlewares/errorHandler';
import { annuityPayment } from '../../utils/finance/annuity';
import { addMonths, daysInMonth, isoDate, monthsBetween, utcToday, withDayOfMonth } from '../../utils/finance/date';
import {
  accruedInterestFor,
  assertAmountWithinOutstanding,
  assertPrepaymentDate,
  CLOSE_THRESHOLD,
  prepaymentAnchorDate,
  rebuildSchedule,
} from '../../utils/finance/earlyRepayment';
import { crossedMilestone, milestoneMessage, paidPercent } from '../../utils/finance/milestones';
import { round2, toNumber } from '../../utils/finance/round';
import { sendUniquePush } from '../push/push.service';
import type { EarlyRepaymentDto, PayInstallmentDto } from './payments.schemas';

function nextDueDateAfter(date: Date, paymentDay?: number | null): Date {
  const base = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
  return withDayOfMonth(base, paymentDay ?? date.getUTCDate());
}

/** Отправка мотивационного уведомления о достижении отметки (не роняет основной поток). */
async function notifyMilestone(
  userId: string,
  creditId: string,
  creditName: string,
  prevPercent: number,
  newPercent: number,
): Promise<void> {
  const milestone = crossedMilestone(prevPercent, newPercent);
  if (milestone === null) return;

  const body = milestoneMessage(creditName, milestone);
  await sendUniquePush(userId, creditId, `MILESTONE_${milestone}`, `${userId}:MILESTONE:${creditId}:${milestone}`, {
    title: milestone >= 100 ? '🎉 Кредит закрыт!' : '🎉 Новый рубеж!',
    body,
    url: `/credits/${creditId}`,
  }).catch((err) => console.error('[milestone] Не удалось отправить push:', err));
}

export const paymentsService = {
  /** «Я оплатил» — отметить платёж по графику. Можно указать фактическую сумму и дату. */
  async payInstallment(userId: string, installmentId: string, dto: PayInstallmentDto = {}) {
    const installment = await prisma.paymentSchedule.findUnique({
      where: { id: installmentId },
      include: { credit: true },
    });

    if (!installment || installment.credit.userId !== userId) {
      throw new AppError(404, 'Платёж не найден');
    }
    if (installment.status === 'PAID') {
      throw new AppError(409, 'Этот платёж уже отмечен как оплаченный');
    }

    const scheduledAmount = toNumber(installment.amount);
    // Фактически внесённая сумма (по умолчанию — как в графике).
    const amount = round2(dto.amount ?? scheduledAmount);
    const scheduledPrincipal = toNumber(installment.principalPart);

    // Какую долю от графика реально внёс пользователь: от неё зависит,
    // на сколько уменьшится тело долга. При переплате тело гасится сильнее.
    const ratio = scheduledAmount > 0 ? amount / scheduledAmount : 1;
    const principalPart = round2(scheduledPrincipal * ratio);

    const credit = installment.credit;
    const prevPercent = paidPercent(toNumber(credit.principal), toNumber(credit.outstanding));
    const paidAt = dto.paidAt ?? new Date();

    const result = await prisma.$transaction(async (tx) => {
      const updatedInstallment = await tx.paymentSchedule.update({
        where: { id: installmentId },
        data: { status: 'PAID', paidAt, paidAmount: amount },
      });

      let updatedCredit = await tx.credit.update({
        where: { id: credit.id },
        data: {
          totalPaid: { increment: amount },
          outstanding: { decrement: principalPart },
        },
      });

      await tx.paymentEvent.create({
        data: {
          creditId: credit.id,
          kind: credit.paymentType === 'MIN_PAYMENT' ? 'MIN_PAYMENT' : 'SCHEDULED',
          amount,
          paidAt,
        },
      });

      // Полное закрытие
      if (toNumber(updatedCredit.outstanding) <= CLOSE_THRESHOLD) {
        updatedCredit = await tx.credit.update({
          where: { id: credit.id },
          data: { outstanding: 0, status: 'CLOSED', closedAt: new Date() },
        });
        await tx.paymentSchedule.deleteMany({ where: { creditId: credit.id, status: 'PENDING' } });
      }

      return { updatedInstallment, updatedCredit };
    });

    const newPercent = paidPercent(
      toNumber(result.updatedCredit.principal),
      toNumber(result.updatedCredit.outstanding),
    );
    await notifyMilestone(userId, credit.id, credit.name, prevPercent, newPercent);

    return result;
  },

  /** Отмена оплаченного платежа: возврат статуса в PENDING. */
  async cancelPayment(userId: string, installmentId: string) {
    const installment = await prisma.paymentSchedule.findUnique({
      where: { id: installmentId },
      include: { credit: true },
    });
    if (!installment || installment.credit.userId !== userId) {
      throw new AppError(404, 'Платёж не найден');
    }
    if (installment.status !== 'PAID') {
      throw new AppError(400, 'Платёж ещё не оплачен');
    }

    const credit = installment.credit;
    const amount = round2(toNumber(installment.paidAmount ?? installment.amount));
    const principalPart = round2(toNumber(installment.principalPart));
    const newOutstanding = round2(toNumber(credit.outstanding) + principalPart);
    const newTotalPaid = round2(Math.max(0, toNumber(credit.totalPaid) - amount));

    const result = await prisma.$transaction(async (tx) => {
      const updatedCredit = await tx.credit.update({
        where: { id: credit.id },
        data: {
          outstanding: newOutstanding,
          totalPaid: newTotalPaid,
          status: newOutstanding <= 0.01 ? 'CLOSED' : 'ACTIVE',
        },
      });
      await tx.paymentSchedule.update({
        where: { id: installmentId },
        data: { status: 'PENDING', paidAt: null, paidAmount: null },
      });
      return updatedCredit;
    });

    return result;
  },

  /** Досрочное погашение (частичное или полное) с пересборкой графика. */
  async earlyRepayment(userId: string, creditId: string, dto: EarlyRepaymentDto) {
    console.log('earlyRepayment start', { creditId, amount: dto.amount, date: dto.date });
    const credit = await prisma.credit.findFirst({
      where: { id: creditId, userId },
      include: {
        schedule: { orderBy: { dueDate: 'asc' } },
        events: { orderBy: { paidAt: 'asc' } },
      },
    });

    if (!credit) throw new AppError(404, 'Кредит не найден');
    if (credit.status === 'CLOSED') throw new AppError(409, 'Кредит уже закрыт');
    if (credit.type === 'LOAN') throw new AppError(400, 'Для частного займа досрочное погашение не поддерживается');
    if (credit.type === 'CREDIT_CARD') throw new AppError(400, 'Для кредитной карты досрочное погашение недоступно');
    if (!credit.termMonths || Number(credit.termMonths) <= 0) throw new AppError(400, 'Невозможно пересчитать график: не указан срок кредита');

    const amount = round2(toNumber(dto.amount));
    if (!amount || amount <= 0) throw new AppError(400, 'Сумма должна быть больше 0');
    console.log('earlyRepayment amount normalized', { amount });

    const prepaymentDate = dto.date ? new Date(dto.date) : utcToday();
    const prepaymentDateUTC = utcToday(prepaymentDate);

    const startDate = new Date(credit.startDate);
    const startDateUTC = utcToday(startDate);
    assertPrepaymentDate(prepaymentDateUTC, startDateUTC);

    const outstanding = toNumber(credit.outstanding);
    const annualRate = toNumber(credit.annualRate);

    // anchor = дата последнего начисления процентов: последний PAID-платёж
    // графика со сроком <= даты погашения, иначе дата выдачи.
    const anchorDate = prepaymentAnchorDate(credit.schedule, prepaymentDateUTC, startDateUTC);
    const { accruedInterest, days } = accruedInterestFor(outstanding, annualRate, anchorDate, prepaymentDateUTC);
    console.log('accruedInterest calculated', { accruedInterest, days, anchor: anchorDate.toISOString(), outstanding });
    const principalPart = round2(amount - accruedInterest);

    if (principalPart <= 0) {
      throw new AppError(400, `Сумма не покрывает начисленные проценты (${accruedInterest.toFixed(2)} ₽)`);
    }

    const newOutstanding = round2(outstanding - principalPart);
    console.log('principalPart calculated', { principalPart, accruedInterest, newOutstanding });
    assertAmountWithinOutstanding(amount, outstanding, accruedInterest);
    const isFull = newOutstanding <= CLOSE_THRESHOLD;
    const mode: PrepaymentMode = 'REDUCE_TERM';
    const prevPercent = paidPercent(toNumber(credit.principal), toNumber(credit.outstanding));

    const result = await prisma.$transaction(async (tx) => {
      await tx.paymentEvent.create({
        data: {
          creditId,
          kind: isFull ? 'EARLY_FULL' : 'EARLY_PARTIAL',
          amount,
          paidAt: prepaymentDateUTC,
          note: `проценты ${accruedInterest.toFixed(2)}, тело ${principalPart.toFixed(2)}${dto.note ? `; ${dto.note}` : ''}`,
        },
      });

      if (isFull) {
        const existingFull = await tx.paymentSchedule.findUnique({
          where: { creditId_dueDate: { creditId, dueDate: prepaymentDateUTC } },
        });
        if (existingFull) {
          await tx.paymentSchedule.update({
            where: { id: existingFull.id },
            data: {
              amount: { increment: amount },
              principalPart: { increment: round2(outstanding) },
              interestPart: { increment: round2(accruedInterest) },
              paidAmount: { increment: amount },
              paidAt: prepaymentDateUTC,
              status: 'PAID',
            },
          });
        } else {
          await tx.paymentSchedule.create({
            data: {
              creditId,
              dueDate: prepaymentDateUTC,
              amount,
              principalPart: round2(outstanding),
              interestPart: round2(accruedInterest),
              status: 'PAID',
              paidAt: prepaymentDateUTC,
              paidAmount: amount,
            },
          });
        }
        const closed = await tx.credit.update({
          where: { id: creditId },
          data: {
            outstanding: 0,
            totalPaid: { increment: amount },
            status: 'CLOSED',
            closedAt: new Date(),
          },
        });
        console.log('schedule updated/merged done');
      await tx.paymentSchedule.deleteMany({ where: { creditId, status: 'PENDING' } });
        return { credit: closed, schedule: [] as { dueDate: Date; amount: number }[] };
      }

      const updated = await tx.credit.update({
        where: { id: creditId },
        data: { outstanding: newOutstanding, totalPaid: { increment: amount } },
      });

      // Early repayment on the prepayment date (includes accrued interest).
      await tx.paymentSchedule.upsert({
        where: { creditId_dueDate: { creditId, dueDate: prepaymentDateUTC } },
        update: {
          status: 'PAID',
          paidAt: prepaymentDateUTC,
          amount: { increment: amount },
          paidAmount: { increment: amount },
          principalPart: { increment: principalPart },
          interestPart: { increment: accruedInterest },
        },
        create: {
          creditId,
          dueDate: prepaymentDateUTC,
          amount,
          principalPart,
          interestPart: accruedInterest,
          status: 'PAID',
          paidAt: prepaymentDateUTC,
          paidAmount: amount,
        },
      });

      await tx.paymentSchedule.deleteMany({ where: { creditId, status: 'PENDING' } });

      const remainingTerm = Math.max(
        1,
        monthsBetween(prepaymentDateUTC, addMonths(credit.startDate, credit.termMonths)),
      );
      const nextDueDate = nextDueDateAfter(prepaymentDateUTC, credit.paymentDay);

      const pending = credit.schedule.filter((s) => s.status === 'PENDING');
      const lastPaid = [...credit.schedule]
        .filter((s) => s.status === 'PAID')
        .sort((a, b) => b.dueDate.getTime() - a.dueDate.getTime())[0];
      const referencePayment = lastPaid ?? pending[0] ?? null;
      const referenceAnnuity = credit.paymentType === 'DIFFERENTIAL'
        ? null
        : (() => {
            try {
              return round2(annuityPayment(newOutstanding, annualRate, remainingTerm));
            } catch {
              return null;
            }
          })();

      let items;
      try {
        items = rebuildSchedule({
          outstanding: newOutstanding,
          annualRate,
          paymentType: credit.paymentType as PaymentType,
          remainingTermMonths: remainingTerm,
          nextDueDate,
          paymentDay: credit.paymentDay,
          previousPayment: credit.paymentType === 'DIFFERENTIAL'
            ? (referencePayment ? toNumber(referencePayment.principalPart) : null)
            : (referenceAnnuity ?? (referencePayment ? toNumber(referencePayment.amount) : null)),
          previousPrincipalPart: credit.paymentType === 'DIFFERENTIAL'
            ? (referencePayment ? toNumber(referencePayment.principalPart) : null)
            : (referencePayment ? toNumber(referencePayment.principalPart) : null),
        });
      } catch (err) {
        console.error('rebuildSchedule failed', err);
        throw new AppError(400, 'Не удалось пересчитать график досрочного погашения. Проверьте параметры кредита.');
      }

      if (!Array.isArray(items) || items.length === 0) {
        throw new AppError(400, 'Не удалось пересчитать график досрочного погашения. Пустой график после пересчёта.');
      }

      if (items.length > 0) {
        await tx.paymentSchedule.createMany({
          data: items.map((item) => ({
            creditId,
            dueDate: item.dueDate,
            amount: item.amount,
            principalPart: item.principalPart,
            interestPart: item.interestPart,
          })),
        skipDuplicates: true,
        });
      }

      return { credit: updated, schedule: items };
    });

    const newPercent = paidPercent(
      toNumber(result.credit.principal),
      toNumber(result.credit.outstanding),
    );
    await notifyMilestone(userId, creditId, credit.name, prevPercent, newPercent);

    console.log('earlyRepayment success');
    return result;
  },

  /**
   * Предпросмотр досрочного погашения: сколько сэкономится процентов и времени.
   * Ничего не пишет в БД — только считает «а что если».
   */
  async previewEarlyRepayment(userId: string, creditId: string, dto: EarlyRepaymentDto) {
    const credit = await prisma.credit.findFirst({
      where: { id: creditId, userId },
      include: {
        schedule: { orderBy: { dueDate: 'asc' } },
        events: { orderBy: { paidAt: 'asc' } },
      },
    });

    if (!credit) throw new AppError(404, 'Кредит не найден');
    if (credit.status === 'CLOSED') throw new AppError(409, 'Кредит уже закрыт');
    if (credit.type === 'LOAN') throw new AppError(400, 'Для частного займа досрочное погашение не поддерживается');
    if (credit.type === 'CREDIT_CARD') throw new AppError(400, 'Для кредитной карты досрочное погашение недоступно');
    if (!credit.termMonths || Number(credit.termMonths) <= 0) throw new AppError(400, 'Невозможно пересчитать график: не указан срок кредита');

    const amount = round2(toNumber(dto.amount));
    if (!amount || amount <= 0) throw new AppError(400, 'Сумма должна быть больше 0');

    const prepaymentDate = dto.date ? new Date(dto.date) : utcToday();
    const prepaymentDateUTC = utcToday(prepaymentDate);

    const startDate = new Date(credit.startDate);
    const startDateUTC = utcToday(startDate);
    assertPrepaymentDate(prepaymentDateUTC, startDateUTC);

    const outstanding = toNumber(credit.outstanding);
    const annualRate = toNumber(credit.annualRate);

    const anchorDate = prepaymentAnchorDate(credit.schedule, prepaymentDateUTC, startDateUTC);
    const { accruedInterest, days } = accruedInterestFor(outstanding, annualRate, anchorDate, prepaymentDateUTC);
    const principalPart = round2(amount - accruedInterest);
    assertAmountWithinOutstanding(amount, outstanding, accruedInterest);

    const pending = credit.schedule.filter((item) => item.status === 'PENDING');

    // Что осталось заплатить процентов по текущему графику.
    const currentInterest = round2(
      pending.reduce((acc, item) => acc + toNumber(item.interestPart), 0),
    );
    const currentTotal = round2(pending.reduce((acc, item) => acc + toNumber(item.amount), 0));

    const effectiveDate = isoDate(prepaymentDateUTC);
    const minAmount = round2(accruedInterest + 0.01);
    const coversInterest = principalPart > 0;
    const paymentBefore = pending[0] ? round2(toNumber(pending[0].amount)) : 0;

    if (!coversInterest) {
      return {
        isFull: false,
        amount,
        newOutstanding: outstanding,
        monthSaved: 0,
        interestSaved: 0,
        interestAfter: currentInterest,
        totalAfter: currentTotal,
        currentTotal,
        paymentBefore,
        paymentAfter: paymentBefore,
        monthsAfter: pending.length,
        accruedInterest,
        principalPart,
        days,
        coversInterest,
        minAmount,
        effectiveDate,
      };
    }

    const newOutstanding = round2(outstanding - principalPart);
    const isFull = newOutstanding <= CLOSE_THRESHOLD;

    if (isFull) {
      return {
        isFull: true,
        amount,
        newOutstanding: 0,
        monthSaved: pending.length,
        interestSaved: round2(Math.max(0, currentInterest)),
        interestAfter: 0,
        totalAfter: 0,
        currentTotal,
        paymentBefore,
        paymentAfter: 0,
        accruedInterest,
        principalPart: round2(outstanding),
        days,
        coversInterest,
        minAmount,
        effectiveDate,
      };
    }

    const nextDueDate = pending[0]?.dueDate ?? addMonths(prepaymentDateUTC, 1);
    const remainingTerm = Math.max(
      1,
      monthsBetween(prepaymentDateUTC, addMonths(credit.startDate, credit.termMonths)),
    );

    const items = rebuildSchedule({
      outstanding: newOutstanding,
      annualRate,
      paymentType: credit.paymentType as PaymentType,
      remainingTermMonths: remainingTerm,
      nextDueDate,
      paymentDay: credit.paymentDay,
      previousPayment: pending[0] ? toNumber(pending[0].amount) : null,
      previousPrincipalPart: pending[0] ? toNumber(pending[0].principalPart) : null,
    });

    const newInterest = round2(items.reduce((acc, item) => acc + item.interestPart, 0));
    const newTotal = round2(items.reduce((acc, item) => acc + item.amount, 0));

    return {
      isFull: false,
      amount,
      newOutstanding,
      monthSaved: Math.max(0, pending.length - items.length),
      interestSaved: round2(Math.max(0, currentInterest - newInterest)),
      interestAfter: newInterest,
      totalAfter: newTotal,
      currentTotal,
      paymentBefore,
      paymentAfter: items[0] ? round2(items[0].amount) : 0,
      monthsAfter: items.length,
      accruedInterest,
      principalPart,
      days,
      coversInterest,
      minAmount,
      effectiveDate,
    };
  },
};
