import type { PaymentType, Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { AppError } from '../../middlewares/errorHandler';
import { addMonths, daysInMonth, isoDate, monthsBetween, parseISODateOnly, utcToday, withDayOfMonth } from '../../utils/finance/date';
import { accruedInterestFor, assertPrepaymentDate, CLOSE_THRESHOLD, prepaymentAnchorDate, scheduleAfterPrepayment, splitPrepaymentAmount } from '../../utils/finance/earlyRepayment';
import { allocatePayment } from '../../utils/finance/paymentAllocation';
import { crossedMilestone, milestoneMessage, paidPercent } from '../../utils/finance/milestones';
import { round2, toNumber } from '../../utils/finance/round';
import { sendUniquePush } from '../push/push.service';
import type { EarlyRepaymentDto, ImportPaymentsDto, PayInstallmentDto } from './payments.schemas';

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

interface CreditSnapshot {
  id: string;
  status: string;
  outstanding: unknown;
  totalPaid?: unknown;
  overpaymentBalance?: unknown;
}

/** Ключ идемпотентности всегда ограничен пользователем и типом операции. */
function scopedIdempotencyKey(
  userId: string,
  scope: string,
  rawKey: string | undefined,
): string | undefined {
  if (!rawKey) return undefined;
  return `${userId}:${scope}:${rawKey}`;
}

/**
 * Повтор после сетевого таймаута должен вернуть 409, а не второй платёж.
 * Уникальный индекс в БД — вторая линия защиты при параллельных запросах.
 */
async function assertNoDuplicateEvent(
  tx: Prisma.TransactionClient,
  idempotencyKey: string | undefined,
): Promise<void> {
  if (!idempotencyKey) return;
  const existing = await tx.paymentEvent.findFirst({ where: { idempotencyKey } });
  if (existing) {
    throw new AppError(409, 'Платёж уже применён, повторная отправка проигнорирована');
  }
}

/**
 * Сравниваем состояние кредита с данными, которые читал запрос. Если пока
 * читали, другой платёж изменил outstanding/баланс — транзакция откатывается.
 */
async function claimCreditUnchanged(
  tx: Prisma.TransactionClient,
  credit: CreditSnapshot,
  includeTotals = false,
): Promise<void> {
  const where: Prisma.CreditWhereInput = {
    id: credit.id,
    status: credit.status as any,
    outstanding: credit.outstanding as any,
  };
  if (includeTotals) {
    where.totalPaid = credit.totalPaid as any;
    where.overpaymentBalance = (credit.overpaymentBalance ?? 0) as any;
  }

  const claimed = await tx.credit.updateMany({
    where,
    // No-op обновление: само совпадение where и есть оптимистичная блокировка.
    data: { outstanding: credit.outstanding as any },
  });
  if (claimed.count !== 1) {
    throw new AppError(409, 'Данные кредита изменились, попробуйте обновить страницу');
  }
}

interface ImportCreditState {
  id: string;
  status: string;
  paymentType: PaymentType;
  outstanding: unknown;
}

/**
 * Импорт применяет много строк подряд — остаток надо перечитывать внутри
 * транзакции, иначе вторая строка увидит баланс до первой и переплата будет
 * посчитана неверно.
 */
async function importCreditState(
  tx: Prisma.TransactionClient,
  creditId: string,
): Promise<ImportCreditState> {
  const credit = await tx.credit.findUnique({
    where: { id: creditId },
    select: { id: true, status: true, paymentType: true, outstanding: true },
  });
  if (!credit) throw new AppError(404, 'Кредит не найден');
  return credit as ImportCreditState;
}

interface ApplyPaymentArgs {
  installment: {
    id: string;
    amount: unknown;
    principalPart: unknown;
    interestPart: unknown;
    paidAmount?: unknown;
    paidPrincipalPart?: unknown;
    paidInterestPart?: unknown;
    paidOverpayment?: unknown;
  };
  credit: { id: string; paymentType: PaymentType; outstanding: unknown };
  amount: number;
  paidAt: Date;
  idempotencyKey?: string;
}

/**
 * Единственная точка записи фактического платежа: и кнопка «Я оплатил»,
 * и импорт обязаны идти через неё — иначе разъедутся outstanding/totalPaid
 * и журнал PaymentEvent. guardPending отсекает двойное применение при гонке.
 */
async function applyPayment(
  tx: Prisma.TransactionClient,
  { installment, credit, amount, paidAt, idempotencyKey }: ApplyPaymentArgs,
  guardPending = false,
) {
  const allocation = allocatePayment({
    scheduledAmount: toNumber(installment.amount),
    scheduledPrincipal: toNumber(installment.principalPart),
    scheduledInterest: toNumber(installment.interestPart),
    paidBefore: toNumber(installment.paidAmount ?? 0),
    paidPrincipalBefore: toNumber(installment.paidPrincipalPart ?? 0),
    paidInterestBefore: toNumber(installment.paidInterestPart ?? 0),
    paidOverpaymentBefore: toNumber(installment.paidOverpayment ?? 0),
    amount,
    outstanding: toNumber(credit.outstanding),
  });

  const data = {
    status: allocation.status,
    paidAt,
    paidAmount: allocation.totalPaid,
    paidPrincipalPart: allocation.totalPrincipal,
    paidInterestPart: allocation.totalInterest,
    paidOverpayment: allocation.totalOverpayment,
  };
  let updatedInstallment = null;

  if (guardPending) {
    // Атомарный claim: статус и предыдущая сумма должны совпадать с прочитанной.
    // Второй параллельный запрос (или повтор после таймаута) получит count=0.
    const claimed = await tx.paymentSchedule.updateMany({
      where: {
        id: installment.id,
        status: { in: ['PENDING', 'PARTIALLY_PAID'] },
        paidAmount: installment.paidAmount ?? null,
      },
      data,
    });
    if (claimed.count === 0) return null;
  } else {
    updatedInstallment = await tx.paymentSchedule.update({ where: { id: installment.id }, data });
  }

  let updatedCredit = await tx.credit.update({
    where: { id: credit.id },
    data: {
      totalPaid: { increment: amount },
      // Переплата НЕ уменьшает тело долга — она лежит отдельным остатком.
      outstanding: { decrement: allocation.principalToBalance },
      overpaymentBalance: { increment: allocation.overpayment },
    },
  });

  // События в сумме дают фактически внесённые деньги: основное событие — всё,
  // что пошло в долг/проценты, отдельное — только излишек сверх остатка.
  await tx.paymentEvent.create({
    data: {
      creditId: credit.id,
      scheduleId: installment.id,
      kind: credit.paymentType === 'MIN_PAYMENT' ? 'MIN_PAYMENT' : 'SCHEDULED',
      amount: round2(amount - allocation.overpayment),
      paidAt,
      note:
        allocation.status === 'PARTIALLY_PAID'
          ? 'Частичная оплата по графику'
          : allocation.overpayment > 0
            ? `В погашение ${round2(amount - allocation.overpayment).toFixed(2)}, переплата ${allocation.overpayment.toFixed(2)}`
            : null,
      idempotencyKey,
    },
  });

  if (allocation.overpayment > 0) {
    await tx.paymentEvent.create({
      data: {
        creditId: credit.id,
        scheduleId: installment.id,
        kind: 'OVERPAYMENT',
        amount: allocation.overpayment,
        paidAt,
        note: 'Излишек сверх остатка долга — не погашение тела',
      },
    });
  }

  // Полное закрытие
  if (toNumber(updatedCredit.outstanding) <= CLOSE_THRESHOLD) {
    updatedCredit = await tx.credit.update({
      where: { id: credit.id },
      data: { outstanding: 0, status: 'CLOSED', closedAt: new Date() },
    });
    await tx.paymentSchedule.deleteMany({ where: { creditId: credit.id, status: 'PENDING' } });
  }

  return { updatedInstallment, updatedCredit };
}

/**
 * Отказ в отмене закрывающего платежа фиксируется в аудите, но НЕ меняет
 * кредит, график и исходный PaymentEvent. Повтор попытки обновляет ту же запись
 * (dedupKey), а не создаёт копии.
 */
async function recordBlockedCancelAudit(
  userId: string,
  creditId: string,
  installmentId: string,
  reason: string,
): Promise<void> {
  const dedupKey = `${userId}:CANCEL_BLOCKED:${installmentId}`;
  try {
    await prisma.auditEvent.upsert({
      where: { dedupKey },
      create: { userId, creditId, installmentId, kind: 'CANCEL_BLOCKED', reason, dedupKey },
      update: { reason, creditId },
    });
  } catch (err) {
    // Аудит не должен менять финансовый ответ: основная ошибка 409 остаётся.
    console.error('[audit] Не удалось записать отказ отмены:', err);
  }
}

export const paymentsService = {
  /** «Я оплатил» — отметить платёж по графику. Можно указать фактическую сумму и дату. */
  async payInstallment(
    userId: string,
    installmentId: string,
    dto: PayInstallmentDto = {},
    idempotencyKey?: string,
  ) {
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
    if (installment.status !== 'PENDING' && installment.status !== 'PARTIALLY_PAID') {
      throw new AppError(409, 'Платёж нельзя оплатить в текущем статусе');
    }

    const credit = installment.credit;
    // Фактически внесённая сумма (по умолчанию — как в графике).
    const amount = round2(dto.amount ?? toNumber(installment.amount));
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new AppError(400, 'Сумма платежа должна быть больше нуля');
    }
    // Переплата принимается и учитывается отдельно (overpaymentBalance + событие),
    // но никогда не уменьшает outstanding ниже нуля.
    const prevPercent = paidPercent(toNumber(credit.principal), toNumber(credit.outstanding));
    const paidAt = dto.paidAt ?? new Date();
    const eventKey = scopedIdempotencyKey(userId, `pay:${installmentId}`, idempotencyKey);

    // Два металлических замка: CAS по строке графика (guardPending) и CAS по
    // состоянию кредита. Плюс ключ идемпотентности против повтора после таймаута.
    const result = await prisma.$transaction(async (tx) => {
      await assertNoDuplicateEvent(tx, eventKey);
      await claimCreditUnchanged(tx, credit);
      return applyPayment(
        tx,
        { installment, credit, amount, paidAt, idempotencyKey: eventKey },
        true,
      );
    });

    if (!result) {
      throw new AppError(409, 'Этот платёж уже отмечен как оплаченный');
    }

    const newPercent = paidPercent(
      toNumber(result.updatedCredit.principal),
      toNumber(result.updatedCredit.outstanding),
    );
    await notifyMilestone(userId, credit.id, credit.name, prevPercent, newPercent);

    return result;
  },

  /**
   * Массовый импорт фактических оплат (round-trip CSV).
   * Строки применяются по возрастанию даты платежа: от порядка зависит
   * закрытие кредита и удаление оставшихся PENDING-строк.
   * Milestone-уведомления при импорте не отправляются.
   */
  async importPayments(userId: string, dto: ImportPaymentsDto) {
    const failed: Array<{ row: number; reason: string }> = [];
    let created = 0;
    let skipped = 0;

    const credits = await prisma.credit.findMany({
      where: { userId },
      select: { id: true, name: true, status: true, paymentType: true, outstanding: true },
    });

    // 1. Сопоставляем строки с кредитами и проверяем даты.
    const resolved: Array<{
      row: number;
      credit: (typeof credits)[number];
      dueDate: Date;
      paidAt: Date;
      amount?: number;
    }> = [];

    dto.rows.forEach((row, index) => {
      const rowNumber = index + 1;
      let credit: (typeof credits)[number] | undefined;

      if (row.creditId) {
        credit = credits.find((item) => item.id === row.creditId);
        if (!credit) {
          failed.push({ row: rowNumber, reason: 'Кредит не найден' });
          return;
        }
      } else {
        const matches = credits.filter((item) => item.name.trim() === row.creditName.trim());
        if (matches.length === 0) {
          failed.push({ row: rowNumber, reason: `Кредит «${row.creditName}» не найден` });
          return;
        }
        if (matches.length > 1) {
          failed.push({
            row: rowNumber,
            reason: `Несколько кредитов с именем «${row.creditName}» — выберите нужный`,
          });
          return;
        }
        credit = matches[0];
      }

      if (credit.status === 'CLOSED') {
        failed.push({ row: rowNumber, reason: `Кредит «${credit.name}» уже закрыт` });
        return;
      }

      const dueDate = parseISODateOnly(row.dueDate);
      if (!dueDate) {
        failed.push({ row: rowNumber, reason: 'Некорректная дата платежа' });
        return;
      }
      // Старые файлы без колонки «Дата оплаты»: считаем датой оплаты дату по графику.
      const paidAt = row.paidAt ? parseISODateOnly(row.paidAt) : dueDate;
      if (!paidAt) {
        failed.push({ row: rowNumber, reason: 'Некорректная дата оплаты' });
        return;
      }

      resolved.push({ row: rowNumber, credit, dueDate, paidAt, amount: row.amount });
    });

    // 2. Одним запросом поднимаем график всех задействованных кредитов.
    const creditIds = [...new Set(resolved.map((item) => item.credit.id))];
    const schedule = creditIds.length
      ? await prisma.paymentSchedule.findMany({
          where: { creditId: { in: creditIds } },
          select: {
            id: true,
            creditId: true,
            dueDate: true,
            amount: true,
            principalPart: true,
            interestPart: true,
            paidAmount: true,
            paidPrincipalPart: true,
            paidInterestPart: true,
            paidOverpayment: true,
            status: true,
          },
        })
      : [];
    const byKey = new Map(
      schedule.map((item) => [`${item.creditId}:${isoDate(item.dueDate)}`, item]),
    );

    // 3. Отбираем PENDING: уже оплаченное — skipped, отсутствующее в графике — failed.
    const toApply: Array<{
      row: number;
      credit: (typeof credits)[number];
      installment: (typeof schedule)[number];
      dueDate: Date;
      paidAt: Date;
      amount: number;
    }> = [];

    for (const item of resolved) {
      const installment = byKey.get(`${item.credit.id}:${isoDate(item.dueDate)}`);
      if (!installment) {
        failed.push({
          row: item.row,
          reason: `Платёж от ${isoDate(item.dueDate)} не найден в графике`,
        });
        continue;
      }
      if (installment.status === 'PAID') {
        skipped += 1;
        continue;
      }
      toApply.push({
        ...item,
        installment,
        amount: round2(item.amount ?? toNumber(installment.amount)),
      });
    }

    // 4. Чанками: 2000 отдельных транзакций через pooler — слишком долго.
    toApply.sort(
      (a, b) => a.dueDate.getTime() - b.dueDate.getTime() || a.credit.id.localeCompare(b.credit.id),
    );

    const CHUNK_SIZE = 100;
    for (let start = 0; start < toApply.length; start += CHUNK_SIZE) {
      const chunk = toApply.slice(start, start + CHUNK_SIZE);
      try {
        const result = await prisma.$transaction(
          async (tx) => {
            const applied: Array<{ row: number; ok: boolean }> = [];
            const creditStates = new Map<string, ImportCreditState>();
            for (const item of chunk) {
              let credit = creditStates.get(item.credit.id);
              if (!credit) {
                credit = await importCreditState(tx, item.credit.id);
                creditStates.set(credit.id, credit);
              }
              if (credit.status === 'CLOSED') {
                applied.push({ row: item.row, ok: false });
                continue;
              }
              const payment = await applyPayment(
                tx,
                {
                  installment: item.installment,
                  credit,
                  amount: item.amount,
                  paidAt: item.paidAt,
                },
                true,
              );
              if (payment) {
                creditStates.set(credit.id, {
                  ...credit,
                  outstanding: payment.updatedCredit.outstanding,
                });
              }
              applied.push({ row: item.row, ok: payment !== null });
            }
            return applied;
          },
          { timeout: 30_000 },
        );

        for (const item of result) {
          if (item.ok) created += 1;
          else skipped += 1;
        }
      } catch (error) {
        // Чанк откатился целиком — повторяем построчно, чтобы точно указать виновника.
        console.error('[payments.import] чанк не сохранён, повторяю построчно:', error);
        for (const item of chunk) {
          try {
            const payment = await prisma.$transaction(async (tx) => {
              const credit = await importCreditState(tx, item.credit.id);
              if (credit.status === 'CLOSED') return null;
              return applyPayment(
                tx,
                {
                  installment: item.installment,
                  credit,
                  amount: item.amount,
                  paidAt: item.paidAt,
                },
                true,
              );
            });
            if (payment) created += 1;
            else skipped += 1;
          } catch (rowError) {
            failed.push({
              row: item.row,
              reason:
                rowError instanceof AppError ? rowError.message : 'Не удалось сохранить платёж',
            });
          }
        }
      }
    }

    failed.sort((a, b) => a.row - b.row);
    return { created, skipped, failed };
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
    if (installment.status !== 'PAID' && installment.status !== 'PARTIALLY_PAID') {
      throw new AppError(400, 'Платёж ещё не оплачен');
    }

    const credit = installment.credit;
    // Отказ — не отмена: Credit, график и исходный PaymentEvent остаются нетронутыми.
    if (credit.status === 'CLOSED') {
      const reason = 'Платёж закрыл кредит; PENDING-строки графика удалены при закрытии';
      await recordBlockedCancelAudit(userId, credit.id, installmentId, reason);
      throw new AppError(409, 'Нельзя отменить платёж, которым был полностью закрыт кредит');
    }

    const amount = round2(toNumber(installment.paidAmount ?? installment.amount));
    // Для старых строк без разбивки используем плановое тело (legacy-поведение).
    const principalToRestore = round2(
      toNumber(installment.paidPrincipalPart ?? installment.principalPart),
    );
    const overpaymentToRestore = round2(
      Math.min(toNumber(installment.paidOverpayment ?? 0), toNumber(credit.overpaymentBalance ?? 0)),
    );
    const totalPaidToRestore = round2(Math.min(amount, toNumber(credit.totalPaid)));

    const result = await prisma.$transaction(async (tx) => {
      // CAS по кредиту и по строке графика: параллельная оплата или повтор отмены
      // изменят прочитанные значения и не пройдут guard.
      await claimCreditUnchanged(tx, credit, true);
      const claimed = await tx.paymentSchedule.updateMany({
        where: {
          id: installmentId,
          status: { in: ['PAID', 'PARTIALLY_PAID'] },
          paidAmount: installment.paidAmount ?? null,
        },
        data: { status: 'PENDING', paidAt: null, paidAmount: null },
      });
      if (claimed.count !== 1) {
        throw new AppError(409, 'Платёж уже изменён, попробуйте обновить страницу');
      }

      await tx.paymentSchedule.update({
        where: { id: installmentId },
        data: {
          paidPrincipalPart: null,
          paidInterestPart: null,
          paidOverpayment: null,
        },
      });

      const updatedCredit = await tx.credit.update({
        where: { id: credit.id },
        data: {
          outstanding: { increment: principalToRestore },
          totalPaid: { decrement: totalPaidToRestore },
          overpaymentBalance: { decrement: overpaymentToRestore },
          status: 'ACTIVE',
        },
      });

      // Историю не удаляем: помечаем только события отменяемого платежа.
      await tx.paymentEvent.updateMany({
        where: { scheduleId: installmentId, cancelledAt: null },
        data: { cancelledAt: new Date() },
      });

      return updatedCredit;
    });

    return result;
  },

  /** Досрочное погашение (частичное или полное) с пересборкой графика. */
  async earlyRepayment(
    userId: string,
    creditId: string,
    dto: EarlyRepaymentDto,
    idempotencyKey?: string,
  ) {
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
    if (credit.type === 'MICROLOAN') throw new AppError(400, 'Для микрозайма досрочное погашение с пересчётом графика недоступно');
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

    // anchor = дата последнего начисления процентов: последний PAID-платёж
    // графика со сроком <= даты погашения, иначе дата выдачи.
    const anchorDate = prepaymentAnchorDate(credit.schedule, prepaymentDateUTC, startDateUTC);
    const { accruedInterest, days } = accruedInterestFor(outstanding, annualRate, anchorDate, prepaymentDateUTC);
    const split = splitPrepaymentAmount(amount, outstanding, accruedInterest);
    const { principalPart, principalToBalance, overpayment, newOutstanding } = split;

    if (principalPart <= 0) {
      throw new AppError(400, `Сумма не покрывает начисленные проценты (${accruedInterest.toFixed(2)} ₽)`);
    }

    const isFull = newOutstanding <= CLOSE_THRESHOLD;
    const prevPercent = paidPercent(toNumber(credit.principal), toNumber(credit.outstanding));
    const eventKey = scopedIdempotencyKey(userId, `early:${creditId}`, idempotencyKey);
    const debtPart = round2(amount - overpayment);

    const result = await prisma.$transaction(async (tx) => {
      await assertNoDuplicateEvent(tx, eventKey);
      await claimCreditUnchanged(tx, credit);

      // В истории: основное событие — деньги, пошедшие в долг/проценты;
      // отдельное событие — только излишек. Вместе они равны фактической сумме.
      await tx.paymentEvent.create({
        data: {
          creditId,
          kind: isFull ? 'EARLY_FULL' : 'EARLY_PARTIAL',
          amount: debtPart,
          paidAt: prepaymentDateUTC,
          note: `проценты ${accruedInterest.toFixed(2)}, тело ${principalToBalance.toFixed(2)}${overpayment > 0 ? `, переплата ${overpayment.toFixed(2)}` : ''}${dto.note ? `; ${dto.note}` : ''}`,
          idempotencyKey: eventKey,
        },
      });
      if (overpayment > 0) {
        await tx.paymentEvent.create({
          data: {
            creditId,
            kind: 'OVERPAYMENT',
            amount: overpayment,
            paidAt: prepaymentDateUTC,
            note: 'Излишек сверх остатка долга — не погашение тела',
          },
        });
      }

      if (isFull) {
        const existingFull = await tx.paymentSchedule.findUnique({
          where: { creditId_dueDate: { creditId, dueDate: prepaymentDateUTC } },
        });
        if (existingFull) {
          // Если строка уже оплачена — это дополнительный платёж. Если она ещё ожидала
          // оплаты, досрочка ЗАМЕНЯЕТ её: инкремент удваивал бы сумму в графике.
          const alreadyPaid = existingFull.status === 'PAID';
          await tx.paymentSchedule.update({
            where: { id: existingFull.id },
            data: alreadyPaid
              ? {
                  amount: { increment: amount },
                  principalPart: { increment: principalToBalance },
                  interestPart: { increment: accruedInterest },
                  paidAmount: { increment: amount },
                  paidPrincipalPart: { increment: principalToBalance },
                  paidInterestPart: { increment: accruedInterest },
                  paidOverpayment: { increment: overpayment },
                  paidAt: prepaymentDateUTC,
                  status: 'PAID',
                }
              : {
                  amount,
                  principalPart: principalToBalance,
                  interestPart: accruedInterest,
                  paidAmount: amount,
                  paidPrincipalPart: principalToBalance,
                  paidInterestPart: accruedInterest,
                  paidOverpayment: overpayment,
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
              principalPart: principalToBalance,
              interestPart: accruedInterest,
              paidAmount: amount,
              paidPrincipalPart: principalToBalance,
              paidInterestPart: accruedInterest,
              paidOverpayment: overpayment,
              status: 'PAID',
              paidAt: prepaymentDateUTC,
            },
          });
        }
        const closed = await tx.credit.update({
          where: { id: creditId },
          data: {
            outstanding: 0,
            totalPaid: { increment: amount },
            overpaymentBalance: { increment: overpayment },
            status: 'CLOSED',
            closedAt: new Date(),
          },
        });
        await tx.paymentSchedule.deleteMany({ where: { creditId, status: 'PENDING' } });
        return { credit: closed, schedule: [] as { dueDate: Date; amount: number }[] };
      }

      const updated = await tx.credit.update({
        where: { id: creditId },
        data: {
          outstanding: newOutstanding,
          totalPaid: { increment: amount },
          overpaymentBalance: { increment: overpayment },
        },
      });

      // Early repayment on the prepayment date (includes accrued interest).
      // Если в этот день уже есть НЕоплаченная строка графика, досрочка заменяет
      // её, а не прибавляется к ней: иначе paidAmount удваивался, а остаток — нет.
      const existingOnDate = await tx.paymentSchedule.findUnique({
        where: { creditId_dueDate: { creditId, dueDate: prepaymentDateUTC } },
      });
      const alreadyPaid = existingOnDate?.status === 'PAID';
      const updateData: Prisma.PaymentScheduleUpdateInput = alreadyPaid
        ? {
            status: 'PAID',
            paidAt: prepaymentDateUTC,
            amount: { increment: amount },
            paidAmount: { increment: amount },
            principalPart: { increment: principalToBalance },
            interestPart: { increment: accruedInterest },
            paidPrincipalPart: { increment: principalToBalance },
            paidInterestPart: { increment: accruedInterest },
            paidOverpayment: { increment: overpayment },
          }
        : {
            status: 'PAID',
            paidAt: prepaymentDateUTC,
            amount,
            paidAmount: amount,
            principalPart: principalToBalance,
            interestPart: accruedInterest,
            paidPrincipalPart: principalToBalance,
            paidInterestPart: accruedInterest,
            paidOverpayment: overpayment,
          };

      await tx.paymentSchedule.upsert({
        where: { creditId_dueDate: { creditId, dueDate: prepaymentDateUTC } },
        update: updateData,
        create: {
          creditId,
          dueDate: prepaymentDateUTC,
          amount,
          principalPart: principalToBalance,
          interestPart: accruedInterest,
          paidAmount: amount,
          paidPrincipalPart: principalToBalance,
          paidInterestPart: accruedInterest,
          paidOverpayment: overpayment,
          status: 'PAID',
          paidAt: prepaymentDateUTC,
        },
      });

      await tx.paymentSchedule.deleteMany({ where: { creditId, status: 'PENDING' } });

      let items;
      try {
        // Та же функция, что и в preview: прогноз и запись всегда совпадают.
        items = scheduleAfterPrepayment(credit, prepaymentDateUTC, newOutstanding);
      } catch (err) {
        console.error('scheduleAfterPrepayment failed', err);
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
    if (credit.type === 'MICROLOAN') throw new AppError(400, 'Для микрозайма досрочное погашение с пересчётом графика недоступно');
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
    const split = splitPrepaymentAmount(amount, outstanding, accruedInterest);
    const { principalPart, principalToBalance, overpayment, newOutstanding } = split;

    const pending = credit.schedule.filter((item) => item.status === 'PENDING');

    // Что осталось заплатить процентов по текущему графику.
    const currentInterest = round2(
      pending.reduce((acc, item) => acc + toNumber(item.interestPart), 0),
    );
    const currentTotal = round2(pending.reduce((acc, item) => acc + toNumber(item.amount), 0));

    const effectiveDate = isoDate(prepaymentDateUTC);
    const minAmount = round2(accruedInterest + 0.01);
    const coversInterest = principalPart > 0;
    const isFull = newOutstanding <= CLOSE_THRESHOLD;
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
        principalToBalance: 0,
        overpayment: 0,
        days,
        coversInterest,
        minAmount,
        effectiveDate,
      };
    }

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
        monthsAfter: 0,
        accruedInterest,
        principalPart: round2(outstanding),
        principalToBalance: round2(outstanding),
        overpayment,
        days,
        coversInterest,
        minAmount,
        effectiveDate,
      };
    }

    let items;
    try {
      // та же функция, что и при применении: предпросмотр и запись совпадают.
      items = scheduleAfterPrepayment(credit, prepaymentDateUTC, newOutstanding);
    } catch (err) {
      console.error('scheduleAfterPrepayment failed', err);
      throw new AppError(400, 'Не удалось пересчитать график досрочного погашения. Проверьте параметры кредита.');
    }

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
      principalToBalance,
      overpayment,
      days,
      coversInterest,
      minAmount,
      effectiveDate,
    };
  },
};
