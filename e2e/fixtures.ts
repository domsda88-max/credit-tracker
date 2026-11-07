import type { Page } from '@playwright/test';

export const USER = {
  id: 'u1',
  email: 'audit@example.com',
  name: 'Visual Audit',
  timezone: 'Europe/Moscow',
  reminderHour: 10,
  leadDaysList: [3, 7],
  motivationEnabled: true,
  motivationDay: 61,
  motivationTime: '09:30',
  motivationPerDay: 6,
  monthlyIncome: 150000,
};

const baseCredit = {
  paymentType: 'ANNUITY',
  prepaymentMode: 'REDUCE_TERM',
  principal: 300000,
  outstanding: 187500,
  annualRate: 29.9,
  startDate: '2024-11-15T00:00:00.000Z',
  termMonths: 60,
  paymentDay: 15,
  minPayment: 9500,
  gracePeriodEnds: null,
  graceReplenishSum: null,
  graceReplenishDay: null,
  frozen: false,
  freezeCycleDays: null,
  freezeStartedAt: null,
  nextFreezeCheckAt: null,
  status: 'ACTIVE',
  closedAt: null,
  totalPaid: 145000,
  createdAt: '2024-11-01T10:00:00.000Z',
};

function isoMonth(year: number, monthIndex: number, day = 15): string {
  return new Date(Date.UTC(year, monthIndex, day, 9)).toISOString();
}

const summary = {
  activeCount: 2,
  closedCount: 1,
  principalSum: 4800000,
  outstandingSum: 4007500,
  paidByPrincipal: 792500,
  totalPaidSum: 1845000,
  scheduledTotal: 6900000,
  overpay: 2100000,
  debtFreeDate: '2032-06-15T00:00:00.000Z',
  paidLast12Months: 480000,
  paymentsLast12Months: 12,
  monthlyPayments: 61500,
  monthlyIncome: 150000,
  freeMoney: 88500,
  graceReplenishTotal: 120000,
  graceItems: [],
  accelerator: {
    baselineMonths: 86,
    acceleratedMonths: 72,
    savedMonths: 14,
    targetName: 'Кредитная карта Тинькофф Платинум с очень длинным названием для проверки обрезки',
    extraPerMonth: 15000,
  },
};

const longName = 'Кредитная карта Тинькофф Платинум с очень длинным названием для проверки обрезки';

const nextCardPayment = {
  id: 'p-next-card',
  creditId: 'c1',
  dueDate: isoMonth(2026, 10, 15),
  amount: 9500,
  principalPart: 7000,
  interestPart: 2500,
  status: 'PENDING',
  paidAt: null,
  paidAmount: null,
};

const nextMortgagePayment = {
  id: 'p-next-mortgage',
  creditId: 'c2',
  dueDate: isoMonth(2026, 10, 10),
  amount: 52000,
  principalPart: 31000,
  interestPart: 21000,
  status: 'PENDING',
  paidAt: null,
  paidAmount: null,
};

export const CREDIT_CARD = {
  ...baseCredit,
  id: 'c1',
  name: longName,
  type: 'CREDIT_CARD',
  paymentType: 'MIN_PAYMENT',
  annualRate: 29.9,
  principal: 300000,
  outstanding: 187500,
  nextPayment: nextCardPayment,
};

export const MORTGAGE = {
  ...baseCredit,
  id: 'c2',
  name: 'Ипотека на квартиру в центре',
  type: 'MORTGAGE',
  principal: 4500000,
  outstanding: 3820000,
  annualRate: 12.5,
  totalPaid: 1700000,
  nextPayment: nextMortgagePayment,
};

export const CLOSED_CREDIT = {
  ...baseCredit,
  id: 'c3',
  name: 'Закрытый автокредит',
  type: 'CONSUMER',
  principal: 900000,
  outstanding: 0,
  status: 'CLOSED',
  closedAt: '2026-01-10T00:00:00.000Z',
  nextPayment: null,
};

export const CREDIT_LIST = [CREDIT_CARD, MORTGAGE, CLOSED_CREDIT];

function makeSchedule() {
  const schedule = [];

  for (let i = 0; i < 24; i += 1) {
    const monthIndex = 10 + i; // November 2024
    const year = 2024 + Math.floor(monthIndex / 12);
    const month = monthIndex % 12;
    const dueDate = isoMonth(year, month, 15);
    schedule.push({
      id: `paid-${i}`,
      creditId: 'c1',
      dueDate,
      amount: 9500,
      principalPart: 7000,
      interestPart: 2500,
      status: 'PAID',
      paidAt: dueDate,
      paidAmount: 9500,
    });
  }

  for (let i = 0; i < 34; i += 1) {
    const monthIndex = 10 + 24 + i; // November 2026 onwards
    const year = 2024 + Math.floor(monthIndex / 12);
    const month = monthIndex % 12;
    const dueDate = isoMonth(year, month, 15);
    schedule.push({
      id: `pending-${i}`,
      creditId: 'c1',
      dueDate,
      amount: 9500,
      principalPart: 7000,
      interestPart: 2500,
      status: i === 0 ? 'PENDING' : i === 1 ? 'OVERDUE' : 'PENDING',
      paidAt: null,
      paidAmount: null,
    });
  }

  return schedule;
}

