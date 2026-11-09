/**
 * Базовая аналитика: события регистрации, входа, добавления кредита,
 * оплаты платежа, досрочного погашения, открытия экрана.
 * В бесплатной версии события хранятся в localStorage и могут быть
 * экспортированы. Позже можно подключить внешний сборщик (Plausible, etc).
 */

type AnalyticsEvent =
  | { event: 'screen_view'; screen: string }
  | { event: 'credit_added'; creditType: string }
  | { event: 'payment_made'; creditId: string }
  | { event: 'early_repayment'; creditId: string; amount: number }
  | { event: 'login' }
  | { event: 'register' }
  | { event: 'export_data' }
  | { event: 'achievement_unlocked'; badge: string };

type StoredEvent = AnalyticsEvent & { timestamp: number };

const STORAGE_KEY = 'credit-tracker-analytics';

function loadEvents(): StoredEvent[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveEvents(events: StoredEvent[]): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(events.slice(-500)));
}

let eventsBuffer: StoredEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function pushEvent(event: AnalyticsEvent): void {
  eventsBuffer.push({ ...event, timestamp: Date.now() });
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(flush, 2_000);
}

function flush(): void {
  if (eventsBuffer.length === 0) return;
  const current = loadEvents();
  saveEvents([...current, ...eventsBuffer]);
  eventsBuffer = [];
  flushTimer = null;
}

export function useAnalytics() {
  const track = (event: AnalyticsEvent) => {
    pushEvent(event);
  };

  const getEvents = () => loadEvents();

  const exportEvents = () => {
    const events = loadEvents();
    const blob = new Blob([JSON.stringify(events, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `credit-tracker-analytics-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return { track, getEvents, exportEvents };
}

export function trackScreen(track: (event: AnalyticsEvent) => void, screen: string): void {
  if (typeof window === 'undefined') return;
  track({ event: 'screen_view', screen });
}

export { flush };
