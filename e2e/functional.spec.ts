import { expect, test } from '@playwright/test';
import { mockApi, openApp, seedApp } from './fixtures';

async function openAddCreditForm(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: 'Добавить долг' }).click();
  await expect(page).toHaveURL(/\/credits\/new$/);
  await expect(page.getByRole('heading', { name: 'Добавление долга' })).toBeVisible();
}

test('FloatingNav: три навигационные кнопки видны на главной', async ({ page }) => {
  await seedApp(page, 'light');
  await mockApi(page);
  await openApp(page, '/');

  await expect(page.getByRole('button', { name: 'Главная' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Добавить долг' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Настройки' })).toBeVisible();

  // Активная кнопка "Главная" имеет aria-current="page"
  await expect(page.getByRole('button', { name: 'Главная' })).toHaveAttribute('aria-current', 'page');
});

test('FloatingNav: Скрытие на форме — навигация исчезает из DOM', async ({ page }) => {
  await seedApp(page, 'light');
  await mockApi(page);
  await openApp(page, '/');

  await page.getByRole('button', { name: 'Добавить долг' }).click();

  await expect(page).toHaveURL(/\/credits\/new$/);
  const nav = await page.evaluate(() => document.querySelector('nav[aria-label="Основная навигация"]'));
  expect(nav).toBeNull();
});

test('FloatingNav: Возврат с формы — навигация появляется, без ошибок React', async ({ page }) => {
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

  await expect(page).toHaveURL(/\/credits\/new$/);
  await page.getByRole('button', { name: 'Закрыть' }).click();

  await expect(page).toHaveURL('/');
  await expect(page.getByRole('button', { name: 'Главная' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Добавить долг' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Настройки' })).toBeVisible();
  expect(consoleErrors, `Browser console errors:\n${consoleErrors.join('\n')}`).toEqual([]);
  expect(pageErrors, `Uncaught page errors:\n${pageErrors.join('\n')}`).toEqual([]);
});

test('FloatingNav: Переход на Настройки меняет активную кнопку', async ({ page }) => {
  await seedApp(page, 'light');
  await mockApi(page);
  await openApp(page, '/');

  await page.getByRole('button', { name: 'Настройки' }).click();
  await expect(page).toHaveURL('/settings');

  await expect(page.getByRole('button', { name: 'Настройки' })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('button', { name: 'Главная' })).not.toHaveAttribute('aria-current', 'page');
});

// Остальные продуктовые E2E остаются без изменений.
test('pay installment optimistically (no spinner)', async ({ page }) => {
  await seedApp(page, 'light');
  await mockApi(page);
  await openApp(page, '/');

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
  await openApp(page, '/');

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
