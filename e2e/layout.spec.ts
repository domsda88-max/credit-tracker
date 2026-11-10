import { expect, test } from '@playwright/test';
import { mockApi, openApp, seedApp } from './fixtures';

/**
 * Дизайн-система на практике: проверяем не «красиво ли», а измеримые вещи —
 * отсутствие горизонтального переполнения, одинаковые отступы контента,
 * ровную нижнюю навигацию и геометрию иконок.
 */

const ROUTES = ['/', '/stats', '/achievements', '/settings', '/credits/new', '/credits/c1'];

const VIEWPORTS = [
  { name: '320', width: 320, height: 700 },
  { name: '390', width: 390, height: 844 },
  { name: '768', width: 768, height: 1024 },
];

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
  right: number;
  bottom: number;
}

function measure(page: Parameters<typeof openApp>[0]) {
  return page.evaluate(() => {
    const rect = (el: Element | null): Box | null => {
      if (!el) return null;
      const b = el.getBoundingClientRect();
      return {
        x: Math.round(b.x * 10) / 10,
        y: Math.round(b.y * 10) / 10,
        w: Math.round(b.width * 10) / 10,
        h: Math.round(b.height * 10) / 10,
        right: Math.round(b.right * 10) / 10,
        bottom: Math.round(b.bottom * 10) / 10,
      };
    };
    const main = document.querySelector('main');
    const nav = document.querySelector('nav[aria-label="Основная навигация"]');
    const buttons = nav ? Array.from(nav.querySelectorAll('button')) : [];
    const navRect = nav ? nav.getBoundingClientRect() : null;
    const content = main?.firstElementChild ?? null;

    return {
      viewportW: window.innerWidth,
      docOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      mainOverflow: main ? main.scrollWidth - main.clientWidth : null,
      main: rect(main),
      content: rect(content),
      nav: rect(nav),
      navCenterDelta: navRect
        ? Math.round((navRect.x + navRect.width / 2 - window.innerWidth / 2) * 10) / 10
        : null,
      navBottomGap: navRect ? Math.round((window.innerHeight - navRect.bottom) * 10) / 10 : null,
      buttons: buttons.map((b) => {
        const r = rect(b);
        const center = r ? r.x + r.w / 2 : 0;
        const hasVisibleLabel = Array.from(b.querySelectorAll('span')).some(
          (s) => !s.className.includes('absolute'),
        );
        return {
          label: b.getAttribute('aria-label'),
          current: b.getAttribute('aria-current'),
          ...r,
          center: Math.round(center * 10) / 10,
          hasVisibleLabel,
        };
      }),
    };
  });
}

for (const vp of VIEWPORTS) {
  test.describe(`layout @ ${vp.name}px`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    for (const route of ROUTES) {
      test(`${route} не переполняется и держит отступы`, async ({ page }) => {
        await seedApp(page, 'light');
        await mockApi(page);
        await openApp(page, route);

        const m = await measure(page);

        // Нет горизонтального скролла — ни у документа, ни у main.
        expect(m.docOverflow, `doc overflow on ${route}`).toBeLessThanOrEqual(0);
        expect(m.mainOverflow, `main overflow on ${route}`).toBeLessThanOrEqual(0);

        // Контент начинается ровно там же, где main: без двойных отступов.
        expect(m.main).not.toBeNull();
        expect(m.content).not.toBeNull();
        expect(Math.abs(m.content!.x - m.main!.x), `content x on ${route}`).toBeLessThanOrEqual(0.5);

        // Единый верхний отступ 8px (+ safe-area).
        expect(m.content!.y - m.main!.y, `content top on ${route}`).toBeGreaterThanOrEqual(7.5);
        expect(m.content!.y - m.main!.y, `content top on ${route}`).toBeLessThanOrEqual(8.5);
      });
    }
  });
}

