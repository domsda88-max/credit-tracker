import { useEffect, useCallback, useRef } from 'react';
import { extractErrorMessage } from '../api/client';

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
  createdAt: number;
  retries: number;
}

const DB_NAME = 'credit-tracker-offline';
const STORE_NAME = 'actions';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

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
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export { getActions as getOfflineActions };

async function addAction(action: OfflineAction): Promise<void> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.add(action);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function removeAction(id: string): Promise<void> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export function useOfflineQueue() {
  const syncingRef = useRef(false);

  const syncAll = useCallback(async () => {
    if (syncingRef.current || !navigator.onLine) return;
    syncingRef.current = true;

    try {
      const actions = await getActions();
      for (const action of actions) {
        try {
          await executeAction(action);
          await removeAction(action.id);
        } catch (err) {
          // Не критично — оставим в очереди для следующей попытки
          console.error('[offline] sync failed for', action.type, extractErrorMessage(err as Error));
        }
      }
    } finally {
      syncingRef.current = false;
    }
  }, []);

  const enqueue = useCallback(async (action: Omit<OfflineAction, 'id' | 'createdAt' | 'retries'>) => {
    await addAction({
      ...action,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      retries: 0,
    });
  }, []);

  // Синхронизация при возвращении в онлайн и приmontировании.
  useEffect(() => {
    const onOnline = () => void syncAll();
    window.addEventListener('online', onOnline);
    void syncAll();
    return () => window.removeEventListener('online', onOnline);
  }, [syncAll]);

  return { enqueue, syncAll };
}

async function executeAction(action: OfflineAction): Promise<void> {
  const { creditsApi } = await import('../api/credits');
  const { paymentsApi } = await import('../api/payments');

  switch (action.type) {
    case 'pay_installment':
      await paymentsApi.payInstallment(action.payload.installmentId as string, {
        amount: action.payload.amount as number | undefined,
        paidAt: action.payload.paidAt as string | undefined,
      });
      break;
    case 'early_repayment':
      await paymentsApi.earlyRepayment(action.payload.creditId as string, {
        amount: action.payload.amount as number,
        mode: action.payload.mode as 'REDUCE_TERM',
        date: action.payload.date as string,
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
      throw new Error(`Unknown offline action: ${action.type}`);
  }
}
