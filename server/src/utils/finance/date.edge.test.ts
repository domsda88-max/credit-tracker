import { describe, it, expect } from 'vitest';
import { monthsBetween, addUTCDays, withDayOfMonth, addMonths } from './date';

describe('monthsBetween boundary behavior', () => {
  it('одна и та же дата = 0', () => {
    const d = new Date(Date.UTC(2026, 1, 15));
    expect(monthsBetween(d, d)).toBe(0);
  });

  it('Jan 31 -> Feb 28 (2025): длина еще не накопилась', () => {
    const from = new Date(Date.UTC(2025, 0, 31));
    const to = new Date(Date.UTC(2025, 1, 28));
    expect(monthsBetween(from, to)).toBe(0);
  });

  it('Jan 31 -> Mar 1 учитывает неполный месяц', () => {
    const from = new Date(Date.UTC(2025, 0, 31));
    const to = new Date(Date.UTC(2025, 2, 1));
    expect(monthsBetween(from, to)).toBe(1);
  });

  it('обратный порядок даёт отрицательное значение', () => {
    const from = new Date(Date.UTC(2025, 1, 28));
    const to = new Date(Date.UTC(2025, 0, 31));
    expect(monthsBetween(from, to)).toBe(-1);
  });

  it('високосный день: Feb 29 -> Mar 1 без переполнения', () => {
    const from = new Date(Date.UTC(2024, 1, 29));
    const to = new Date(Date.UTC(2024, 2, 1));
    // Current behavior: to.getDate() < from.getDate() => off by one.
    expect(monthsBetween(from, to)).toBe(0);
  });
});

describe('date helpers boundary behavior', () => {
  it('addMonths клампит 31 -> 28 в феврале 2025', () => {
    const d = new Date(Date.UTC(2025, 0, 31));
    const r = addMonths(d, 1);
    expect(r.getUTCDate()).toBe(28);
    expect(r.getUTCMonth()).toBe(1);
  });

  it('withDayOfMonth клампит paymentDay 31 на 28 для февраля 2025', () => {
    const d = new Date(Date.UTC(2025, 1, 15));
    const r = withDayOfMonth(d, 31);
    expect(r.getUTCDate()).toBe(28);
  });

  it('addUTCDays корректно переходит на новый месяц', () => {
    const d = new Date(Date.UTC(2025, 0, 30));
    const r = addUTCDays(d, 2);
    expect(r.getUTCDate()).toBe(1);
    expect(r.getUTCMonth()).toBe(1);
  });
});
