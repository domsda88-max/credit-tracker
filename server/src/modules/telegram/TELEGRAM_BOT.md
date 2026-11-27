# Telegram Bot MVP

The Telegram bot runs inside the existing Express backend and uses the existing Prisma database and finance services. It does not create a separate database or duplicate debt/payment calculations.

## Enable locally

1. Create a new bot with @BotFather in Telegram.
2. Copy its token into server/.env as TELEGRAM_BOT_TOKEN=... . Do not commit or send the token in chat.
3. Start the backend with npm run dev from server/.
4. Open the bot and send /start.

When TELEGRAM_BOT_TOKEN is absent, the API starts without starting Telegram polling.

## MVP commands

- /start — create or open the Telegram-first profile.
- /menu — show the main menu.
- /summary — overview.
- /debts — active debts.
- /payments — payments scheduled in the current calendar month.
- /add — guided creation of a debt.
- /cancel — cancel the current add-debt wizard.

The payments screen keeps grace-period replenishments separate from monthly obligations. Confirming a scheduled payment calls the existing paymentsService.payInstallment; renewing a frozen card cycle calls creditsService.renewFreezeCycle.

## First-version limitations

- Long polling requires exactly one running process per bot token. Do not run the same token locally and on the hosted backend at the same time.
- Telegram-only profiles use a reserved .invalid email and a randomly generated password hash to fit the existing required User.email and User.passwordHash fields without a database migration. Those credentials are not shown to the user.
- Linking a Telegram-only profile to an existing website account and logging into the PWA through Telegram are not implemented in this MVP yet. Until that phase is completed, a new Telegram user gets a new, separate profile.
- The bot token is a secret. Store it only in local environment variables or the hosting provider's secret environment settings.
- This MVP uses polling, not a public webhook. Do not enable a webhook for the same bot token while polling is active.
