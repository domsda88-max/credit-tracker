import { expect, test, type Page } from '@playwright/test';
import { CREDIT_DETAIL, mockApi, openApp, seedApp } from './fixtures';

/**
 * Финансовые E2E-тесты на синтетических данных.
 * Проверяем не «нет ошибок», а конкретные числа и payload-ы:
 * добавление кредита и предпросмотр/применение досрочного платежа.
 */

const ITERATIONS = 100;
const LONG_TEST_MS = 30 * 60_000;
const CREDIT_ID = 'fin-c1';

interface CapturedRequest {
  method: string;
  path: string;
  body: any;
}

function reply(route: import('@playwright/test').Route, body: unknown) {
  return route.fulfill({
    status: 200,
    contentType: 'application/json',
    headers: { 'access-control-allow-origin': '*' },
    body: JSON.stringify(body),
  });
}

function money(value: number): string {
  const hasCents = Math.round(Math.abs(value) * 100) % 100 !== 0;
  return `${value.toLocaleString('ru-RU', {
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: hasCents ? 2 : 0,
  })} ₽`;
}

async function setupFinance(page: Page) {
  const requests: CapturedRequest[] = [];
  await seedApp(page, 'light', true);
  await mockApi(page);

  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const method = request.method();
    const path = new URL(request.url()).pathname.replace(/^\/api/, '');
    let body: any = null;
    try {
      body = request.postData() ? JSON.parse(request.postData() ?? '{}') : null;
    } catch {
      body = null;
    }
    requests.push({ method, path, body });

    if (method === 'POST' && path === '/credits') {
      return reply(route, {
        ...CREDIT_DETAIL,
        id: `fin-${requests.filter((r) => r.path === '/credits' && r.method === 'POST').length}`,
        name: body?.name ?? 'Тестовый кредит',
        type: body?.type,
        createdAt: new Date().toISOString(),
      });
    }

    if (method === 'GET' && path === `/credits/${CREDIT_ID}`) {
      return reply(route, {
        ...CREDIT_DETAIL,
        id: CREDIT_ID,
        type: 'CONSUMER',
        paymentType: 'ANNUITY',
        prepaymentMode: 'REDUCE_TERM',
        status: 'ACTIVE',
        annualRate: 12,
        outstanding: 210_000,
        principal: 300_000,
      });
    }

    if (method === 'POST' && path === `/payments/credits/${CREDIT_ID}/early-preview`) {
      const amount = Number(body?.amount ?? 0);
      return reply(route, {
        isFull: false,
        amount,
        newOutstanding: Math.max(0, 210_000 - (amount - 2_500)),
        monthSaved: 6,
        interestSaved: 12_345,
        interestAfter: 44_000,
        totalAfter: 254_000,
        currentTotal: 280_000,
        paymentBefore: 12_000,
        paymentAfter: 11_500.5,
        monthsAfter: 24,
        accruedInterest: 2_500,
        principalPart: amount - 2_500,
        days: 30,
        coversInterest: amount > 2_500,
        minAmount: 2_500.01,
        effectiveDate: body?.date,
      });
    }

    if (method === 'POST' && path === `/payments/credits/${CREDIT_ID}/early-repayment`) {
      return reply(route, { ok: true });
    }

    return route.fallback();
  });

  return requests;
}

const TYPE_CASES: Array<{
  type: string;
  title: string;
  fill: (page: Page, i: number) => Promise<void>;
  assert: (body: any, i: number) => void;
}> = [
  {
    type: 'CONSUMER',
    title: 'Потребительский кредит',
    fill: async (page, i) => {
      await page.locator('input[name="annualRate"]').fill('12.5');
      await page.locator('input[name="startDate"]').fill('2025-01-15');
      await page.locator('input[name="termMonths"]').fill(String(24 + (i % 12)));
      await page.locator('input[name="paymentDay"]').fill('15');
    },
    assert: (body, i) => {
      expect(body.termMonths).toBe(24 + (i % 12));
      expect(body.paymentType).toBe('ANNUITY');
    },
  },
  {
    type: 'CREDIT_CARD',
    title: 'Кредитная карта',
    fill: async (page) => {
      await page.locator('input[name="annualRate"]').fill('29.9');
      await page.locator('input[name="paymentDay"]').fill('20');
    },
    assert: (body) => {
      expect(body.paymentType).toBe('MIN_PAYMENT');
      expect(body.paymentDay).toBe(20);
    },
  },
  {
    type: 'MORTGAGE',
    title: 'Ипотека',
    fill: async (page, i) => {
      await page.locator('select[name="paymentType"]').selectOption('DIFFERENTIAL');
      await page.locator('input[name="annualRate"]').fill('11.25');
      await page.locator('input[name="startDate"]').fill('2024-06-10');
      await page.locator('input[name="termMonths"]').fill(String(180 + i));
      await page.locator('input[name="paymentDay"]').fill('10');
    },
    assert: (body, i) => {
      expect(body.paymentType).toBe('DIFFERENTIAL');
      expect(body.termMonths).toBe(180 + i);
    },
  },
  {
    type: 'INSTALLMENT',
    title: 'Рассрочка / Сплит',
    fill: async (page, i) => {
      await page.locator('input[name="termDays"]').fill(String(30 + (i % 12) * 30));
      await page.locator('input[name="paymentDay"]').fill('15');
      await page.locator('input[name="annualRate"]').fill('0');
    },
    assert: (body, i) => {
      // Форма показывает дни, но сервер хранит месяцы: контракт не должен терять срок.
      expect(body.termMonths, 'рассрочка должна отправлять срок в месяцах').toBeGreaterThan(0);
      expect(body.termDays).toBe(30 + (i % 12) * 30);
    },
  },
  {
    type: 'MICROLOAN',
    title: 'Займ (МФО)',
    fill: async (page, i) => {
      await page.locator('input[name="annualRate"]').fill('100');
      await page.locator('input[name="termDays"]').fill(String(7 + (i % 20)));
      await page.locator('input[name="paymentDay"]').fill('15');
    },
    assert: (body, i) => {
      expect(body.termDays).toBe(7 + (i % 20));
    },
  },
  {
    type: 'LOAN',
    title: 'Займ (частный)',
    fill: async (page) => {
      await page.locator('input[name="startDate"]').fill('2025-03-01');
    },
    assert: (body) => {
      expect(body.annualRate).toBe(0);
    },
  },
];

