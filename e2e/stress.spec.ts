import { expect, test, type Page } from '@playwright/test';
import { CREDIT_CARD, mockApi, openApp, seedApp } from './fixtures';

/**
 * Стресс-тесты на синтетических данных. Реальный аккаунт и реальная БД не используются:
 * все запросы перехватываются page.route, состояние хранится только в памяти теста.
 */
interface StressState {
  createCalls: number;
  freezeCalls: number;
  updateCalls: number;
  deleteCalls: number;
  consoleErrors: string[];
  pageErrors: string[];
  badResponses: string[];
}

const ITERATIONS = 100;
const LONG_TEST_MS = 30 * 60_000;

function reply(route: import('@playwright/test').Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    headers: { 'access-control-allow-origin': '*' },
    body: JSON.stringify(body),
  });
}

async function setupStress(page: Page): Promise<StressState> {
  const state: StressState = {
    createCalls: 0,
    freezeCalls: 0,
    updateCalls: 0,
    deleteCalls: 0,
    consoleErrors: [],
    pageErrors: [],
    badResponses: [],
  };

  await seedApp(page, 'light', true);
  await mockApi(page);

  // Дополнительные мутации Surface. Регистрируем после mockApi:
  // в Playwright последний совпавший route обрабатывает запрос первым.
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const method = request.method();
    const path = new URL(request.url()).pathname.replace(/^\/api/, '');

    if (method === 'POST' && path === '/credits') {
      state.createCalls += 1;
      const payload = JSON.parse(request.postData() ?? '{}') as { name?: string };
      return reply(route, {
        ...CREDIT_CARD,
        id: `stress-${state.createCalls}`,
        name: payload.name ?? 'Тестовый долг',
        createdAt: new Date().toISOString(),
      });
    }
    if (method === 'POST' && /^\/credits\/[^/]+\/freeze$/.test(path)) {
      state.freezeCalls += 1;
      const body = JSON.parse(request.postData() ?? '{}') as { frozen?: boolean };
      return reply(route, { ...CREDIT_CARD, frozen: Boolean(body.frozen) });
    }
    if (method === 'PUT' && /^\/credits\/[^/]+$/.test(path)) {
      state.updateCalls += 1;
      return reply(route, { ...CREDIT_CARD, ...JSON.parse(request.postData() ?? '{}') });
    }
    if (method === 'DELETE' && /^\/credits\/[^/]+$/.test(path)) {
      state.deleteCalls += 1;
      return reply(route, { ok: true });
    }

    return route.fallback();
  });

  page.on('console', (message) => {
    if (message.type() === 'error') state.consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => state.pageErrors.push(error.message));
  page.on('response', (response) => {
    if (response.status() >= 400) state.badResponses.push(`${response.status()} ${response.url()}`);
  });

  return state;
}

function assertClean(state: StressState, label: string) {
  // ERR_ABORTED возникает при переходе на другую страницу во время незавершённого запроса.
  const consoleErrors = state.consoleErrors.filter((text) => !/ERR_ABORTED/.test(text));
  expect(state.pageErrors, `${label}:uncaught page errors:\n${state.pageErrors.join('\n')}`).toEqual([]);
  expect(consoleErrors, `${label}: console errors:\n${consoleErrors.join('\n')}`).toEqual([]);
  expect(state.badResponses, `${label}: 4xx/5xx:\n${state.badResponses.join('\n')}`).toEqual([]);
}

async function expectNoCrash(page: Page) {
  await expect(page.getByText('Что-то пошло не так')).toHaveCount(0);
}

