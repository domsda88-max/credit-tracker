import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { measureContrast } from './contrast';
import {
  collectTextPairs,
  mockApi,
  openApp,
  seedApp,
  type MockOptions,
} from './fixtures';

const OUT = path.resolve('e2e/out');
const THEMES = ['light', 'dark'] as const;

test.beforeAll(() => {
  fs.mkdirSync(OUT, { recursive: true });
});

async function screenshot(page: Parameters<typeof openApp>[0], name: string) {
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
}

for (const theme of THEMES) {
  test(`dashboard: ${theme} theme, tokens, immersive layout`, async ({ page }) => {
    await seedApp(page, theme);
    await mockApi(page);
    await openApp(page, '/');

    await expect(page.getByText('Ближайшие платежи', { exact: true })).toBeVisible();
    await expect(page.locator('.payment-row').first()).toBeVisible();

    const title = page.locator('.payment-row p').first();
    await expect(title).toBeVisible();
    const titleCss = await title.evaluate((el) => {
      const s = getComputedStyle(el);
      return {
        whiteSpace: s.whiteSpace,
        textOverflow: s.textOverflow,
        overflow: s.overflow,
      };
    });
    expect(titleCss.whiteSpace).toBe('nowrap');
    expect(titleCss.textOverflow).toBe('ellipsis');
    expect(titleCss.overflow).toBe('hidden');

    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);

    await expect(page.locator('header')).toHaveCount(0);
    await expect(page.getByText('Credit Tracker', { exact: true })).toHaveCount(0);
    await expect(page.locator('.tabbar')).toHaveCount(0);

    const nav = page.locator('nav[aria-label="Основная навигация"]');
    await expect(nav).toBeVisible();
    for (const label of ['Главная', 'Долги', 'Аналитика', 'Настройки']) {
      await expect(page.getByRole('button', { name: label, exact: true })).toBeVisible();
    }
    await expect(page.getByRole('button', { name: 'Главная' })).toHaveAttribute('aria-current', 'page');

    const layout = await page.evaluate(() => {
      const main = document.querySelector('main');
      return {
        docOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        mainOverflow: main ? main.scrollWidth - main.clientWidth : -1,
        bodyBackground: getComputedStyle(document.body).backgroundColor,
      };
    });
    expect(layout.docOverflow).toBeLessThanOrEqual(0);
    expect(layout.mainOverflow).toBeLessThanOrEqual(0);
    expect(layout.bodyBackground).toMatch(/^rgb\(/);

    await screenshot(page, `dashboard-${theme}`);
  });
}

test('название платежа — одна строка с эллипсисом', async ({ page }) => {
  await seedApp(page, 'light');
  await mockApi(page);
  await openApp(page, '/');

  const title = page.locator('.payment-row p').first();
  const metrics = await title.evaluate((el) => {
    const style = getComputedStyle(el);
    return {
      whiteSpace: style.whiteSpace,
      textOverflow: style.textOverflow,
      overflow: style.overflow,
      height: el.getBoundingClientRect().height,
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
    };
  });

  expect(metrics.whiteSpace).toBe('nowrap');
  expect(metrics.textOverflow).toBe('ellipsis');
  expect(metrics.height).toBeLessThan(26);
  expect(metrics.scrollWidth).toBeGreaterThanOrEqual(metrics.clientWidth);
});

