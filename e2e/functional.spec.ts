import { expect, test } from '@playwright/test';
import { mockApi, openApp, seedApp } from './fixtures';

test('speed dial: раскрывается <200ms', async ({ page }) => {
  const errors: string[] = [];
  const logs: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (msg) => {
    logs.push(`${msg.type()}: ${msg.text()}`);
    if (msg.type() === 'error') errors.push(`CONSOLE: ${msg.text()}`);
  });

  await seedApp(page, 'light');
  await mockApi(page);
  await openApp(page, '/');

  console.log('ERRORS BEFORE CLICK:', errors);
  console.log('LOGS BEFORE CLICK:', logs);
  const menuButton = page.locator('button[aria-label="Открыть навигацию"]');
  await expect(menuButton).toBeVisible();

  const start = Date.now();
  await menuButton.click();
  await expect(page.locator('button[aria-label="Главная"]')).toBeVisible();
  const elapsed = Date.now() - start;
  expect(elapsed).toBeLessThan(200);
});

test('кнопка Плюс в меню открывает /credits/new', async ({ page }) => {
  await seedApp(page, 'light');
  await mockApi(page);
  await openApp(page, '/');

  await page.locator('button[aria-label="Открыть навигацию"]').click();
  await expect(page.locator('button[aria-label="Добавить долг"]')).toBeVisible();
  await page.locator('button[aria-label="Добавить долг"]').click();

  await expect(page.getByRole('heading', { name: 'Добавить долг' })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByPlaceholder('Например, Альфа-Банк')).toBeVisible();
});

test('тап по backdrop закрывает меню', async ({ page }) => {
  await seedApp(page, 'light');
  await mockApi(page);
  await openApp(page, '/');

  await page.locator('button[aria-label="Открыть навигацию"]').click();
  await expect(page.locator('button[aria-label="Главная"]')).toBeVisible();

  // Тап по backdrop (открытый оверлей)
  await page.locator('.bg-black\\/30').click();

  await expect(page.locator('button[aria-label="Главная"]')).toBeHidden();
});

test('активная кнопка подсвечена', async ({ page }) => {
  await seedApp(page, 'light');
  await mockApi(page);
  await openApp(page, '/');

  await page.locator('button[aria-label="Открыть навигацию"]').click();

  // На Главной активна кнопка «Главная» (Домик)
  const homeBtn = page.locator('button[aria-label="Главная"]');
  await expect(homeBtn).toHaveClass(/bg-accent/);

  // Переход в Настройки
  await page.locator('button[aria-label="Настройки"]').click();
  await expect(page.getByRole('heading', { name: 'Настройки' })).toBeVisible();

  // Снова открываем меню — активна «Настройки» (Шестерёнка)
  await page.locator('button[aria-label="Открыть навигацию"]').click();
  const settingsBtn = page.locator('button[aria-label="Настройки"]');
  await expect(settingsBtn).toHaveClass(/bg-accent/);
});

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
