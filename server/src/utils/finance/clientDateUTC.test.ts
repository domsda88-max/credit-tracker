import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getUpcomingPayments } from '../../../../client/src/utils/upcoming';
import { daysUntil } from '../../../../client/src/utils/format';

/** Клиентские даты должны пользоваться той же UTC-шкалой, что и график. */

function credit(dueDate: string, id = 'c-1') {
  return {
    id,
    name: `Кредит ${id}`,
    status: 'ACTIVE',
    nextPayment: { dueDate, amount: 100, status: 'PENDING' },
  } as any;
}

const timezones = ['UTC', 'Europe/Moscow', 'Asia/Yekaterinburg', 'Asia/Bangkok'];

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('getUpcomingPayments в разных часовых поясах', () => {
  it.each(timezones)('%s: 1 декабря не подменяется ноябрём', (tz) => {
    process.env.TZ = tz;
    vi.setSystemTime(new Date('2026-12-01T00:00:00Z'));

    const items = getUpcomingPayments([credit('2026-12-01'), credit('2026-11-30', 'c-2')]);
    const byId = new Map(items.map((item) => [item.creditId, item]));

    expect(byId.get('c-1')?.overdue).toBe(false);
    expect(byId.get('c-2')?.overdue).toBe(true);
    expect(daysUntil('2026-12-01')).toBe(0);
  });

  it.each(timezones)('%s: переход декабря в январь', (tz) => {
    process.env.TZ = tz;
    vi.setSystemTime(new Date('2027-01-01T00:00:00Z'));

    const items = getUpcomingPayments([credit('2027-01-01'), credit('2026-12-31', 'c-2')]);
    const byId = new Map(items.map((item) => [item.creditId, item]));

    expect(byId.has('c-1')).toBe(true);
    expect(byId.get('c-1')?.overdue).toBe(false);
    expect(byId.get('c-2')?.overdue).toBe(true);
  });

  it('платёж прошлого месяца не попадает в текущий как обычный', () => {
    process.env.TZ = 'Asia/Bangkok';
    vi.setSystemTime(new Date('2026-12-01T00:00:00Z'));

    const items = getUpcomingPayments([credit('2026-11-15', 'old'), credit('2026-12-10', 'current')]);
    const old = items.find((item) => item.creditId === 'old');

    expect(old?.overdue).toBe(true);
    expect(items.find((item) => item.creditId === 'current')?.overdue).toBe(false);
  });
});