test.describe('bottom navigation', () => {
  test('иконки без подписей, 48x48, равный шаг, по центру', async ({ page }) => {
    await seedApp(page, 'light');
    await mockApi(page);
    await openApp(page, '/');

    const m = await measure(page);

    expect(m.buttons).toHaveLength(5);
    for (const b of m.buttons) {
      expect(b.label, 'aria-label обязателен').toBeTruthy();
      expect(b.hasVisibleLabel, `подпись у ${b.label}`).toBe(false);
      expect(b.w, `ширина ${b.label}`).toBeCloseTo(48, 0);
      expect(b.h, `высота ${b.label}`).toBeCloseTo(48, 0);
    }

    // Равный шаг между центрами кнопок.
    const centers = m.buttons.map((b) => b.center);
    const gaps = centers.slice(1).map((c, i) => Math.round((c - centers[i]) * 10) / 10);
    for (const gap of gaps) {
      expect(gap, 'равный шаг между кнопками').toBeCloseTo(gaps[0], 0);
    }

    // Панель по центру экрана и в 12px от низа.
    expect(Math.abs(m.navCenterDelta ?? 99)).toBeLessThanOrEqual(1);
    expect(m.navBottomGap).toBeCloseTo(12, 0);

    // Активная кнопка помечена.
    expect(m.buttons.filter((b) => b.current === 'page')).toHaveLength(1);
    expect(m.buttons[0].current).toBe('page');
  });

  test('на форме добавления навигация скрыта', async ({ page }) => {
    await seedApp(page, 'light');
    await mockApi(page);
    await openApp(page, '/credits/new');
    const m = await measure(page);
    expect(m.nav).toBeNull();
  });
});

test.describe('экраны и онбординг', () => {
  test('/stats показывает свободу от долгов', async ({ page }) => {
    await seedApp(page, 'light');
    await mockApi(page);
    await openApp(page, '/stats');
    await expect(page.getByText('Моя свобода от долгов')).toBeVisible();
    await expect(page.getByText('Переплата по графику')).toBeVisible();
  });

  test('/achievements показывает уровень и достижения', async ({ page }) => {
    await seedApp(page, 'light');
    await mockApi(page);
    await openApp(page, '/achievements');
    await expect(page.getByText('Ваш уровень')).toBeVisible();
    await expect(page.getByText('Ваши достижения')).toBeVisible();
  });

  test('/settings показывает видимые разделы', async ({ page }) => {
    await seedApp(page, 'light');
    await mockApi(page);
    await openApp(page, '/settings');

    for (const title of ['Тема', 'Деньги', 'Уведомления', 'Данные', 'Аккаунт']) {
      await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
    }
  });

  test('карточки на экранах имеют единый внутренний отступ', async ({ page }) => {
    await seedApp(page, 'light');
    await mockApi(page);

    for (const route of ['/stats', '/achievements', '/settings']) {
      await openApp(page, route);
      const paddings = await page.evaluate(() =>
        Array.from(document.querySelectorAll('main .card')).map((el) => {
          const s = getComputedStyle(el);
          return [s.paddingTop, s.paddingRight, s.paddingBottom, s.paddingLeft].join(' ');
        }),
      );
      expect(paddings.length, `карточки на ${route}`).toBeGreaterThan(0);
      expect(new Set(paddings).size, `отступы карточек на ${route}: ${paddings.join(' | ')}`).toBe(1);
      expect(paddings[0], `отступ карточек на ${route}`).toBe('20px 20px 20px 20px');
    }
  });

  test('онбординг показывается один раз и пропускается', async ({ page }) => {
    // Без флага онбординга — приложение перекрыто введением.
    await page.addInitScript(() => {
      localStorage.setItem(
        'credit-tracker-auth',
        JSON.stringify({
          state: {
            user: { id: 'u1', email: 'audit@example.com', name: 'Visual Audit' },
            token: 'mock-audit-token',
            isAuthenticated: true,
          },
          version: 0,
        }),
      );
      localStorage.setItem('credit-tracker-theme', 'light');
      localStorage.removeItem('credit-tracker-onboarded');
    });
    await mockApi(page);
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    await expect(page.getByText('Контролируйте свои долги')).toBeVisible();
    await expect(page.locator('main')).toHaveCount(0);

    await page.getByRole('button', { name: 'Пропустить введение' }).click();
    await expect(page.locator('main')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Главная' })).toBeVisible();

    const flag = await page.evaluate(() => localStorage.getItem('credit-tracker-onboarded'));
    expect(flag).toBe('1');
  });
});
