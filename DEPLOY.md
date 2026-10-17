# Деплой в облаке (Render + Supabase)

Публичная установка приложения: React-PWA на Render Static Site, Express API на Render Web Service,
PostgreSQL в Supabase. Код хранится в этом публичном репозитории.

> ⚠️ В этом репозитории **нет** секретов. `.env` входит в `.gitignore`.
> Все пароли/ключи живут в Render → Environment и в локальном файле вне репозитория.

---

## 1. База данных (Supabase)

1. Создайте проект на <https://supabase.com> (бесплатный тариф, регион **eu-west-1**).
2. **Project Settings → Database → Reset database password** — задайте пароль и запишите его.
   Пароль в панели посмотреть нельзя, только сбросить.
3. **Connect → ORM → Prisma** — там две готовые строки:

| Переменная | Что это | Порт |
|---|---|---|
| `DATABASE_URL` | **Session pooler** (работа приложения) | `5432` |
| `DIRECT_URL` | прямое подключение / миграции | `5432` |

> Для Prisma из браузера Supabase предлагает транзакционный пулер на `6543` с `?pgbouncer=true`.
> Так тоже можно — значение `DATABASE_URL` допустимо и такое.

4. Применение схемы (один раз, локально):

```bash
cd server
npx prisma migrate deploy
```

На медленных/перебоистых сетях `migrate deploy` может упасть с `P1002` (advisory lock timeout).
Решение — применить SQL по одному оператору за соединение (см. `prisma/migrations/*/migration.sql`)
и вручную вставить строку в `_prisma_migrations`. После этого последующие `migrate deploy` — no-op.

---

## 2. GitHub

Репозиторий публичный: `github.com/domsda88-max/credit-tracker`.

```bash
git add -A
git commit -m "change"
git push
```

Render пересобирает сервисы автоматически при каждом push в `main`.

---

## 3. Render

1. Зарегистрируйтесь: <https://render.com> → **Sign up with GitHub** (бесплатно).
2. Dashboard → **New + → Blueprint** → подключите репозиторий `credit-tracker`
   (или просто создайте два сервиса вручную).
3. `render.yaml` в корне уже описывает оба сервиса:

| Сервис | Тип | Root dir | Build | Start |
|---|---|---|---|---|
| `credit-tracker-api` | Web Service | `server` | `npm ci && npx prisma generate && npx prisma migrate deploy && npm run build` | `npm start` |
| `credit-tracker-client` | Static Site | `client` | `npm ci && npm run build` | — (публикуется `dist/`) |

4. Заполните переменные окружения (Dashboard → сервис → **Environment**):

| Переменная | Сервис | Откуда взять |
|---|---|---|
| `DATABASE_URL` | api | Supabase → Connect → ORM → `DATABASE_URL` |
| `DIRECT_URL` | api | Supabase → Connect → ORM → `DIRECT_URL` |
| `JWT_SECRET` | api | Render генерирует сам (`generateValue: true`) |
| `JWT_EXPIRES_IN` | api | `7d` |
| `VAPID_PUBLIC_KEY` | api | `npm run vapid:gen` в `server/` |
| `VAPID_PRIVATE_KEY` | api | `npm run vapid:gen` в `server/` |
| `VAPID_SUBJECT` | api | `mailto:<ваша почта>` |
| `CLIENT_ORIGIN` | api | `https://<client>.onrender.com` |
| `VITE_API_URL` | client | `https://<api>.onrender.com` (без `/api`) |
| `NODE_VERSION` | api | `20` |

> `VITE_API_URL` подставляется в бандл **на этапе сборки** — меняете переменную → нажимаете
> **Manual Deploy → Clear build cache & deploy**.

5. После первого деплоя откройте `<client>.onrender.com` — должен открыться экран входа.

---

## 4. Проверка продакшена

1. Регистрация нового пользователя на `https://<client>.onrender.com`.
2. Добавить кредит → убедиться, что график платежей посчитался.
3. Оплатить платёж → остаток изменился.
4. Раннее погашение → пересчёт графика.
5. Разрешить уведомления → подписка ушла в БД (`PushSubscription`).

---

## 5. Особенности бесплатного тарифа

- **Render Free** засыпает после ~15 мин простоя → первый запрос после простоя ждёт ~50 с
  (холодный старт). Включите **Always On** (платно) или держите трафик постоянным.
- **Supabase Free** ставит проект в паузу после 7 дней простоя → пробуждение тоже долгое.
- Render Free: 512 MB RAM, 90 дней работы сервиса подряд — потом нужен редеплой.
- Push-уведомления: подписки хранятся в `PushSubscription`, они переживут перезапуски.
  `node-cron` запускается при старте процесса API — после сна сервиса задачи выполняются заново.

---

## 6. Если что-то пошло не так

| Симптом | Что смотреть |
|---|---|
| `P1001/P1002` на билде | доступность Supabase из сети Render, корректность `DATABASE_URL` |
| Пустой экран на клиенте | `VITE_API_URL` указан без `/api` и со схемой `https://` |
| CORS-ошибка в консоли | `CLIENT_ORIGIN` должен совпадать с хостом клиента, включая `https://` |
| 401 на всех запросах | время суток/часы на сервере, `JWT_SECRET` установлен |
| Уведомления не приходят | `VAPID_*` установлены, разрешения браузера, `VAPID_SUBJECT` корректен |
| Ошибка при первом запросе после простоя | это холодный старт — подождите ~50 с |

---

## 7. Безопасность

- Отзыв временного GitHub-токена: Settings → Developer settings → Personal access tokens → Delete.
- Смена пароля БД: Supabase → Project Settings → Database → Reset database password
  (не забудьте обновить `DATABASE_URL`/`DIRECT_URL` в Render).
- Все секреты в репозиторий не попадают: проверьте `git ls-files | grep -i env`.
