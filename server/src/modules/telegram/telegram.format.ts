export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return entities[character] ?? character;
  });
}

export function formatMoney(value: number | string | null | undefined): string {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount)) return '—';
  return (
    amount.toLocaleString('ru-RU', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }) + ' ₽'
  );
}

export function formatDate(value: Date | string | null | undefined): string {
  if (!value) return 'не указана';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return 'не указана';
  return date.toLocaleDateString('ru-RU', { timeZone: 'UTC' });
}

export function parsePositiveNumber(input: string): number | null {
  const normalized = input.replace(/\s/g, '').replace(/₽/gi, '').replace(',', '.');
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null;
  const value = Number(normalized);
  return Number.isFinite(value) && value > 0 ? Math.round(value * 100) / 100 : null;
}

export function parseIntegerInRange(input: string, min: number, max: number): number | null {
  if (!/^\d+$/.test(input.trim())) return null;
  const value = Number(input.trim());
  return Number.isSafeInteger(value) && value >= min && value <= max ? value : null;
}

export function creditTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    CREDIT_CARD: 'Кредитная карта',
    CONSUMER: 'Потребительский кредит',
    MORTGAGE: 'Ипотека',
    INSTALLMENT: 'Рассрочка / сплит',
    MICROLOAN: 'Микрозайм',
    LOAN: 'Другой / частный долг',
  };
  return labels[type] ?? 'Долг';
}