test.describe('Стресс: 100 повторений операций', () => {
  test('STRESS-01 открытие страниц: 100 загрузок', async ({ page }) => {
    test.setTimeout(LONG_TEST_MS);
    const state = await setupStress(page);
    const routes = [
      '/',
      '/payments',
      '/debts',
      '/stats',
      '/settings',
      '/credits/new',
      '/credits/c1',
      '/analytics',
      '/import',
    ];

    for (let i = 0; i < ITERATIONS; i += 1) {
      const path = routes[i % routes.length];
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('main')).toBeVisible();
      await expectNoCrash(page);
    }

    assertClean(state, 'STRESS-01');
  });

  test('STRESS-02 переходы между разделами: 100 кликов', async ({ page }) => {
    test.setTimeout(LONG_TEST_MS);
    const state = await setupStress(page);
    await openApp(page, '/');

    const nav: Array<[string, string]> = [
      ['Долги', '/debts'],
      ['Аналитика', '/stats'],
      ['Настройки', '/settings'],
      ['Главная', '/'],
    ];

    for (let i = 0; i < ITERATIONS; i += 1) {
      const [label, path] = nav[i % nav.length];
      const button = page.getByRole('button', { name: label, exact: true });
      await button.click();
      await expect(page).toHaveURL(path);
      await expect(button).toHaveAttribute('aria-current', 'page');
      await expectNoCrash(page);
    }

    assertClean(state, 'STRESS-02');
  });

  test('STRESS-03 заполнение и отправка формы: 100 сохранений', async ({ page }) => {
    test.setTimeout(LONG_TEST_MS);
    const state = await setupStress(page);

    for (let i = 0; i < ITERATIONS; i += 1) {
      await page.goto('/credits/new', { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { name: 'Новый долг' })).toBeVisible();

      await page.locator('input[name="name"]').fill(`Тестовый долг ${i + 1}`);
      await page.locator('input[name="principal"]').fill('123456');
      await page.locator('input[name="annualRate"]').fill('12.5');
      await page.locator('input[name="startDate"]').fill('2025-01-15');
      await page.locator('input[name="termMonths"]').fill('36');
      await page.locator('input[name="paymentDay"]').fill('15');

      await page.getByRole('button', { name: 'Сохранить' }).click();
      await expect(page).toHaveURL(/\/credits\/stress-\d+$/);
      await expectNoCrash(page);
    }

    expect(state.createCalls, 'POST /credits должен вызываться один раз за итерацию').toBe(ITERATIONS);
    assertClean(state, 'STRESS-03');
  });

  test('STRESS-04 сохранение и загрузка: 100 themes + reload', async ({ page }) => {
    test.setTimeout(LONG_TEST_MS);
    const state = await setupStress(page);
    await openApp(page, '/settings');

    for (let i = 0; i < ITERATIONS; i += 1) {
      const theme = i % 2 === 0 ? 'dark' : 'light';
      await page.getByTestId(`theme-${theme}`).click();
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      expect(await page.evaluate(() => localStorage.getItem('credit-tracker-theme'))).toBe(theme);

      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(page.locator('main')).toBeVisible();
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      await expectNoCrash(page);
    }

    assertClean(state, 'STRESS-04');
  });

  test('STRESS-05 фильтрация/сортировка: 100 переключений вкладок', async ({ page }) => {
    test.setTimeout(LONG_TEST_MS);
    const state = await setupStress(page);
    await openApp(page, '/debts');

    let firstPaymentRow: string | null = null;
    for (let i = 0; i < ITERATIONS; i += 1) {
      if (i % 2 === 0) {
        await page.getByRole('tab', { name: 'Платежи' }).click();
        await expect(page).toHaveURL('/debts?view=payments');
        await expect(page.getByText('Ближайшие платежи', { exact: true })).toBeVisible();
        const first = await page.locator('.payment-row').first().textContent();
        expect(first, 'список платежей не должен быть пустым').toBeTruthy();
        if (firstPaymentRow === null) firstPaymentRow = first;
        expect(first, 'порядок сортировки платежей должен быть стабильным').toBe(firstPaymentRow);
      } else {
        await page.getByRole('tab', { name: 'Долги', exact: true }).click();
        await expect(page).toHaveURL('/debts');
        await expect(page.getByText('Мои долги', { exact: true })).toBeVisible();
        await expect(page.locator('.debt-card')).toHaveCount(3);
      }
      await expectNoCrash(page);
    }

    assertClean(state, 'STRESS-05');
  });

  test('STRESS-06 редактирование записи: 100 freeze/unfreeze', async ({ page }) => {
    test.setTimeout(LONG_TEST_MS);
    const state = await setupStress(page);
    await openApp(page, '/debts');

    const card = page.locator('.debt-card').first();
    const balance = card.locator('p.tabular.text-heading').first();
    const expected = await balance.textContent();

    for (let i = 0; i < ITERATIONS; i += 1) {
      await card.locator('button[aria-label="Меню действий"]').click();
      await page.getByRole('button', { name: /Грейс/ }).click();
      await expect(balance).toHaveText(expected ?? '');
      await expectNoCrash(page);
    }

    expect(state.freezeCalls, 'POST /credits/:id/freeze должен вызываться один раз за итерацию').toBe(
      ITERATIONS,
    );
    assertClean(state, 'STRESS-06');
  });

  test('STRESS-07 редактирование настроек: 100 сохранений дохода', async ({ page }) => {
    test.setTimeout(LONG_TEST_MS);
    const state = await setupStress(page);
    await openApp(page, '/settings');

    const incomeAccordion = page.getByTestId('income-accordion');
    await incomeAccordion.locator('button').first().click();
    await expect(incomeAccordion).toHaveAttribute('data-open', 'true');

    const income = page.getByPlaceholder('120 000');
    for (let i = 0; i < ITERATIONS; i += 1) {
      await income.fill(String(100000 + i));
      await page.getByRole('button', { name: 'Сохранить доход' }).click();
      await expect(page.getByText('Доход сохранён')).toBeVisible();
      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(page.locator('main')).toBeVisible();
      await expectNoCrash(page);
      // После reload аккордон снова закрыт — открываем его для следующей итерации.
      await page.getByTestId('income-accordion').locator('button').first().click();
    }

    assertClean(state, 'STRESS-07');
  });

  test('STRESS-08 быстрые повторы: 100 тройных кликов', async ({ page }) => {
    test.setTimeout(LONG_TEST_MS);
    const state = await setupStress(page);
    await openApp(page, '/settings');

    for (let i = 0; i < ITERATIONS; i += 1) {
      const expected = i % 2 === 0 ? 'dark' : 'light';
      // Три синхронных клика в одном кадре: проверяем, что состояние и persist не рассинхронизируются.
      await page.evaluate((mode) => {
        const target = document.querySelector(`[data-testid="theme-${mode}"]`) as HTMLElement | null;
        if (!target) return;
        target.click();
        target.click();
        target.click();
      }, expected);
      await expect(page.locator('html')).toHaveAttribute('data-theme', expected);
      expect(await page.evaluate(() => localStorage.getItem('credit-tracker-theme'))).toBe(expected);
      await expectNoCrash(page);
    }

    assertClean(state, 'STRESS-08');
  });
});