test('navigation: glass bar screenshot (light)', async ({ page }) => {
  await seedApp(page, 'light');
  await mockApi(page);
  await openApp(page, '/');

  for (const label of ['Главная', 'Долги', 'Аналитика', 'Настройки']) {
    await expect(page.getByRole('button', { name: label, exact: true })).toBeVisible();
  }

  const navStyle = await page
    .locator('nav[aria-label="Основная навигация"]')
    .evaluate((el) => {
      const s = getComputedStyle(el);
      return {
        backdrop: s.backdropFilter || s.webkitBackdropFilter,
        background: s.backgroundColor,
        border: s.borderTopColor,
      };
    });
  expect(navStyle.backdrop).toContain('blur');
  expect(navStyle.background).toMatch(/rgba?\(/);
  expect(navStyle.border).toMatch(/rgba?\(/);

  await screenshot(page, 'dashboard-nav-bar-light');
});

test('motivation slots keep minutes and day 61 is not 100%', async ({ page }) => {
  await seedApp(page, 'dark');
  await mockApi(page);
  await openApp(page, '/settings');

  await page.getByTestId('notifications-chevron').click();
  await expect(page.getByTestId('notifications-accordion')).toHaveAttribute('data-open', 'true');
  await expect(page.getByText('Ежедневная мотивация')).toBeVisible();
  await expect(
    page.getByRole('switch', { name: 'Включить ежедневную мотивацию' }),
  ).toBeVisible();
  await expect(page.getByText('Уведомления в: 09:30, 13:30, 17:30, 21:30, 01:30, 05:30')).toBeVisible();

  const progress = page.getByRole('progressbar', { name: 'Прогресс мотивационного цикла' });
  await expect(progress).toHaveAttribute('aria-valuenow', '61');
  await expect(progress).toHaveAttribute('aria-valuemax', '70');
  const width = await progress.locator('div').evaluate((el) => el.style.width);
  expect(Number.parseFloat(width)).toBeCloseTo(87, 0);
  expect(Number.parseFloat(width)).toBeLessThan(100);

  const panel = page.getByTestId('notifications-accordion');
  await panel.locator('input[type="time"]').fill('10:15');
  await panel.locator('select').last().selectOption('4');
  await expect(page.getByText('Уведомления в: 10:15, 16:15, 22:15, 04:15')).toBeVisible();

  await screenshot(page, 'settings-motivation-dark');
});

test('accordion collapse leaves no ghost content', async ({ page }) => {
  await seedApp(page, 'dark');
  await mockApi(page);
  await openApp(page, '/settings');

  const accordion = page.getByTestId('notifications-accordion');
  const panel = accordion.locator('.acc');
  const content = page.getByRole('switch', { name: 'Включить ежедневную мотивацию' });
  const chevron = page.getByTestId('notifications-chevron');

  await chevron.click();
  await expect(content).toBeVisible();
  await expect(panel).toHaveAttribute('data-open', 'true');

  await chevron.click();
  await expect(panel).toHaveAttribute('data-open', 'false');
  await page.waitForTimeout(350);

  const panelBox = await panel.boundingBox();
  expect(panelBox!.height).toBeLessThan(1);
  const inner = await panel.evaluate((el) => {
    const style = getComputedStyle(el);
    return {
      rows: style.gridTemplateRows,
      overflow: getComputedStyle(el.firstElementChild!).overflow,
    };
  });
  expect(inner.rows === '0px' || inner.rows === '0fr').toBeTruthy();
  expect(inner.overflow).toBe('hidden');
});

test('skeleton only on the first cold load', async ({ page }) => {
  await seedApp(page, 'dark');
  await mockApi(page, { listDelayMs: 1200 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  await expect(page.locator('.skeleton').first()).toBeVisible();
  await expect(page.locator('.payment-row').first()).toBeVisible({ timeout: 15_000 });
  expect(await page.locator('.skeleton').count()).toBe(0);

  await page.getByRole('button', { name: 'Настройки' }).click();
  await expect(page).toHaveURL('/settings');
  await expect(page.getByTestId('push-toggle-button')).toBeVisible();

  await page.getByRole('button', { name: 'Главная' }).click();
  await expect(page).toHaveURL('/');
  await expect(page.locator('.payment-row').first()).toBeVisible();
  expect(await page.locator('.skeleton').count()).toBe(0);
});

test('payments schedule: one primary CTA, compact marks, year headers', async ({ page }) => {
  await seedApp(page, 'light');
  await mockApi(page);
  await openApp(page, '/credits/c1');

  await expect(page.getByText('График платежей').first()).toBeVisible();

  await expect(page.getByRole('button', { name: 'Я оплатил', exact: true })).toHaveCount(1);
  await expect(page.locator('button[aria-label="Отметить оплаченным"]')).toHaveCount(33);

  const firstRow = page.locator('.schedule-row--virtual').first();
  await expect(firstRow.getByRole('button', { name: 'Я оплатил', exact: true })).toBeVisible();

  const compact = page.locator('button[aria-label="Отметить оплаченным"]').first();
  const compactBox = await compact.boundingBox();
  expect(compactBox!.width).toBe(32);
  expect(compactBox!.height).toBe(32);

  const years = page.locator('h3.sticky');
  await expect(years).toHaveCount(4);
  expect(await years.allTextContents()).toEqual(['2026', '2027', '2028', '2029']);
  const sticky = await years.first().evaluate((el) => getComputedStyle(el).position);
  expect(sticky).toBe('sticky');

  await expect(page.locator('.schedule-row--virtual')).toHaveCount(34);

  await screenshot(page, 'credit-detail-light');
});

for (const theme of THEMES) {
  test(`contrast: all visible text >= 4.5:1 (${theme})`, async ({ page }) => {
    test.setTimeout(90_000);
    await seedApp(page, theme);
    await mockApi(page);
    const pairs = [];

    for (const route of ['/', '/payments', '/debts', '/stats']) {
      await openApp(page, route);
      pairs.push(...(await collectTextPairs(page)));
    }
    await screenshot(page, `payments-${theme}`);

    await openApp(page, '/settings');
    const headers = page.locator('button[aria-expanded]');
    for (let i = 0; i < (await headers.count()); i += 1) {
      const header = headers.nth(i);
      if ((await header.getAttribute('aria-expanded')) === 'false') {
        await header.click();
        await page.waitForTimeout(280);
      }
    }
    pairs.push(...(await collectTextPairs(page)));
    await screenshot(page, `settings-${theme}`);

    await openApp(page, '/credits/c1');
    pairs.push(...(await collectTextPairs(page)));

    const checked = pairs
      .map((pair) => measureContrast(pair))
      .filter((value): value is NonNullable<typeof value> => value !== null);
    const failures = checked
      .filter((result) => result.ratio < 4.5)
      .sort((a, b) => a.ratio - b.ratio);

    expect(checked.length).toBeGreaterThan(60);

    const message = failures
      .slice(0, 30)
      .map(
        (failure) =>
          `${failure.ratio.toFixed(2)}:1  "${failure.text}"  ${failure.foreground} on ${failure.background}  (${failure.selector}, ${failure.fontSize}px)`,
      )
      .join('\n');

    expect(failures, `${failures.length} text pairs below 4.5:1\n${message}`).toHaveLength(0);
  });

  test(`no off-palette colours (${theme})`, async ({ page }) => {
    await seedApp(page, theme);
    await mockApi(page);
    await openApp(page, '/');

    const offPalette = await page.evaluate(() => {
      const allowed = (value: string) => {
        const v = value.trim().toLowerCase();
        return (
          !v ||
          v === 'none' ||
          v === 'transparent' ||
          v === 'currentcolor' ||
          v === 'normal' ||
          v === 'auto' ||
          v.startsWith('oklch(') ||
          v.startsWith('oklab(') ||
          v.startsWith('color(') ||
          v.startsWith('url(') ||
          v.startsWith('rgb(') ||
          v.startsWith('rgba(') ||
          v.startsWith('linear-gradient(') ||
          v.startsWith('radial-gradient(') ||
          v === 'rgba(0, 0, 0, 0)'
        );
      };

      const allowedImage = (value: string) => {
        const v = value.trim().toLowerCase();
        if (v === 'none') return true;
        if (v.includes('gradient')) return true;
        return !/#[0-9a-f]{3,8}\b/.test(v) && !/rgba?\((?!0,\s*0,\s*0,\s*0\))/.test(v);
      };

      const found = new Set<string>();
      const root = document.getElementById('root');
      const elements = [document.body, ...Array.from(root?.querySelectorAll('*') ?? [])];

      const isSvgShape = (el: Element) =>
        ['path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'text', 'use'].includes(
          el.tagName.toLowerCase(),
        );

      for (const el of elements) {
        const style = getComputedStyle(el);
        const tag = el.tagName.toLowerCase();
        const visible = el.getBoundingClientRect().width > 0 && el.getBoundingClientRect().height > 0;

        if (!allowed(style.color)) found.add(`color: ${style.color}  <${tag}>`);
        if (!allowed(style.backgroundColor)) {
          found.add(`backgroundColor: ${style.backgroundColor}  <${tag}>`);
        }
        if (!allowedImage(style.backgroundImage)) {
          found.add(`backgroundImage: ${style.backgroundImage}  <${tag}>`);
        }

        if (
          style.borderTopWidth !== '0px' && !allowed(style.borderTopColor) ||
          style.borderRightWidth !== '0px' && !allowed(style.borderRightColor) ||
          style.borderBottomWidth !== '0px' && !allowed(style.borderBottomColor) ||
          style.borderLeftWidth !== '0px' && !allowed(style.borderLeftColor)
        ) {
          found.add(`borderColor: ${style.borderTopColor} ${style.borderRightColor} ${style.borderBottomColor} ${style.borderLeftColor}  <${tag}>`);
        }

        if (isSvgShape(el) && visible) {
          if (!allowed(style.fill)) found.add(`fill: ${style.fill}  <${tag}>`);
          if (!allowed(style.stroke)) found.add(`stroke: ${style.stroke}  <${tag}>`);
        }

        if (style.textDecorationLine !== 'none' && !allowed(style.textDecorationColor)) {
          found.add(`textDecorationColor: ${style.textDecorationColor}  <${tag}>`);
        }
      }
      return [...found];
    });

    expect(offPalette).toEqual([]);
  });
}

for (const theme of THEMES) {
  test(`splash is painted with the stored theme (${theme})`, async ({ page }) => {
    await seedApp(page, theme);
    await mockApi(page, { bundleDelayMs: 1500 } satisfies MockOptions);

    await page.goto('/', { waitUntil: 'commit' });
    const splash = page.locator('#splash');
    const splashVisible = await splash.isVisible();
    if (splashVisible) {
      await expect(splash).toBeVisible();
    }
    await page.waitForFunction(
      () => getComputedStyle(document.documentElement).getPropertyValue('--color-bg').trim() !== '',
    );

    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    const painted = await page.evaluate(() => {
      const html = getComputedStyle(document.documentElement).backgroundColor;
      const body = getComputedStyle(document.body).backgroundColor;
      const splashEl = document.getElementById('splash');
      return {
        html,
        body,
        splash: splashEl ? getComputedStyle(splashEl).backgroundColor : 'removed',
      };
    });
    expect(painted.body).toBe(painted.html);
    expect(painted.html).toMatch(/^rgb\(/);

    await screenshot(page, `splash-${theme}`);

    await expect(page.getByRole('button', { name: 'Главная' })).toBeVisible({ timeout: 15_000 });
    await expect(splash).toHaveCount(0);
  });
}