test.describe('Финансы: добавление кредитов и досрочных платежей', () => {
  test('FIN-01 добавление кредита: 100 сохранений всех типов с проверкой payload', async ({ page }) => {
    test.setTimeout(LONG_TEST_MS);
    const requests = await setupFinance(page);

    for (let i = 0; i < ITERATIONS; i += 1) {
      const item = TYPE_CASES[i % TYPE_CASES.length];
      await page.goto('/credits/new', { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { name: 'Новый долг' })).toBeVisible();
      await page.getByRole('button', { name: item.title }).click();
      await page.locator('input[name="name"]').fill(`Финанс ${i + 1}`);
      await page.locator('input[name="principal"]').fill(String(120_000 + i));
      await item.fill(page, i);

      await page.getByRole('button', { name: 'Сохранить' }).click();
      await expect(page).toHaveURL(/\/credits\/fin-\d+$/);

      const created = requests.filter((r) => r.method === 'POST' && r.path === '/credits').at(-1)?.body;
      expect(created, `итерация ${i}: POST /credits не отправлен`).toBeTruthy();
      expect(created.type).toBe(item.type);
      expect(created.principal).toBe(120_000 + i);
      expect(created.name).toBe(`Финанс ${i + 1}`);
      expect(
        created.markPastAsPaid,
        `итерация ${i}: форма заблаговременно помечает прошедшие платежи оплаченными`,
      ).toBe(false);
      item.assert(created, i);
    }

    expect(requests.filter((r) => r.method === 'POST' && r.path === '/credits')).toHaveLength(ITERATIONS);
  });

  test('FIN-02 досрочный платёж: 100 preview → apply с проверкой чисел и даты', async ({ page }) => {
    test.setTimeout(LONG_TEST_MS);
    const requests = await setupFinance(page);
    await openApp(page, `/credits/${CREDIT_ID}`);

    const amountInput = page.locator('input[name="amount"]');
    const dateInput = page.locator('input[name="date"]');
    const previewPanel = page.locator('text=Экономия:').locator('..');

    for (let i = 0; i < ITERATIONS; i += 1) {
      const amount = 10_000 + i;
      const date = '2026-03-15';
      await amountInput.fill(String(amount));
      await dateInput.fill(date);

      await expect
        .poll(() =>
          requests
            .filter((r) => r.method === 'POST' && r.path === `/payments/credits/${CREDIT_ID}/early-preview`)
            .some((r) => r.body?.amount === amount && r.body?.date === date),
        )
        .toBe(true);

      await expect(previewPanel).toContainText(money(12_345));
      await expect(previewPanel).toContainText(money(2_500));
      await expect(previewPanel).toContainText(money(amount - 2_500));
      await expect(previewPanel).toContainText('Останется платежей: 24');
      await expect(previewPanel).toContainText(money(11_500.5));

      await page.getByRole('button', { name: 'Внести' }).click();
      await expect
        .poll(
          () =>
            requests.filter(
              (r) => r.method === 'POST' && r.path === `/payments/credits/${CREDIT_ID}/early-repayment`,
            ).length,
        )
        .toBe(i + 1);

      const applies = requests.filter(
        (r) => r.method === 'POST' && r.path === `/payments/credits/${CREDIT_ID}/early-repayment`,
      );
      const payload = applies[i].body;
      expect(payload.amount).toBe(amount);
      expect(payload.date, 'apply должен использовать дату из preview.effectiveDate').toBe(date);
      expect(applies[i].body.mode).toBe('REDUCE_TERM');
    }

    const detailReads = requests.filter(
      (r) => r.method === 'GET' && r.path === `/credits/${CREDIT_ID}`,
    );
    expect(detailReads.length, 'после каждого платежа данные кредита должны перечитываться').toBeGreaterThan(
      ITERATIONS / 2,
    );
  });
});
