# Credit Tracker

PWA для отслеживания кредитных задолженностей и push-напоминаний о платежах.

- `server/` — Express + TypeScript + Prisma + PostgreSQL + Web Push + node-cron
- `client/` — React + TypeScript + Vite + TailwindCSS + PWA (Service Worker)

## Быстрый старт

```bash
# 1. База данных
docker compose up -d

# 2. Бэкенд
cd server
npm install
cp .env.example .env
npm run vapid:gen        # ключи → скопировать в .env
npm run prisma:migrate
npm run dev              # http://localhost:4000

# 3. Фронтенд (во втором терминале)
cd client
npm install
npm run dev              # http://localhost:5173
```

В dev фронтенд проксирует `/api` на `localhost:4000` — CORS настраивать не нужно.

## Проверки

```bash
cd server && npm run test:finance   # 15 тестов финансового ядра
cd server && npx tsc --noEmit       # типы бэкенда
cd client && npm run typecheck      # типы фронтенда
cd client && npm run build          # сборка PWA + Service Worker
```

## Как это работает

1. Пользователь регистрируется (email/пароль → JWT) и добавляет кредит.
2. Бэкенд строит график платежей: аннуитет, дифференциал или кредитку
   с льготным периодом; отдельно поддерживается «снежинка» 🧊 (цикл заморозки)
   и досрочное погашение с пересчётом (сокращение срока / уменьшение платежа).
3. Кнопка «Я оплатил» сдвигает график, обновляет остаток и при пересечении
   25/50/75/100% отправляет мотивационный push.
4. Cron каждый час проверяет, у кого локально 10:00, и отправляет **один**
   сводный дайджест: просрочка / сегодня / завтра + список банков и общая сумма.
   Дубли исключены уникальным `NotificationLog.dedupKey`.

## Карта API

| Метод | Путь | Назначение |
| --- | --- | --- |
| POST | `/api/auth/register` | Регистрация (email/пароль) → JWT |
| POST | `/api/auth/login` | Вход → JWT |
| GET | `/api/auth/me` | Текущий пользователь |
| GET | `/api/credits` | Список кредитов + ближайший платёж |
| POST | `/api/credits` | Создать кредит → график генерируется автоматически |
| GET | `/api/credits/:id` | Карточка: график + журнал платежей |
| PUT | `/api/credits/:id` | Обновить (при смене условий график пересобирается) |
| POST | `/api/credits/:id/freeze` | Переключить «снежинку» 🧊 (цикл заморозки) |
| DELETE | `/api/credits/:id` | Удалить кредит |
| POST | `/api/payments/installments/:id/pay` | «Я оплатил» |
| POST | `/api/payments/credits/:id/early-repayment` | Досрочное погашение + пересчёт |
| GET | `/api/push/vapid-public-key` | Публичный VAPID-ключ |
| POST | `/api/push/subscribe` | Сохранить push-подписку |
| DELETE | `/api/push/subscribe` | Удалить push-подписку |

## Архитектура

```
routes → controller → service → prisma / utils/finance
```

- `src/utils/finance/*` — чистая математика (аннуитет, дифференциал, кредитка с льготным
  периодом, досрочка, milestone-отметки). Покрыта тестами, не знает про HTTP и БД.
- `src/modules/*` — вертикальные модули (auth, credits, payments, push): свой роут,
  контроллер, сервис, схемы валидации.
- `src/cron/jobs/reminder.job.ts` — ежечасный запуск; пуш уходит только пользователям,
  у кого локально 10:00. Один сводный дайджест на день (просрочка + сегодня + завтра,
  общая сумма и список банков) + предупреждения о конце цикла заморозки.
- Идемпотентность пушей — уникальный `NotificationLog.dedupKey`
  (`{userId}:DIGEST:{дата}`), защищает от дублей при рестарте.

### Структура клиента

```
client/src/
├── api/           # axios-инстанс + модули (auth, credits, payments, push)
├── components/    # Layout, ProtectedRoute, CreditRow, SummaryCards, PushSettings
├── hooks/         # usePushNotifications (разрешение → подписка → бэкенд)
├── pages/         # Login, Register, Dashboard, AddCredit, CreditDetail
├── store/         # zustand + persist (JWT/пользователь)
├── utils/         # форматирование сумм/дат, base64 → Uint8Array
├── types/         # общие типы, зеркалят DTO бэкенда
└── sw.ts          # Service Worker: precache + push + notificationclick
```
