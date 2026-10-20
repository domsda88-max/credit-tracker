# Деплой Credit Tracker (Render + Supabase)

Актуально на 21.10.2026. **Один сервис на Render**: Express раздаёт и API (`/api/*`), и собранный клиент (React-PWA) с того же домена. Отдельного Static Site нет — нет CORS, нет `VITE_API_URL`, нет SPA-реврайтов.

- **Публичный адрес:** https://credit-tracker-api.onrender.com
- **Сервис:** `credit-tracker-api` (`srv-dbbv4j5pkucs73bpips0`), Node, free, region oregon
- **Health-check:** `/api/health`
- **БД:** Supabase, проект SOBP (`ycxoqwjvtjydiyvhvmaa`) через **session pooler** (IPv4)

## Как устроена сборка

```
rootDir: server
buildCommand: npm ci --include=dev && npx prisma generate && npx prisma migrate deploy \
              && npm run build && cd ../client && npm ci --include=dev && npm run build
startCommand: npm start          # node dist/index.js
```

- `cd ../client` работает, потому что Render клонирует весь репозиторий.
- `npm run build` клиента кладёт статику в `client/dist`; Express отдаёт её и делает SPA-фолбэк на `index.html` (`server/src/app.ts`).
- Миграции применяются **автоматически при каждом деплое** (`prisma migrate deploy`).

## Переменные окружения (Render → Environment)

| Ключ | Значение |
|---|---|
| `NODE_VERSION` | `20` |
| `NODE_ENV` | `production` |
| `DATABASE_URL` | `postgresql://postgres.ycxoqwjvtjydiyvhvmaa:<пароль>@aws-0-eu-west-1.pooler.supabase.com:5432/postgres` |
| `DIRECT_URL` | то же самое (см. подводные камни) |
| `JWT_SECRET` | случайные 48 hex |
| `JWT_EXPIRES_IN` | `7d` |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | из `render-secrets.txt` |
| `CLIENT_ORIGIN` | `https://credit-tracker-api.onrender.com` |

Менять переменные — только через API: `PUT /v1/services/{id}/env-vars/{KEY}` с телом `{"value": "..."}` (PATCH не поддерживается, при создании сервиса `envVars` игнорируются).

## Подводные камни (проверено на практике)

1. **Прямой хост Supabase IPv6-only.** `db.<ref>.supabase.co` имеет только AAAA-запись; на IPv4-окружениях Prisma падает с `P1001`/`P1002`. Поэтому и `DATABASE_URL`, и `DIRECT_URL` указывают на пулер.
2. **`NODE_ENV=production` отрезает devDependencies** при `npm ci`. Без `--include=dev` не будет `typescript`, `prisma`, `vite` → падения сборки (`TS5108` и т.п.).
3. **Free-инстанс засыпает через ~15 минут простоя**, cold start ~50 с. Для cron-напоминаний о платежах сервис должен быть разбужен: UptimeRobot пингует `/api/health` каждые 5–10 минут (730 ч/мес < лимита 750 ч).
4. **Service worker** кэширует только статику (workbox precache), API не кэшируется. После деплоя PWA обновляется сама (`registerType: 'autoUpdate'`), иногда нужно закрыть/открыть приложение дважды.

## Локальная разработка

```powershell
# БД
& "C:\Users\pupup\pgsql\pgsql\bin\pg_ctl.exe" start -D "C:\Users\pupup\pgsql\data" -l "C:\Users\pupup\pgsql\postgres.log" -w
# backend :4000
cd server; npm run dev
# frontend :5173 (проксирует /api на :4000)
cd client; npm run dev
```

`server/.env` для локалки указывает на `127.0.0.1:5432/credit_tracker`.