export const CREDIT_DETAIL = {
  ...CREDIT_CARD,
  schedule: makeSchedule(),
  events: [],
};

export const SUMMARY = summary;

export interface MockOptions {
  /** Delay the first GET /credits so the skeleton state is observable. */
  listDelayMs?: number;
  /** Delay the main JS bundle so the splash screen is observable. */
  bundleDelayMs?: number;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Seed Zustand persist auth + theme before the app boots. */
export async function seedApp(page: Page, theme: 'light' | 'dark' = 'dark') {
  await page.addInitScript(
    ({ user, selectedTheme }) => {
      localStorage.setItem(
        'credit-tracker-auth',
        JSON.stringify({
          state: { user, token: 'mock-audit-token', isAuthenticated: true },
          version: 0,
        }),
      );
      localStorage.setItem('credit-tracker-theme', selectedTheme);
    },
    { user: USER, selectedTheme: theme },
  );
}

/** Mock every API endpoint used by the audited screens. */
export async function mockApi(page: Page, options: MockOptions = {}) {
  let listCalls = 0;

  if (options.bundleDelayMs) {
    await page.route('**/assets/index-*.js', async (route) => {
      await sleep(options.bundleDelayMs);
      await route.continue();
    });
  }

  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const method = request.method();
    const path = new URL(request.url()).pathname.replace(/^\/api/, '');
    const reply = (body: unknown, status = 200) =>
      route.fulfill({
        status,
        contentType: 'application/json',
        headers: { 'access-control-allow-origin': '*' },
        body: JSON.stringify(body),
      });

    if (method === 'GET' && path === '/credits') {
      listCalls += 1;
      if (options.listDelayMs && listCalls === 1) {
        await sleep(options.listDelayMs);
      }
      return reply(CREDIT_LIST);
    }
    if (method === 'GET' && path === '/credits/summary') return reply(SUMMARY);
    if (method === 'GET' && path === '/credits/export') {
      return reply({ exportedAt: new Date().toISOString(), version: 1, credits: [] });
    }
    if (method === 'GET' && path === '/credits/c1') return reply(CREDIT_DETAIL);
    if (method === 'GET' && /^\/credits\/[^/]+$/.test(path)) {
      return reply({ ...CREDIT_DETAIL, id: path.split('/').pop() });
    }
    if (method === 'GET' && path === '/auth/me') return reply(USER);
    if (method === 'PUT' && path === '/auth/settings') {
      const body = JSON.parse(request.postData() ?? '{}');
      return reply({ ...USER, ...body });
    }
    if (method === 'POST' && path.startsWith('/payments/')) {
      return reply({ ok: true });
    }
    if (method === 'GET' && path === '/push/status') return reply({ subscribed: false });

    return reply({});
  });
}

/** Navigate and wait until the app shell has painted. */
export async function openApp(page: Page, path = '/') {
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  await page.locator('main').waitFor({ state: 'visible' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(450);
}

/**
 * Collect visible text nodes and their effective background so contrast can be
 * checked in Node. Elements painted on gradients are skipped to avoid false
 * positives from sampling a single background stop.
 */
export async function collectTextPairs(page: Page) {
  return page.evaluate(() => {
    const parseAlpha = (value: string) => {
      const slash = value.match(/\/\s*([\d.]+)(%?)\)/);
      if (!slash) return 1;
      const n = Number(slash[1]);
      return slash[2] ? n / 100 : n;
    };

    const isTransparent = (color: string) => {
      if (!color || color === 'transparent') return true;
      if (/rgba\([^)]*,\s*0\)/.test(color)) return true;
      if (/\/\s*0\)/.test(color)) return true;
      return false;
    };

    const results: Array<{
      text: string;
      color: string;
      backgrounds: string[];
      fontSize: number;
      fontWeight: number;
      opacity: number;
      selector: string;
    }> = [];

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.textContent || !node.textContent.trim()) return NodeFilter.FILTER_REJECT;
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        const tag = parent.tagName.toLowerCase();
        if (tag === 'script' || tag === 'style' || tag === 'noscript') return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });

    while (walker.nextNode()) {
      const node = walker.currentNode;
      const el = node.parentElement;
      if (!el) continue;

      const rect = el.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) continue;

      const style = getComputedStyle(el);
      if (style.visibility === 'hidden' || style.display === 'none') continue;

      let opacity = 1;
      let cursor: HTMLElement | null = el;
      let onGradient = false;
      const layers: string[] = [];
      while (cursor) {
        const cs = getComputedStyle(cursor);
        opacity *= Number(cs.opacity);
        if (cs.backgroundImage && cs.backgroundImage !== 'none') {
          onGradient = true;
          break;
        }
        if (!isTransparent(cs.backgroundColor)) {
          layers.push(cs.backgroundColor);
        }
        cursor = cursor.parentElement;
      }
      if (onGradient || layers.length === 0) continue;

      const text = el.textContent?.trim().slice(0, 48) ?? '';
      if (!text) continue;

      results.push({
        text,
        color: style.color,
        backgrounds: layers,
        fontSize: Number.parseFloat(style.fontSize),
        fontWeight: Number.parseInt(style.fontWeight, 10),
        opacity,
        selector: `${el.tagName.toLowerCase()}.${String(el.className).split(' ').slice(0, 3).join('.')}`,
      });
    }

    return results;
  });
}
