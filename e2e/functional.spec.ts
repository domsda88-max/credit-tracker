import { expect, test, type Page } from '@playwright/test';
import { mockApi, mockPush, openApp, seedApp } from './fixtures';

const NAV_ITEMS = ['Главная', 'Долги', 'Аналитика', 'Настройки'] as const;

async function openAddCreditForm(page: Page) {
  await page.getByRole('button', { name: 'Долги', exact: true }).click();
  await expect(page).toHaveURL('/debts');
  await page.getByRole('link', { name: 'Добавить долг' }).click();
  await expect(page).toHaveURL(/\/credits\/new$/);
  await expect(page.getByRole('heading', { name: 'Новый долг' })).toBeVisible();
}

test('FloatingNav: четыре раздела видны на главной', async ({ page }) => {
  await seedApp(page, 'light');
  await mockApi(page);
  await openApp(page, '/');

  const nav = page.locator('nav[aria-label="Основная навигация"]');
  await expect(nav).toBeVisible();
  for (const label of NAV_ITEMS) {
    await expect(page.getByRole('button', { name: label, exact: true })).toBeVisible();
  }
  await expect(page.getByRole('button', { name: 'Главная' })).toHaveAttribute('aria-current', 'page');
});

test('FloatingNav: переключение между разделами', async ({ page }) => {
  await seedApp(page, 'light');
  await mockApi(page);
  await openApp(page, '/');

  const routes: Array<[(typeof NAV_ITEMS)[number], string]> = [
    ['Долги', '/debts'],
    ['Аналитика', '/stats'],
    ['Настройки', '/settings'],
    ['Главная', '/'],
  ];
  for (const [label, path] of routes) {
    await page.getByRole('button', { name: label, exact: true }).click();
    await expect(page).toHaveURL(path);
    await expect(page.getByRole('button', { name: label, exact: true })).toHaveAttribute(
      'aria-current',
      'page',
    );
  }
});

test('FloatingNav: на форме добавления навигация исчезает из DOM', async ({ page }) => {
  await seedApp(page, 'light');
  await mockApi(page);
  await openApp(page, '/');
  await openAddCreditForm(page);
  await expect(page.locator('nav[aria-label="Основная навигация"]')).toHaveCount(0);
});

