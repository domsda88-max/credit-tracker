import type { PaymentType, PrepaymentMode } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { AppError } from '../../middlewares/errorHandler';
import { addMonths, monthsBetween, utcToday } from '../../utils/finance/date';
import { rebuildSchedule } from '../../utils/finance/earlyRepayment';
import { crossedMilestone, milestoneMessage, paidPercent } from '../../utils/finance/milestones';
import { round2, toNumber } from '../../utils/finance/round';
import { sendUniquePush } from '../push/push.service';
import type { EarlyRepaymentDto } from './payments.schemas';

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
  /** «Я оплатил» — отметить платёж по графику. */
  async payInstallment(userId: string, installmentId: string) {
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

    const amount = toNumber(installment.amount);
    const principalPart = toNumber(installment.principalPart);
    const credit = installment.credit;
    const prevPercent = paidPercent(toNumber(credit.totalPaid), toNumber(credit.principal));

    const result = await prisma.$transaction(async (tx) => {
      const updatedInstallment = await tx.paymentSchedule.update({
        where: { id: installmentId },
        data: { status: 'PAID', paidAt: new Date(), paidAmount: amount },
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
      toNumber(result.updatedCredit.totalPaid),
      toNumber(result.updatedCredit.principal),
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
    const prevPercent = paidPercent(toNumber(credit.totalPaid), toNumber(credit.principal));

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
      toNumber(result.credit.totalPaid),
      toNumber(result.credit.principal),
    );
    await notifyMilestone(userId, creditId, credit.name, prevPercent, newPercent);

    return result;
  },
};
