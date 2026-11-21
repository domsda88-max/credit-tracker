# Глобальный редизайн UI — премиальный финтех (iOS + Telegram стиль)

**Путь к плану:** `.kilo/plans/1795242829771-global-ui-redesign.md`
**Репозиторий:** `C:\Users\pupup\OneDrive\Desktop\прототип`, клиент в `client/` (Vite + React 18 + Tailwind 3 + TS, PWA).
**Статус:** ожидает подтверждения пользователя. Код пока не менять. Коммит/пуш/деплой выполняет пользователь вручную.

## Контекст и принятые решения (из ЕТЗ)

- Три темы НЕ удаляются: `data-theme="light"`, `"warm"`, `"dark"`; переключатель в `SettingsPage` остаётся; механизм `localStorage` не меняется.
- Каждая тема получает СВОЮ палитру (подтверждено):
  - **light** — Palette №1 Blue Fintech (#0B132B, #1C2541, #3A506B, #5BC0DE, #F4D6B0, #D97706); фон/поверхности — светлые варианты; тёмные синие — акценты/текст/глубокие оттенки.
  - **dark** — Palette №2 Purple/Violet (#1A1A1F, #2D2B55, #6A5ACD, #A678B9, #F0D9B5, #F4A62A).
  - **warm** — Palette №3 Black/Plum/Wine (#0C0C14, #44142C, #642444, #E4E4EC, #FFFFFF).
- Переменные: `--bg`, `--surface`, `--surface2`, `--primary`, `--warm`, `--critical`, `--text-t1/2/3`, `--line` + добавить `--c-warm`, `--c-critical`.
- Legacy токены `--c-success/--c-danger/--c-warning/--c-accent` и `-fg` варианты СОХРАНЯЮТСЯ (имена не удаляются), значения переопределяются в neue палитру. success НЕ должен becoming warm (success — отдельный зелёный позитивный цвет).
- `warning` → `warm` ТОЛЬКО в трёх местах: `format.ts` (`urgencyTone`: `'danger' | 'warm' | 'muted'`), `UpcomingPayments.tsx:108`, ключ `warning` в `TONE` в `CreditRow.tsx`. Глобальная замена запрещена.
- SegmentedControl (iOS-стиль, 3 сегмента) создаётся в `client/src/components/SegmentedControl.tsx` и подключается в `SettingsPage.tsx` вместо трёх круглых кнопок темы.
- FloatingNav: `bg-surface/90 backdrop-blur-xl rounded-full`, активный таб — `primary`; хуки ДО любого раннего `return` (Rules of Hooks); логика навигации не меняется.
- BottomSheet: backdrop `backdrop-blur-xl`, панель `bg-surface`, `rounded-t-[20px]`, sheet-up; Escape/backdrop close/скролл-лок/safe-area — проверены в текущей реализации (см. Этап 6).
- Карточки `.card`: `rounded-2xl` (16px), `bg-surface`, `border border-line`, `shadow-sm`; без двойных рамок внутри; `.card-inner` без `border-l-[3px]`.
- Кнопки `.btn-primary`: `bg-primary text-bg rounded-full font-bold active:scale-95 transition-transform shadow-lg shadow-primary/20`.
- `.tap`: `active:scale-[0.97]`. Появление: `transition-opacity duration-300`.
- Шрифт: `-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif`.
- tabular-nums уже есть через `.tabular`/`.money` в index.css — не дублировать.
- keyframes/animation (`fade-in` 300ms, `fade-up`, `sheet-up`) сохранить.
- Бизнес-логика, API, расчёты, маршрутизация, авторизация, хранение темы — НЕ трогаются.

## Этапы реализации

### Этап 1. Аудит (уже сделан)
Изучены `tokens.css`, `tailwind.config.js`, `index.css`, `CreditRow.tsx`, `UpcomingPayments.tsx`, `format.ts`, `DashboardPage.tsx`, `SettingsPage.tsx`, `FloatingNav.tsx`, `BottomSheet.tsx`, `DebtOverview.tsx`, `MoneyFlow.tsx`, `GraceReplenishBlock.tsx`, `BalanceChart.tsx`, `DebtChart.tsx`, `OverdueAlert.tsx`, `FreedomPage.tsx`, `main.tsx`, `App.tsx`, `theme.ts`. Удалённая ветка `global-ui-redesign-88fef` — только заглушка (`package-lock.json`).

## Ограничение окружения (важно)

Редактирование исходных файлов (включая `client/src/styles/tokens.css`, `client/tailwind.config.js` и т.п.) недоступно — разрешены только правки файлов планов в `.kilo/plans/`. Содержимое Этапа 2 fully specified в плане ниже (готовые значения токенов для всех трёх тем), но запись в исходные файлы должна быть выполнена реализацией с соответствующими правами.

Готовое содержимое Этапа 2 (для копирования в `client/src/styles/tokens.css`):

```css
:root {
  color-scheme: light;

  /* Палитра №1 — Light / Blue Fintech. Светлые поверхности, глубокие синие акценты. */
  --c-bg: 245 248 251;
  --c-surface: 255 255 255;
  --c-surface2: 234 240 246;
  --c-t1: 11 19 43;
  --c-t2: 28 37 65;
  --c-t3: 58 80 107;
  --c-primary: 11 19 43;
  --c-warm: 244 214 176;
  --c-critical: 217 119 6;
  --c-line: 229 236 246;

  --color-bg: rgb(var(--c-bg));
  --color-surface: rgb(var(--c-surface));
  --color-surface-sunken: rgb(var(--c-surface2));
  --color-ink: rgb(var(--c-t1));
  --color-ink-muted: rgb(var(--c-t2));
  --color-ink-subtle: rgb(var(--c-t3));
  --color-primary: rgb(var(--c-primary));
  --color-warm: rgb(var(--c-warm));
  --color-critical: rgb(var(--c-critical));
  --color-accent: rgb(var(--c-primary));
  --color-success: rgb(var(--c-success));
  --color-warning: rgb(var(--c-warm));
  --color-danger: rgb(var(--c-critical));
  --color-border: rgb(var(--c-line));

  --color-success-fg: rgb(13 107 74);
  --color-danger-fg: rgb(59 18 0);
  --color-primary-fg: rgb(255 255 255);
  --color-warning-fg: rgb(11 19 43);
  --color-warm-fg: rgb(11 19 43);
  --color-critical-fg: rgb(59 18 0);

  --color-chart: #3598F3;
  --color-grace: #67BDF5;
  --color-grid: #C9DCF2;

  --card-gradient: linear-gradient(135deg, #EAF3FF, #D7E8FC);
  --fab-gradient: linear-gradient(135deg, #0B132B, #1C2541);

  --shadow-card: 0 1px 2px rgb(11 19 43 / 0.06);
  --shadow-tabbar: 0 8px 30px rgb(11 19 43 / 0.1);
  --radius-card: 16px;
  --radius-control: 12px;
}

[data-theme='warm'] {
  color-scheme: dark;

  /* Палитра №3 — Warm / Black Plum Wine. Тёмная основа, сливовые и винные оттенки, светлые Mist-поверхности.
   * На светлой поверхности Mist (#E4E4EC) текст тёмный; белый текст — только на тёмных поверхностях. */
  --c-bg: 12 12 20;
  --c-surface: 228 228 236;
  --c-surface2: 68 20 44;
  --c-t1: 12 12 20;
  --c-t2: 64 64 80;
  --c-t3: 128 128 144;
  --c-primary: 100 36 68;
  --c-warm: 228 228 236;
  --c-critical: 217 119 6;
  --c-line: 255 255 255;

  --color-bg: rgb(var(--c-bg));
  --color-surface: rgb(var(--c-surface));
  --color-surface-sunken: rgb(var(--c-surface2));
  --color-ink: rgb(var(--c-t1));
  --color-ink-muted: rgb(var(--c-t2));
  --color-ink-subtle: rgb(var(--c-t3));
  --color-primary: rgb(var(--c-primary));
  --color-warm: rgb(var(--c-warm));
  --color-critical: rgb(var(--c-critical));
  --color-accent: rgb(var(--c-primary));
  --color-success: rgb(var(--c-success));
  --color-warning: rgb(var(--c-warm));
  --color-danger: rgb(var(--c-critical));
  --color-border: rgb(var(--c-line));

  --color-success-fg: rgb(13 107 74);
  --color-danger-fg: rgb(59 18 0);
  --color-primary-fg: rgb(255 255 255);
  --color-warning-fg: rgb(12 12 20);
  --color-warm-fg: rgb(12 12 20);
  --color-critical-fg: rgb(59 18 0);

  --color-chart: #642444;
  --color-grace: #A678B9;
  --color-grid: rgba(255 255 255 / 0.1);

  --card-gradient: linear-gradient(135deg, #44142C, #0C0C14);
  --fab-gradient: linear-gradient(135deg, #642444, #44142C);

  --shadow-card: 0 1px 2px rgb(0 0 0 / 0.35);
  --shadow-tabbar: 0 8px 30px rgb(0 0 0 / 0.45);
}

[data-theme='dark'] {
  color-scheme: dark;

  /* Палитра №2 — Dark / Purple Fintech. Глубокий графитовый фон, фиолетовые поверхности. */
  --c-bg: 26 26 31;
  --c-surface: 45 43 85;
  --c-surface2: 30 28 50;
  --c-t1: 255 255 255;
  --c-t2: 166 120 185;
  --c-t3: 200 180 210;
  --c-primary: 106 90 205;
  --c-warm: 240 217 181;
  --c-critical: 244 166 42;
  --c-line: 255 255 255;

  --color-bg: rgb(var(--c-bg));
  --color-surface: rgb(var(--c-surface));
  --color-surface-sunken: rgb(var(--c-surface2));
  --color-ink: rgb(var(--c-t1));
  --color-ink-muted: rgb(var(--c-t2));
  --color-ink-subtle: rgb(var(--c-t3));
  --color-primary: rgb(var(--c-primary));
  --color-warm: rgb(var(--c-warm));
  --color-critical: rgb(var(--c-critical));
  --color-accent: rgb(var(--c-primary));
  --color-success: rgb(var(--c-success));
  --color-warning: rgb(var(--c-warm));
  --color-danger: rgb(var(--c-critical));
  --color-border: rgb(var(--c-line));

  --color-success-fg: rgb(13 107 74);
  --color-danger-fg: rgb(26 26 31);
  --color-primary-fg: rgb(255 255 255);
  --color-warning-fg: rgb(26 26 31);
  --color-warm-fg: rgb(26 26 31);
  --color-critical-fg: rgb(26 26 31);

  --color-chart: #6A5ACD;
  --color-grace: #A678B9;
  --color-grid: rgba(255 255 255 / 0.1);

  --card-gradient: linear-gradient(135deg, #2D2B55, #1A1A1F);
  --fab-gradient: linear-gradient(135deg, #6A5ACD, #44142C);

  --shadow-card: 0 1px 2px rgb(0 0 0 / 0.35);
  --shadow-tabbar: 0 8px 30px rgb(0 0 0 / 0.45);
}

/* Legacy success — отдельный зелёный позитивный цвет, не смешивать с warm. */
:root { --c-success: 34 197 94; }
[data-theme='warm'] { --c-success: 34 197 94; }
[data-theme='dark'] { --c-success: 32 213 176; }
```

Исправления, внесённые в блок Этапа 2:

1. **Warmテーマ текст:** `--c-t1` изменён с `255 255 255` на `12 12 20` (тёмный) — белый текст на светлой поверхности Mist `#E4E4EC` не обеспечивал WCAG AA 4.5:1. Белый текст теперь только на тёмных поверхностях (`--c-bg`, `--c-surface2`).
2. **Critical/danger foreground:** `--color-critical-fg` и `--color-danger-fg` заменены с белого на тёмные оттенки:
   - Light/Warm: `rgb(59 18 0)` (#3B1200) на оранжевом `#D97706`.
   - Dark: `rgb(26 26 31)` (#1A1A1F) на янтаре `#F4A62A`.
3. **Line token:** `--c-line: 255 255 255 / 0.1` заменён на `--c-line: 255 255 255` (только RGB-компоненты, прозрачность применяется Tailwind через `<alpha-value>`). Для Lightテーマ задан светло-серый `229 236 246` вместо белого.
4. **Полнота legacy-токенов:** все используемые в коде варианты определены — `--color-bg/surface/surface-sunken/ink/ink-muted/ink-subtle/primary/warm/critical/accent/success/warning/danger/border`, все `-fg` варианты (`success-fg`, `danger-fg`, `primary-fg`, `warning-fg`, `warm-fg`, `critical-fg`), `--color-chart/grace/grid`. Success остаётся зелёным (`#22C55E` / `#20D5B0`), не смешивается с warm.



### Этап 3. Tailwind (`client/tailwind.config.js`)
- `colors`: привязать к `rgb(var(--c-...) / <alpha-value>)`; добавить ключи `warm`, `critical`; сохранить `primary/surface/surface2/t1/t2/t3/line/warning/danger/success/accent` и `-fg`.
- `fontFamily.sans`: `-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif`.
- Оставить `keyframes`/`animation` без изменений.

### Этап 4. Базовые стили и компоненты (`client/src/index.css`)
- `.card`: `rounded-2xl bg-surface border border-line shadow-sm`; убрать двойные рамки.
- `.card-inner`: без `border-l-[3px]` и вложенных рамок (фон + отступы).
- `.btn-primary`: `bg-primary text-bg rounded-full font-bold active:scale-95 transition-transform shadow-lg shadow-primary/20`.
- `.tap`: `active:scale-[0.97]`.
- fade-in: `transition-opacity duration-300`; `prefers-reduced-motion` учитывать.

### Этап 5. FloatingNav (`client/src/components/FloatingNav.tsx`)
- `bg-surface/90 backdrop-blur-xl rounded-full`, активный таб — `primary`, safe-area отступы.
- Проверить Rules of Hooks: все хуки до любого раннего возврата.
- Логику навигации не менять.

### Этап 6. BottomSheet (`client/src/components/BottomSheet.tsx`)
- backdrop `backdrop-blur-xl`, панель `bg-surface`, `rounded-t-[20px]`, анимация sheet-up.
- **Проверка фактической реализации** (код BottomSheet.tsx):
  - Закрытие по Escape — строка 18-19 (`onKey` с `e.key === 'Escape'`). ✓ есть.
  - Закрытие по нажатию на backdrop — строка 57 (`onClick={onClose}` на backdrop-диве). ✓ есть.
  - Блокировка фоновой прокрутки — строка 22 (`document.body.style.overflow = 'hidden'`). ✓ есть частично.
  - Safe-area iOS — строка 65 (класс `safe-area-bottom`). ✓ есть.
- **Добавить недостающее:**
  1. `stopPropagation()` на внутренней панели (строки 59-72) — сейчас отсутствует; добавить `onClick={(e) => e.stopPropagation()}`, чтобы клик внутри панели не закрывал BottomSheet даже при изменении разметки.
  2. Сохранение и восстановление `document.body.style.overflow` — сейчас строка 25 сбрасывает в `''`, не возвращая предыдущее значение; сохранить изначальное overflow в ref и восстановить при закрытии/размонтировании.

### Этап 7. Переименование warning → warm (три места)
- `client/src/utils/format.ts`: `urgencyTone` возвращает `'danger' | 'warm' | 'muted'`.
  - **Порядок проверок:** сначала просрочка (`days <= 0` → `danger`), затем 4–7 дней до платежа (`days >= 4 && days <= 7` → `warm`), иначе → `muted`.
  - Просрочку проверять ПЕРВОЙ, чтобы отрицательные дни не попали в warm.
- `client/src/components/UpcomingPayments.tsx:108`: `tone === 'warning'` → `tone === 'warm'`.
- `client/src/components/CreditRow.tsx`: ключ `warning` в `TONE` → `warm`, классы `border-l-warm text-warm-fg bg-warm`.

### Этап 8. Главная и финансовые компоненты
- `DashboardPage`, `DebtOverview`: блок «Ускорь свободу» — акценты `primary`+`warm`, текст `text-t1`/`text-t2`.
- `GraceReplenishBlock`: `primary`/`warm` вместо `primary-soft`; сохранить идентичность грейса.
- `BalanceChart`/`DebtChart`: SVG stroke/fill `primary`/`warm`, сетка `line`, контраст во всех темах.
- `CreditRow`: новые цвета карточки, прогресс-бар, суммы `tabular-nums`, urgencyTone.
- `OverdueAlert`: `critical`.
- Всё без изменений расчётов/бизнес-логики.

### Этап 9. SettingsPage + SegmentedControl
- Новый файл `client/src/components/SegmentedControl.tsx` (iOS-стиль, 3 сегмента, выбранная тема выделена, доступность, мобильные экраны, существующий механизм смены темы).
- `SettingsPage.tsx`: плоский список секций с `border-b border-line` вместо аккордеон-матрешки; SegmentedControl вместо трёх круглых кнопок темы; заголовки `text-3xl font-bold tracking-tight`; подписи `text-xs uppercase tracking-widest text-t3`.
- Сохранить все существующие настройки и функции.

### Этап 10. Остальные компоненты
Точечно привести к новой системе: `MoneyFlow`, `PayoffStrategy`, `FreedomPage`, `AchievementsPage`, `BadgeUnlocked`, `CreditDetailPage`, `AddCreditPage`, `CsvImportPage`, `Layout`, `Skeleton`, `Toast`; семантика `primary/warm/critical/success/surface/surface2/line/text-t1/2/3`; денежные суммы — `tabular-nums`; интерактивные элементы — состояние нажатия.

### Этап 11. Валидация
- `npm --prefix client run typecheck` — без ошибок TS.
- `npm --prefix client run lint` — 0 предупреждений.
- `npm --prefix client run build` — проходит.
- `npm run test:visual` (Playwright e2e/visual-audit.spec.ts) — контраст ≥4.5:1, нет off-palette цветов, все три темы.
- `npm test` (server `test:finance`, 85/85) — подтверждает отсутствие регрессии бизнес-логики.
- Ручная проверка экранов: Главная, Настройки, карточки кредитов, детали, добавление, BottomSheet, FloatingNav, все три темы, мобильные размеры, переходы между экранами, сохранение/переключение тем.

## Финансовые тесты — базовый результат (до изменений)

Зафиксировано в `BLOCK1_AUDIT_CHECKPOINT.md`: `npm run test:finance` → 85/85 тестов прошли, 10 файлов. После редизайна повторить запуск и сравнить результаты. UI-редизайн не затрагивает серверную логику, регрессия не ожидается, но проверка обязательна.

## Файлы к изменению

1. `client/src/styles/tokens.css` — три палитры тем, новые переменные, legacy токены.
2. `client/tailwind.config.js` — семантические цвета, шрифт, warm/critical.
3. `client/src/index.css` — карточки, кнопки, tap, fade-in.
4. `client/src/components/FloatingNav.tsx` — цвета тап-бара, Rules of Hooks.
5. `client/src/components/BottomSheet.tsx` — backdrop-blur, поверхность, скругления, проверка Escape/backdrop/scroll-lock/safe-area.
6. `client/src/utils/format.ts` — urgencyTone warning→warm (исправленный порядок проверок).
7. `client/src/components/UpcomingPayments.tsx` — тон warning→warm.
8. `client/src/components/CreditRow.tsx` — TONE warning→warm, новые цвета карточки.
9. `client/src/pages/DashboardPage.tsx` — цвета дашборда.
10. `client/src/components/DebtOverview.tsx` — блок «Ускорь свободу», primary+warm.
11. `client/src/components/GraceReplenishBlock.tsx` — primary/warm акценты.
12. `client/src/components/BalanceChart.tsx` — SVG цвета.
13. `client/src/components/DebtChart.tsx` — SVG цвета.
14. `client/src/components/OverdueAlert.tsx` — critical.
15. `client/src/pages/SettingsPage.tsx` — плоский список, SegmentedControl, типографика.
16. `client/src/components/MoneyFlow.tsx` — новые токены.
17. `client/src/components/PayoffStrategy.tsx` — новые токены.
18. `client/src/pages/FreedomPage.tsx` — новые токены.
19. `client/src/pages/AchievementsPage.tsx` — новые токены.
20. `client/src/components/BadgeUnlocked.tsx` — новые токены.
21. `client/src/pages/CreditDetailPage.tsx` — новые токены.
22. `client/src/pages/AddCreditPage.tsx` — новые токены.
23. `client/src/pages/CsvImportPage.tsx` — новые токены.
24. `client/src/components/Layout.tsx` — новые токены.
25. `client/src/components/Skeleton.tsx` — новые токены.
26. `client/src/components/Toast.tsx` — новые токены.

## Новые файлы

1. `client/src/components/SegmentedControl.tsx` — iOS-стиль сегментированный переключатель тем для SettingsPage.

## Потенциальные конфликты и риски

- **Контраст на Warmテーマ:** поверхность Mist `#E4E4EC` (светлая) + белый текст `#FFFFFF` не обеспечат WCAG AA 4.5:1. На светлых поверхностях Warm использовать тёмный текст (не белый), белый текст — только на тёмных поверхностях (`#0C0C14`, `#44142C`, `#642444`). Утверждённые HEX-цвета не менять — подбирать role → цвет поверхности и role → цвет текста в tokens.css. Проверить контраст всех сочетаний текста и поверхностей во всех трёх темах (e2e `test:visual`).
- **Контраст на Light теме:** светлый фон + белый `text-t1` (#FFFFFF) даст нечитаемый текст; `text-t1` для light должен быть тёмным (вероятно #0B132B или близкое). Решается при подборе значений tokens.css.
- **Контраст на тёмных темах:** `text-t2`/`text-t3` на тёмных поверхностях могут уронить контраст ниже 4.5:1 — e2e аудит покажет; при необходимости скорректировать оттенки.
- **Legacy токены:** ~100 usages старых имён (`success`, `danger`, `warning`, `accent`, `-fg`) вне трёх renamed-мест. Переопределение значений не должно ломать разметку, но success≠warm нужно соблюдать строго.
- **Точные светлые значения bg/surface/surface2 для Light не заданы в ЕТЗ** — реализатор подбирает, сохраняя семантику палитры №1.
- **Rules of Hooks в FloatingNav:** нельзя размещать хуки после `return null`/раннего возврата.
- **SegmentedControl:** не оставлять импортов на несуществующие компоненты; создать файл до импорта в SettingsPage.
- Коммит/пуш/деплой НЕ выполняются этим планом — пользователь сделает вручную после приёма.

## Сохранность бизнес-логики

- Проверка: только CSS-классы, токены и Tailwind-конфиг меняются. Никаких изменений в `api/`, `store/`, хуках расчётов, маршрутах, авторизации, схеме Prisma, формах платежей/грейса/досрочки.
- Запуск `npm test` (server `test:finance`, 85/85 тестов) до и после редизайна — подтверждает отсутствие регрессии финансовых правил. Базовый результат 85/85 зафиксирован в BLOCK1_AUDIT_CHECKPOINT.md.
- Визуальный аудит Playwright не трогает данные.

## Проверка всех трёх тем

- Запуск e2e `test:visual` для тем `light`, `warm`, `dark` (уже параметризовано в `visual-audit.spec.ts`).
- Контраст ≥4.5:1 на каждой теме; отсутствие off-palette цветов (уже есть тест `no off-palette colours`).
- Ручная проверка переключения тем через SegmentedControl в Settings и сохранения в localStorage.
- Проверка на мобильных размерах (iOS Safari / Android Chrome, если доступны).

## Реальные команды в проекте

- Корень: `npm test` → `npm --prefix server run test:finance` (85/85 финансовых тестов).
- Корень: `npm run test:visual` → `playwright test e2e/visual-audit.spec.ts`.
- Корень: `npm run test:e2e` → `playwright test`.
- `client`: `npm run dev` (vite), `npm run build` (tsc --noEmit && vite build), `npm run preview`, `npm run typecheck` (tsc --noEmit), `npm run lint` (eslint).
- Mutating (только пользователь): `git add -A && git commit -m "..." && git push`.

## Открытые вопросы (решаются при реализации, не блокируют старт)

1. Точные светлые hex-значения `--bg`/`--surface`/`--surface2` для темы `light` (палитра №1) — подбираются реализатором, сохраняя светлый характер темы.
2. Точные значения legacy `--c-success/--c-danger/--c-warning/--c-accent` в новой палитре (success остаётся зелёным; danger/critical — оранжевый; warning — тёплый) — предлагает реализатор, утверждается по контрасту.
3. После приёма плана пользователь выполняет `git add -A && git commit -m "feat(ui): глобальный редизайн — премиум палитра iOS+Telegram" && git push` и деплой через Render (DEPLOY.md) вручную.

План готов к рассмотрению.