test('FloatingNav: возврат с формы — навигация появляется, без ошибок React', async ({ page }) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];

  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await seedApp(page, 'light');
  await mockApi(page);
  await openApp(page, '/');
  await openAddCreditForm(page);

  await page.getByRole('button', { name: 'Закрыть' }).click();

  await expect(page).toHaveURL('/');
  await expect(page.getByRole('button', { name: 'Главная' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Долги' })).toBeVisible();
  expect(consoleErrors, `Browser console errors:\n${consoleErrors.join('\n')}`).toEqual([]);
  expect(pageErrors, `Uncaught page errors:\n${pageErrors.join('\n')}`).toEqual([]);
});

test('Настройки доступны из нижней навигации', async ({ page }) => {
  await seedApp(page, 'light');
  await mockApi(page);
  await openApp(page, '/');

  await page.getByRole('button', { name: 'Настройки', exact: true }).click();
  await expect(page).toHaveURL('/settings');
  await expect(page.locator('nav[aria-label="Основная навигация"]')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Настройки', exact: true })).toHaveAttribute('aria-current', 'page');
});

test('Главная: ближайшие платежи → деньги в месяц → сводка, без списка долгов', async ({ page }) => {
  await seedApp(page, 'light');
  await mockApi(page);
  await openApp(page, '/');

  const y = async (text: string) => {
    const box = await page.getByText(text, { exact: true }).first().boundingBox();
    expect(box, `блок «${text}»`).not.toBeNull();
    return box!.y;
  };

  const paymentsY = await y('Ближайшие платежи');
  const moneyY = await y('Деньги в месяц');
  const summaryY = await y('Сводка');

  expect(paymentsY).toBeLessThan(moneyY);
  expect(moneyY).toBeLessThan(summaryY);
  await expect(page.getByText('Мои долги', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Что гасить первым', { exact: true })).toHaveCount(0);
});

test('Платежи используют ту же логику ближайших платежей, что и главная', async ({ page }) => {
  await seedApp(page, 'light');
  await mockApi(page);
  await openApp(page, '/');

  const firstOnDashboard = await page.locator('.payment-row').first().textContent();
  await page.getByRole('button', { name: 'Долги', exact: true }).click();
  await page.getByRole('tab', { name: 'Платежи' }).click();
  await expect(page).toHaveURL('/debts?view=payments');
  await expect(page.getByText('Ближайшие платежи', { exact: true })).toBeVisible();
  expect(await page.locator('.payment-row').first().textContent()).toBe(firstOnDashboard);
});

test('Долги: отдельная вкладка со списком активных и закрытых', async ({ page }) => {
  await seedApp(page, 'light');
  await mockApi(page);
  await openApp(page, '/debts');

  await expect(page.getByRole('tab', { name: 'Долги' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Платежи' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Добавить долг' })).toBeVisible();
  await expect(page.getByText('Мои долги', { exact: true })).toBeVisible();
  await expect(page.getByText('Закрытые', { exact: true })).toBeVisible();
  await expect(page.locator('.debt-card')).toHaveCount(3);
});

test('Аналитика: /analytics ведёт на /stats и содержит стратегию погашения', async ({ page }) => {
  await seedApp(page, 'light');
  await mockApi(page);
  await openApp(page, '/analytics');

  await expect(page).toHaveURL('/stats');
  await expect(page.getByText('Что гасить первым', { exact: true })).toBeVisible();
  await expect(page.getByText('Моя свобода от долгов')).toBeVisible();
});

test('Настройки: только светлая и тёмная темы', async ({ page }) => {
  await seedApp(page, 'light');
  await mockApi(page);
  await openApp(page, '/settings');

  await expect(page.getByTestId('theme-light')).toBeVisible();
  await expect(page.getByTestId('theme-dark')).toBeVisible();
  await expect(page.getByTestId('theme-warm')).toHaveCount(0);

  await page.getByTestId('theme-dark').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByTestId('theme-light').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});

test('Настройки: кнопка уведомлений работает независимо от раскрытия', async ({ page }) => {
  await seedApp(page, 'light');
  await mockApi(page);
  await mockPush(page);
  await openApp(page, '/settings');

  const accordion = page.getByTestId('notifications-accordion');
  const toggle = page.getByTestId('push-toggle-button');
  const chevron = page.getByTestId('notifications-chevron');

  await expect(accordion).toHaveAttribute('data-open', 'false');
  await expect(toggle).toHaveText('Включить');

  await toggle.click();
  await expect(toggle).toHaveText('Выключить');
  await expect(accordion).toHaveAttribute('data-open', 'false');
  await expect(page.getByRole('switch', { name: 'Включить push-уведомления' })).toHaveAttribute(
    'aria-checked',
    'true',
  );

  await chevron.click();
  await expect(accordion).toHaveAttribute('data-open', 'true');
  await expect(page.getByText('Ежедневная мотивация')).toBeVisible();

  await toggle.click();
  await expect(toggle).toHaveText('Включить');
  await expect(accordion).toHaveAttribute('data-open', 'true');
});

test('Настройки: устаревшая тема warm мигрирует в light', async ({ page }) => {
  await seedApp(page, 'light');
  await page.addInitScript(() => localStorage.setItem('credit-tracker-theme', 'warm'));
  await mockApi(page);
  await openApp(page, '/');

  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  expect(await page.evaluate(() => localStorage.getItem('credit-tracker-theme'))).toBe('light');
});

test('prefers-reduced-motion отключает анимации', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await seedApp(page, 'light');
  await mockApi(page);
  await openApp(page, '/');

  const durations = await page.evaluate(() => {
    const route = document.querySelector('.route-enter');
    const card = document.querySelector('.card-enter');
    return [route, card].map((el) => (el ? getComputedStyle(el).animationDuration : 'missing'));
  });
  expect(durations).not.toContain('missing');
  for (const duration of durations) {
    expect(['0.01ms', '1e-05s']).toContain(duration);
  }
});

test('pay installment optimistically (no spinner)', async ({ page }) => {
  await seedApp(page, 'light');
  await mockApi(page);
  await openApp(page, '/debts');

  const cards = page.locator('.debt-card');
  let payButton = null;
  for (let i = 0; i < (await cards.count()); i += 1) {
    const candidate = cards.nth(i).locator('button').filter({ hasText: /Оплатить/ });
    if ((await candidate.count()) > 0) {
      payButton = candidate.first();
      break;
    }
  }
  expect(payButton).not.toBeNull();
  await payButton!.click();
  await expect(page.getByText('Платёж отмечен')).toBeVisible({ timeout: 5_000 });
});

test('freeze → unfreeze preserves balance', async ({ page }) => {
  await seedApp(page, 'light');
  await mockApi(page);
  await openApp(page, '/debts');

  const card = page.locator('.debt-card').first();
  const before = await card.locator('p.tabular.text-heading').first().textContent();
  await card.locator('button[aria-label="Меню действий"]').click();
  const freezeButton = page.getByRole('button', { name: /Грейс/ });
  await expect(freezeButton).toBeVisible();
  await freezeButton.click();
  await expect(card.locator('p.tabular.text-heading').first()).toHaveText(before ?? '');

  await card.locator('button[aria-label="Меню действий"]').click();
  const unfreezeButton = page.getByRole('button', { name: /Грейс/ });
  await unfreezeButton.click();
  await expect(card.locator('p.tabular.text-heading').first()).toHaveText(before ?? '');
});
