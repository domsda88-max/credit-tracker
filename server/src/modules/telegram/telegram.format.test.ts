import { describe, expect, it } from 'vitest';
import {
  creditTypeLabel,
  escapeHtml,
  formatDate,
  formatMoney,
  parseIntegerInRange,
  parsePositiveNumber,
} from './telegram.format';

describe('Telegram formatting helpers', () => {
  it('parses money with Russian decimal comma and spaces', () => {
    expect(parsePositiveNumber(' 12 500,50 ₽ ')).toBe(12500.5);
    expect(parsePositiveNumber('99')).toBe(99);
    expect(parsePositiveNumber('0')).toBeNull();
    expect(parsePositiveNumber('-10')).toBeNull();
    expect(parsePositiveNumber('12,345')).toBeNull();
  });

  it('validates integer day and term inputs', () => {
    expect(parseIntegerInRange('31', 1, 31)).toBe(31);
    expect(parseIntegerInRange('0', 1, 31)).toBeNull();
    expect(parseIntegerInRange('1.5', 1, 31)).toBeNull();
  });

  it('escapes Telegram HTML input', () => {
    expect(escapeHtml('<bank & "card">')).toBe('&lt;bank &amp; &quot;card&quot;&gt;');
  });

  it('formats money and UTC dates', () => {
    expect(formatMoney(1234.5)).toContain('1 234,5');
    expect(formatMoney(null)).toBe('0 ₽');
    expect(formatDate('2026-11-27T00:00:00.000Z')).toBe('27.11.2026');
  });

  it('provides user-facing debt type labels', () => {
    expect(creditTypeLabel('CREDIT_CARD')).toBe('Кредитная карта');
    expect(creditTypeLabel('UNKNOWN')).toBe('Долг');
  });
});
