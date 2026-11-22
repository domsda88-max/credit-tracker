import { describe, expect, it } from 'vitest';
import { annuityPayment, buildAnnuitySchedule } from './annuity';
import { buildDueDates } from './date';
import { applyHistoricalPrepayments, rebuildSchedule, scheduleAfterPrepayment } from './earlyRepayment';
import { round2 } from './round';

/**
 * Тесты «денежной правды»: считаем ожидаемые суммы независимым эталоном
 * и сравниваем с тем, что реально пишет приложение. Синтетические данные,
 * реальные пользователи и БД не участвуют.
 */

const ANNUAL = 20;
const TERM = 60;
const PRINCIPAL = 1_000_000;
const START = new Date(Date.UTC(2024, 0, 1));
const PREPAY_DATE = new Date(Date.UTC(2024, 6, 15));

function baselineSchedule() {
  return buildAnnuitySchedule(PRINCIPAL, ANNUAL, TERM, buildDueDates(START, TERM, 1));
}

/** Эталон: сначала амортизация по графику, потом досрочка с простыми процентами. */
function referenceOutstandingAfterPrepayment() {
  const schedule = baselineSchedule();
  let balance = PRINCIPAL;
  let anchor = START;

  for (const item of schedule) {
    if (item.dueDate.getTime() > PREPAY_DATE.getTime()) break;
    balance = round2(balance - item.principalPart);
    anchor = item.dueDate;
  }

  const days = Math.round((PREPAY_DATE.getTime() - anchor.getTime()) / 86_400_000);
  const accrued = round2((balance * ANNUAL * days) / 100 / 365);
  const principalPart = round2(200_000 - accrued);
  return { outstanding: round2(balance - principalPart), accrued, principalPart };
}

describe('проценты и остаток долга — независимая проверка', () => {
  it('аннуитет: платёж формулы и сумма графика сходятся', () => {
    const payment = annuityPayment(PRINCIPAL, ANNUAL, TERM);
    expect(payment).toBe(26_493.88);

    const schedule = baselineSchedule();
    expect(schedule).toHaveLength(TERM);
    expect(round2(schedule.reduce((sum, item) => sum + item.principalPart, 0))).toBe(PRINCIPAL);
    expect(schedule[schedule.length - 1].amount).toBeLessThanOrEqual(payment + 1);
    expect(schedule[schedule.length - 1].amount).toBeGreaterThan(payment - 100);
  });

  it('досрочка при добавлении кредита учитывает уже прошедшие платежи по графику', () => {
    const expected = referenceOutstandingAfterPrepayment();
    const actual = applyHistoricalPrepayments(
      PRINCIPAL,
      ANNUAL,
      'ANNUITY' as any,
      START,
      TERM,
      1,
      [{ amount: 200_000, date: PREPAY_DATE }],
    );

    expect(expected.accrued).toBeGreaterThan(0);
    expect(actual.outstanding).toBeCloseTo(expected.outstanding, 2);
  });

  it('после досрочки в графике остаются только будущие даты', () => {
    const actual = applyHistoricalPrepayments(
      PRINCIPAL,
      ANNUAL,
      'ANNUITY' as any,
      START,
      TERM,
      1,
      [{ amount: 200_000, date: PREPAY_DATE }],
    );
    const first = actual.schedule[0]?.dueDate;
    expect(first).toBeDefined();
    expect(first.getTime()).toBeGreaterThan(PREPAY_DATE.getTime());
  });

  it('досрочка до даты платежа не пропускает ближайший платёж этого месяца', () => {
    const credit = {
      schedule: [
        { status: 'PAID', dueDate: new Date(Date.UTC(2024, 1, 20)), amount: 100, principalPart: 50 },
        { status: 'PENDING', dueDate: new Date(Date.UTC(2024, 2, 20)), amount: 100, principalPart: 50 },
      ],
      startDate: new Date(Date.UTC(2024, 0, 20)),
      termMonths: 12,
      paymentDay: 20,
      paymentType: 'ANNUITY',
      annualRate: 12,
    };

    const beforeDue = scheduleAfterPrepayment(credit, new Date(Date.UTC(2024, 2, 15)), 50_000);
    expect(beforeDue[0]?.dueDate.getUTCMonth()).toBe(2); // март, а не апрель
    expect(beforeDue[0]?.dueDate.getUTCDate()).toBe(20);

    const onDue = scheduleAfterPrepayment(credit, new Date(Date.UTC(2024, 2, 20)), 50_000);
    expect(onDue[0]?.dueDate.getUTCMonth()).toBe(3); // в дату платежа — уже апрель
  });

  it('пересборка графика сохраняет paymentDay после короткого месяца', () => {
    const items = rebuildSchedule({
      outstanding: 500_000,
      annualRate: 12,
      paymentType: 'ANNUITY' as any,
      remainingTermMonths: 12,
      nextDueDate: new Date(Date.UTC(2026, 0, 31)),
      paymentDay: 31,
      previousPayment: 20_000,
    });
    const month = (index: number) => items[index]?.dueDate.getUTCMonth();

    expect(month(0)).toBe(0); // январь, 31
    expect(month(1)).toBe(1); // февраль, 28
    expect(month(2)).toBe(2); // март должен вернуться на 31, а не остаться 28
  });
});
