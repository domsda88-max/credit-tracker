import { describe, expect, it } from 'vitest';
import type { MotivationContext } from './motivation.context';
import { buildMotivationTexts, MOTIVATION_CYCLE, motivationForDay } from './motivation.texts';

const base: MotivationContext = {
  name: null,
  activeCount: 2,
  totalDebt: 1_000_000,
  principalSum: 1_200_000,
  overpay: 400_000,
  debtFreeDate: new Date(Date.UTC(2035, 6, 20)),
  monthlyTotal: 40_000,
  mostExpensive: {
    name: 'Карта А',
    rate: 49.9,
    balance: 100_000,
    frozen: false,
    replenishSum: null,
    replenishDay: 30,
    cycleDays: null,
  },
  expensive: [
    {
      name: 'Карта А',
      rate: 49.9,
      balance: 100_000,
      frozen: false,
      replenishSum: null,
      replenishDay: 30,
      cycleDays: null,
    },
    {
      name: 'Ипотека',
      rate: 8,
      balance: 900_000,
      frozen: false,
      replenishSum: null,
      replenishDay: 10,
      cycleDays: null,
    },
  ],
  mortgage: {
    name: 'Ипотека',
    rate: 8,
    balance: 900_000,
    frozen: false,
    replenishSum: null,
    replenishDay: 10,
    cycleDays: null,
  },
  smallest: {
    name: 'Карта А',
    rate: 49.9,
    balance: 100_000,
    frozen: false,
    replenishSum: null,
    replenishDay: 30,
    cycleDays: null,
  },
  freezeCards: [
    {
      name: 'Карта Б',
      rate: 39,
      balance: 50_000,
      frozen: true,
      replenishSum: 50_000,
      replenishDay: 28,
      cycleDays: 30,
    },
  ],
  closedName: 'Старая карта',
};

describe('Мотивационные тексты', () => {
  const texts = buildMotivationTexts(base);

  it('всегда 30 текстов', () => {
    expect(texts).toHaveLength(MOTIVATION_CYCLE);
    expect(texts).toHaveLength(30);
  });

  it('подставляет данные конкретного пользователя', () => {
    const all = texts.map((t) => `${t.title} ${t.body}`).join('\n');
    expect(all).toContain('Карта А');
    expect(all).toContain('49,9%');
    expect(all).toContain('Ипотека');
    expect(all).toContain('Старая карта');
    expect(all).toContain('Карта Б');
  });

  it('не оставляет служебных дыр и пустых подстановок', () => {
    for (const t of texts) {
      expect(t.title.length).toBeGreaterThan(0);
      expect(t.body.length).toBeGreaterThan(20);
      expect(t.body).not.toContain('undefined');
      expect(t.body).not.toContain('NaN');
      expect(t.body).not.toContain('null');
      expect(t.body).not.toContain('₽ ₽');
    }
  });

  it('цикл повторяется после 30-го дня', () => {
    expect(motivationForDay(base, 1)).toEqual(texts[0]);
    expect(motivationForDay(base, 31)).toEqual(texts[0]);
    expect(motivationForDay(base, 30)).toEqual(texts[29]);
  });

  it('без долгов — поздравляет, а не просит платить', () => {
    const free = buildMotivationTexts({ ...base, activeCount: 0 });
    expect(free.length).toBeGreaterThan(0);
    expect(free[0].body.toLowerCase()).not.toContain('досрочн');
  });

  it('работает без ипотеки и закрытых кредитов', () => {
    const minimal = buildMotivationTexts({
      ...base,
      mortgage: null,
      closedName: null,
      freezeCards: [],
      smallest: null,
      expensive: [],
      mostExpensive: null,
    });
    for (const t of minimal) {
      expect(t.body).not.toContain('undefined');
      expect(t.body).not.toContain('null');
    }
  });
});
