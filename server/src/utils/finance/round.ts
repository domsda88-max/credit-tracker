/**
 * Округление денежных сумм до копеек.
 * Все финансовые расчёты ведутся в рублях и округляются на каждом шаге,
 * чтобы график в БД и в UI совпадал до копейки.
 */
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Приведение Prisma.Decimal | number | string к number. */
export function toNumber(value: unknown): number {
  return Number(value);
}
