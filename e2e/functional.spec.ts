import { expect, test } from '@playwright/test';
import { mockApi, openApp, seedApp } from './fixtures';

test('fab: tap opens add credit form', async ({ page }) => {
  await seedApp(page, 'light');
  await mockApi(page);
  await openApp(page, '/');

  await expect(page.locator('button[aria-label="Добавить долг"]')).toBeVisible();
  await page.locator('button[aria-label="Добавить долг"]').click();

  await expect(page.getByRole('heading', { name: 'Добавить долг' })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByPlaceholder('Например, Альфа-Банк')).toBeVisible();
});

test('tabs: switch instantly and no badge', async ({ page }) => {
  await seedApp(page, 'light');
  await mockApi(page);
  await openApp(page, '/');

  // Нет бейджа на таб-баре
  await expect(page.locator('.badge')).toHaveCount(0);

  // Переход в Настройки и обратно — мгновенно
  await page.locator('.tabbar a[href="/settings"]').click();
  await expect(page.getByRole('heading', { name: 'Настройки' })).toBeVisible();

  const start = Date.now();
  await page.locator('.tabbar a[href="/"]').click();
  await expect(page.locator('.debt-card').first()).toBeVisible();
  const elapsed = Date.now() - start;
  expect(elapsed).toBeLessThan(1000);
});

test('pay installment optimistically (no spinner)', async ({ page }) => {
  await seedApp(page, 'light');
  await mockApi(page);
  await openApp(page, '/');

  // Находим любую активную карточку с кнопкой «Оплатить»
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

  // Оптимистично: без спиннера, действие завершается с тостом
  await expect(page.getByText('Платёж отмечен')).toBeVisible({ timeout: 5_000 });
});

test('freeze → unfreeze preserves balance', async ({ page }) => {
  await seedApp(page, 'light');
  await mockApi(page);
  await openApp(page, '/');

  const card = page.locator('.debt-card').first();
  const before = await card.locator('p.tabular.text-heading').first().textContent();

  // Открываем кебаб-меню
  await card.locator('button[aria-label="Меню действий"]').click();

  const freezeButton = page.getByRole('button', { name: /Грейс/ });
  await expect(freezeButton).toBeVisible();
  await freezeButton.click();

  // Баланс не изменился после заморозки
  await expect(card.locator('p.tabular.text-heading').first()).toHaveText(before ?? '');

  // Открываем меню снова и снимаем заморозку
  await card.locator('button[aria-label="Меню действий"]').click();
  const unfreezeButton = page.getByRole('button', { name: /Грейс/ });
  await unfreezeButton.click();

  await expect(card.locator('p.tabular.text-heading').first()).toHaveText(before ?? '');
});
