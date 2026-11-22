import { useCallback, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { extractErrorMessage, httpStatus } from '../api/client';

/** Типы действий, которые можно отложить для офлайн-синхронизации. */
type OfflineActionType =
  | 'pay_installment'
  | 'early_repayment'
  | 'toggle_freeze'
  | 'renew_freeze_cycle'
  | 'create_credit'
  | 'update_credit'
  | 'remove_credit'
  | 'cancel_payment';

interface OfflineAction {
  id: string;
  type: OfflineActionType;
  payload: Record<string, unknown>;
  /** Один логический платёж = одна строка очереди, даже при повторном тапе. */
  dedupeKey?: string;
  createdAt: number;
  retries: number;
  nextAttemptAt?: number;
  lastError?: string;
}

export type QueuedActionInput = Omit<
  OfflineAction,
  'id' | 'createdAt' | 'retries' | 'dedupeKey' | 'nextAttemptAt' | 'lastError'
>;

const DB_NAME = 'credit-tracker-offline';
const STORE_NAME = 'actions';
const DB_VERSION = 1;
const MAX_RETRIES = 5;
export const OFFLINE_QUEUE_CHANGED = 'credit-tracker:offline-queue-changed';

let dbPromise: Promise<IDBDatabase> | null = null;

function notifyQueueChanged(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(OFFLINE_QUEUE_CHANGED));
  }
}

function getDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function getActions(): Promise<OfflineAction[]> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => resolve(req.result as OfflineAction[]);
    req.onerror = () => reject(req.error);
  });
}

export { getActions as getOfflineActions };

async function putAction(action: OfflineAction): Promise<void> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const req = tx.objectStore(STORE_NAME).put(action);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function upsertAction(action: OfflineAction): Promise<void> {
  const existing = (await getActions()).find((item) => item.dedupeKey === action.dedupeKey);
  // Повторный тап обновляет уже существующую задачу, а не создаёт вторую.
  await putAction(
    existing
      ? { ...action, id: existing.id, createdAt: existing.createdAt }
      : action,
  );
  notifyQueueChanged();
}

async function removeAction(id: string): Promise<void> {
  const db = await getDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const req = tx.objectStore(STORE_NAME).delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
  notifyQueueChanged();
}

/** Стабильный ключ для сравнения payload без зависимости от порядка полей. */
function stableStringify(value: unknown): string {
  if (value === undefined) return 'undefined';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (typeof value === 'object' && value !== null) {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(object[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? 'undefined';
}

function dedupeKeyFor(type: OfflineActionType, payload: Record<string, unknown>): string {
  return `${type}:${stableStringify(payload)}`;
}

function backoffDelay(retries: number): number {
  return Math.min(5 * 60_000, 1_000 * 2 ** retries);
}

/** Ответ «уже применён» означает, что сервер сохранил платёж до потери связи. */
function isDuplicateIdempotency(error: unknown): boolean {
  return (
    httpStatus(error) === 409 &&
    extractErrorMessage(error).toLowerCase().includes('уже применён')
  );
}

function isHardFailure(error: unknown): boolean {
  const status = httpStatus(error);
  return status === 400 || status === 401 || status === 403 || status === 404;
}

export function useOfflineQueue() {
  const syncingRef = useRef(false);
  const queryClient = useQueryClient();

  const refreshFinancialData = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['credits'] }),
      queryClient.invalidateQueries({ queryKey: ['summary'] }),
      queryClient.invalidateQueries({ queryKey: ['credit'] }),
    ]);
  }, [queryClient]);

  const syncAll = useCallback(async () => {
    if (syncingRef.current || !navigator.onLine) return;
    syncingRef.current = true;

    try {
      const now = Date.now();
      const actions = (await getActions()).filter(
        (action) => !action.nextAttemptAt || action.nextAttemptAt <= now,
      );

      for (const action of actions) {
        try {
          await executeAction(action);
          await removeAction(action.id);
          await refreshFinancialData();
        } catch (error) {
          const message = extractErrorMessage(error);
          if (isDuplicateIdempotency(error) || isHardFailure(error)) {
            // Либо платёж уже на сервере, либо запрос никогда не станет валидным.
            await removeAction(action.id);
            await refreshFinancialData();
            console.warn('[offline] задача удалена:', action.type, message);
            continue;
          }

          const retries = (action.retries ?? 0) + 1;
          if (retries >= MAX_RETRIES) {
            await removeAction(action.id);
            console.error('[offline] исчерпаны повторы:', action.type, message);
            continue;
          }
          await putAction({
            ...action,
            retries,
            nextAttemptAt: Date.now() + backoffDelay(retries),
            lastError: message,
          });
          console.warn('[offline] повторим позже:', action.type, retries, message);
        }
      }
    } finally {
      syncingRef.current = false;
    }
  }, [refreshFinancialData]);

  const enqueue = useCallback(async (input: QueuedActionInput) => {
    await upsertAction({
      ...input,
      id: crypto.randomUUID(),
      dedupeKey: dedupeKeyFor(input.type, input.payload),
      createdAt: Date.now(),
      retries: 0,
    });
  }, []);

  // Синхронизация при возвращении в онлайн и при монтировании.
  useEffect(() => {
    const onOnline = () => void syncAll();
    window.addEventListener('online', onOnline);
    void syncAll();
    return () => window.removeEventListener('online', onOnline);
  }, [syncAll]);

  return { enqueue, syncAll, refreshFinancialData };
}

async function executeAction(action: OfflineAction): Promise<void> {
  const { creditsApi } = await import('../api/credits');
  const { paymentsApi } = await import('../api/payments');

  switch (action.type) {
    case 'pay_installment':
      await paymentsApi.payInstallment(action.payload.installmentId as string, {
        amount: action.payload.amount as number | undefined,
        paidAt: action.payload.paidAt as string | undefined,
        idempotencyKey: action.payload.idempotencyKey as string | undefined,
      });
      break;
    case 'early_repayment':
      await paymentsApi.earlyRepayment(action.payload.creditId as string, {
        amount: action.payload.amount as number,
        mode: action.payload.mode as 'REDUCE_TERM' | undefined,
        date: action.payload.date as string | undefined,
        idempotencyKey: action.payload.idempotencyKey as string | undefined,
      });
      break;
    case 'toggle_freeze':
      await creditsApi.toggleFreeze(action.payload.id as string, action.payload.frozen as boolean);
      break;
    case 'renew_freeze_cycle':
      await creditsApi.renewFreezeCycle(action.payload.id as string);
      break;
    case 'create_credit':
      await creditsApi.create(action.payload as never);
      break;
    case 'update_credit':
      await creditsApi.update(action.payload.id as string, action.payload as never);
      break;
    case 'remove_credit':
      await creditsApi.remove(action.payload.id as string);
      break;
    case 'cancel_payment':
      await paymentsApi.cancelSchedule(action.payload.installmentId as string);
      break;
    default:
      throw new Error(`Unknown offline action: ${String(action.type)}`);
  }
}
