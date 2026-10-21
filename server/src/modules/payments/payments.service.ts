import type { PaymentType, PrepaymentMode } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { AppError } from '../../middlewares/errorHandler';
import { addMonths, monthsBetween, utcToday } from '../../utils/finance/date';
import { rebuildSchedule } from '../../utils/finance/earlyRepayment';
import { crossedMilestone, milestoneMessage, paidPercent } from '../../utils/finance/milestones';
import { round2, toNumber } from '../../utils/finance/round';
import { sendUniquePush } from '../push/push.service';
import type { EarlyRepaymentDto, PayInstallmentDto } from './payments.schemas';

const CLOSE_THRESHOLD = 0.01; // меньше копейки — считаем долг закрытым

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

  /** Досрочное погашение (частичное или полное) с пересборкой графика. */
  async earlyRepayment(userId: string, creditId: string, dto: EarlyRepaymentDto) {
    const credit = await prisma.credit.findFirst({
      where: { id: creditId, userId },
      include: {
        schedule: { where: { status: 'PENDING' }, orderBy: { dueDate: 'asc' }, take: 1 },
      },
    });

    if (!credit) throw new AppError(404, 'Кредит не найден');
    if (credit.status === 'CLOSED') throw new AppError(409, 'Кредит уже закрыт');

    const outstanding = toNumber(credit.outstanding);
    const newOutstanding = round2(outstanding - dto.amount);
    const isFull = newOutstanding <= CLOSE_THRESHOLD;
    const mode = (dto.mode ?? credit.prepaymentMode) as PrepaymentMode;
    const prevPercent = paidPercent(toNumber(credit.principal), toNumber(credit.outstanding));

    const result = await prisma.$transaction(async (tx) => {
      await tx.paymentEvent.create({
        data: {
          creditId,
          kind: isFull ? 'EARLY_FULL' : 'EARLY_PARTIAL',
          amount: dto.amount,
          note: dto.note,
        },
      });

      if (isFull) {
        const closed = await tx.credit.update({
          where: { id: creditId },
          data: {
            outstanding: 0,
            totalPaid: { increment: dto.amount },
            status: 'CLOSED',
            closedAt: new Date(),
          },
        });
        await tx.paymentSchedule.deleteMany({ where: { creditId, status: 'PENDING' } });
        return { credit: closed, schedule: [] as { dueDate: Date; amount: number }[] };
      }

      const updated = await tx.credit.update({
        where: { id: creditId },
        data: { outstanding: newOutstanding, totalPaid: { increment: dto.amount } },
      });

      await tx.paymentSchedule.deleteMany({ where: { creditId, status: 'PENDING' } });

      const remainingTerm = Math.max(
        1,
        monthsBetween(utcToday(), addMonths(credit.startDate, credit.termMonths)),
      );
      const nextDueDate = credit.schedule[0]?.dueDate ?? addMonths(utcToday(), 1);

      const items = rebuildSchedule({
        outstanding: newOutstanding,
        annualRate: toNumber(credit.annualRate),
        paymentType: credit.paymentType as PaymentType,
        mode,
        remainingTermMonths: remainingTerm,
        nextDueDate,
        paymentDay: credit.paymentDay,
        previousPayment: credit.schedule[0] ? toNumber(credit.schedule[0].amount) : null,
        previousPrincipalPart: credit.schedule[0] ? toNumber(credit.schedule[0].principalPart) : null,
      });

      if (items.length > 0) {
        await tx.paymentSchedule.createMany({
          data: items.map((item) => ({
            creditId,
            dueDate: item.dueDate,
            amount: item.amount,
            principalPart: item.principalPart,
            interestPart: item.interestPart,
          })),
        });
      }

      return { credit: updated, schedule: items };
    });

    const newPercent = paidPercent(
      toNumber(result.credit.principal),
      toNumber(result.credit.outstanding),
    );
    await notifyMilestone(userId, creditId, credit.name, prevPercent, newPercent);

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
      },
    });

    if (!credit) throw new AppError(404, 'Кредит не найден');

    const outstanding = toNumber(credit.outstanding);
    const newOutstanding = round2(outstanding - dto.amount);
    const isFull = newOutstanding <= CLOSE_THRESHOLD;
    const mode = (dto.mode ?? credit.prepaymentMode) as PrepaymentMode;

    const pending = credit.schedule.filter((item) => item.status === 'PENDING');

    // Что осталось заплатить процентов по текущему графику.
    const currentInterest = round2(
      pending.reduce((acc, item) => acc + toNumber(item.interestPart), 0),
    );
    const currentTotal = round2(pending.reduce((acc, item) => acc + toNumber(item.amount), 0));

    if (isFull) {
      return {
        isFull: true,
        amount: dto.amount,
        newOutstanding: 0,
        monthSaved: pending.length,
        interestSaved: round2(Math.max(0, currentInterest)),
        interestAfter: 0,
        totalAfter: 0,
        paymentBefore: pending[0] ? round2(toNumber(pending[0].amount)) : 0,
        paymentAfter: 0,
      };
    }

    const nextDueDate = pending[0]?.dueDate ?? addMonths(utcToday(), 1);
    const remainingTerm = Math.max(
      1,
      monthsBetween(utcToday(), addMonths(credit.startDate, credit.termMonths)),
    );

    const items = rebuildSchedule({
      outstanding: newOutstanding,
      annualRate: toNumber(credit.annualRate),
      paymentType: credit.paymentType as PaymentType,
      mode,
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
      amount: dto.amount,
      newOutstanding,
      monthSaved: Math.max(0, pending.length - items.length),
      interestSaved: round2(Math.max(0, currentInterest - newInterest)),
      interestAfter: newInterest,
      totalAfter: newTotal,
      currentTotal,
      paymentBefore: pending[0] ? round2(toNumber(pending[0].amount)) : 0,
      paymentAfter: items[0] ? round2(items[0].amount) : 0,
      monthsAfter: items.length,
    };
  },
};
