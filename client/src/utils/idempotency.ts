/**
 * Стабильный ключ одной логической операции. Он сохраняется в офлайн-очереди
 * и переиспользуется при повторе, поэтому таймаут/двойной тап не создадут
 * второй PaymentEvent.
 */
export function createIdempotencyKey(scope: string, targetId: string): string {
  const suffix =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${scope}:${targetId}:${suffix}`;
}
