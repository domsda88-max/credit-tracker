import { expect, test } from '@playwright/test';
import { mockApi, openApp, seedApp } from './fixtures';

async function openAddCreditForm(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: 'Меню навигации' }).click();
  await page.getByRole('button', { name: 'Добавить долг' }).click();
  await expect(page).toHaveURL(/\/credits\/new$/);
  await expect(page.getByRole('heading', { name: 'Добавить долг' })).toBeVisible();
}

test('FloatingNav: триггер виден в закрытом состоянии и меню раскрывается <200ms', async ({ page }) => {
  await seedApp(page, 'light');
  await mockApi(page);
  await openApp(page, '/');

  const trigger = page.getByRole('button', { name: 'Меню навигации' });
  await expect(trigger).toBeVisible();
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');

  const start = Date.now();
  await trigger.click();
  await expect(page.getByRole('button', { name: 'Главная' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Добавить долг' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Настройки' })).toBeVisible();
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  expect(Date.now() - start).toBeLessThan(200);
});

test('FloatingNav: Скрытие на форме — триггер исчезает из DOM', async ({ page }) => {
  await seedApp(page, 'light');
  await mockApi(page);
  await openApp(page, '/');

  await page.getByRole('button', { name: 'Меню навигации' }).click();
  await page.getByRole('button', { name: 'Добавить долг' }).click();

  await expect(page).toHaveURL(/\/credits\/new$/);
  await expect(page.locator('button[aria-label="Меню навигации"]')).toHaveCount(0);
});

test('FloatingNav: Возврат с формы — реальный крестик, SPA и без ошибок React', async ({ page }) => {
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
  await expect(page.locator('button[aria-label="Меню навигации"]')).toBeVisible();
  expect(consoleErrors, `Browser console errors:\n${consoleErrors.join('\n')}`).toEqual([]);
  expect(pageErrors, `Uncaught page errors:\n${pageErrors.join('\n')}`).toEqual([]);
});

test('FloatingNav: Escape закрывает меню', async ({ page }) => {
  await seedApp(page, 'light');
  await mockApi(page);
  await openApp(page, '/');

  const trigger = page.getByRole('button', { name: 'Меню навигации' });
  await trigger.click();
  await expect(page.getByRole('button', { name: 'Настройки' })).toBeVisible();

  await page.keyboard.press('Escape');

  await expect(page.getByRole('button', { name: 'Главная' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Добавить долг' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Настройки' })).toHaveCount(0);
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
});

test('тап по backdrop закрывает меню', async ({ page }) => {
  await seedApp(page, 'light');
  await mockApi(page);
  await openApp(page, '/');

  await page.getByRole('button', { name: 'Меню навигации' }).click();
  await expect(page.getByRole('button', { name: 'Главная' })).toBeVisible();
  await page.getByTestId('floating-nav-backdrop').click();
  await expect(page.getByRole('button', { name: 'Главная' })).toHaveCount(0);
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
