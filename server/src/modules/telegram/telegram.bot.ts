import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { prisma } from '../../config/prisma';
import { creditsService } from '../credits/credits.service';
import { createCreditSchema } from '../credits/credits.schemas';
import { paymentsService } from '../payments/payments.service';
import {
  TelegramApi,
  type InlineKeyboardMarkup,
  type TelegramCallbackQuery,
  type TelegramMessage,
  type TelegramUpdate,
  type TelegramUser,
} from './telegram.api';
import {
  creditTypeLabel,
  escapeHtml,
  formatDate,
  formatMoney,
  parseIntegerInRange,
  parseNonNegativeNumber,
  parsePositiveNumber,
} from './telegram.format';

type DebtType = 'CREDIT_CARD' | 'CONSUMER' | 'MORTGAGE' | 'INSTALLMENT' | 'MICROLOAN' | 'LOAN';
type WizardStep =
  | 'name'
  | 'balance'
  | 'rate'
  | 'termMonths'
  | 'termDays'
  | 'paymentDay'
  | 'paymentType'
  | 'graceSum'
  | 'freezeDays';

interface AddDebtWizard {
  type: DebtType;
  step: WizardStep;
  name?: string;
  principal?: number;
  annualRate?: number;
  termMonths?: number;
  termDays?: number;
  paymentDay?: number;
  paymentType?: 'ANNUITY' | 'DIFFERENTIAL';
  graceReplenishSum?: number;
  freezeCycleDays?: number;
}

const wizards = new Map<number, AddDebtWizard>();
const incomePendingChats = new Set<number>();

function mainMenu(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: '📊 Обзор', callback_data: 'menu:summary' },
        { text: '💳 Мои долги', callback_data: 'menu:debts' },
      ],
      [{ text: '📅 Платежи этого месяца', callback_data: 'menu:payments' }],
      [{ text: '➕ Добавить долг', callback_data: 'menu:add' }],
      [{ text: '💰 Указать месячный доход', callback_data: 'menu:income' }],
    ],
  };
}

function debtTypeMenu(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: 'Потребительский', callback_data: 'addtype:CONSUMER' },
        { text: 'Ипотека', callback_data: 'addtype:MORTGAGE' },
      ],
      [
        { text: 'Кредитная карта', callback_data: 'addtype:CREDIT_CARD' },
        { text: 'Рассрочка', callback_data: 'addtype:INSTALLMENT' },
      ],
      [
        { text: 'Микрозайм', callback_data: 'addtype:MICROLOAN' },
        { text: 'Другой долг', callback_data: 'addtype:LOAN' },
      ],
    ],
  };
}

function paymentTypeMenu(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [[
      { text: 'Аннуитетный', callback_data: 'addpayment:ANNUITY' },
      { text: 'Дифференцированный', callback_data: 'addpayment:DIFFERENTIAL' },
    ]],
  };
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function telegramDisplayName(user: TelegramUser): string {
  return [user.first_name, user.last_name].filter(Boolean).join(' ').trim() || 'Пользователь Telegram';
}

/**
 * Telegram-first profile without a schema migration:
 * the immutable Telegram numeric ID maps to a reserved .invalid email.
 * The generated password is intentionally not known or exposed to the user.
 */
async function getOrCreateTelegramUser(telegramUser: TelegramUser): Promise<{ id: string }> {
  const email = 'telegram-' + telegramUser.id + '@users.credit-tracker.invalid';
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) return existing;

  const passwordHash = await bcrypt.hash(randomBytes(32).toString('hex'), 10);
  try {
    const created = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name: telegramDisplayName(telegramUser),
        timezone: 'Europe/Moscow',
      },
      select: { id: true },
    });
    return created;
  } catch (error) {
    // Parallel /start updates can race on the existing unique email.
    if ((error as { code?: string })?.code === 'P2002') {
      const raced = await prisma.user.findUnique({ where: { email }, select: { id: true } });
      if (raced) return raced;
    }
    throw error;
  }
}

async function send(api: TelegramApi, chatId: number, text: string, keyboard?: InlineKeyboardMarkup) {
  await api.sendMessage(chatId, text, keyboard);
}

async function showSummary(api: TelegramApi, chatId: number, userId: string): Promise<void> {
  const summary = await creditsService.summary(userId);
  const text = [
    '<b>📊 Твой финансовый обзор</b>',
    '',
    'Активных долгов: <b>' + summary.activeCount + '</b>',
    'Общий остаток: <b>' + formatMoney(summary.outstandingSum) + '</b>',
    'Платежи в этом месяце: <b>' + formatMoney(summary.monthlyPayments) + '</b>',
    'Доход: <b>' + (summary.monthlyIncome === null ? 'не указан' : formatMoney(summary.monthlyIncome)) + '</b>',
    'Свободно: <b>' + (summary.freeMoney === null ? 'не рассчитано' : formatMoney(summary.freeMoney)) + '</b>',
    'Резерв грейса (отдельно): <b>' + formatMoney(summary.graceReplenishTotal) + '</b>',
    'Ориентир закрытия: <b>' + formatDate(summary.debtFreeDate) + '</b>',
  ].join('\n');
  await send(api, chatId, text, mainMenu());
}

async function showDebts(api: TelegramApi, chatId: number, userId: string): Promise<void> {
  const credits = await creditsService.list(userId);
  const active = credits.filter((credit) => credit.status === 'ACTIVE');
  if (!active.length) {
    await send(api, chatId, 'Пока нет активных долгов. Нажми «Добавить долг», чтобы создать первый.', mainMenu());
    return;
  }

  const rows = active.slice(0, 30).map((credit, index) => {
    const next = credit.nextPayment;
    const nextLine = next
      ? '\n   Следующий платёж: ' + formatMoney(Number(next.amount) - Number(next.paidAmount ?? 0)) +
        ' · ' + formatDate(next.dueDate)
      : credit.frozen && credit.graceReplenishSum
        ? '\n   Грейс: ' + formatMoney(credit.graceReplenishSum) +
          ' · ' + formatDate(credit.nextFreezeCheckAt)
        : '';
    return (
      '<b>' + (index + 1) + '. ' + escapeHtml(credit.name) + '</b>' +
      '\n   ' + creditTypeLabel(credit.type) +
      '\n   Остаток: <b>' + formatMoney(credit.outstanding) + '</b>' +
      nextLine
    );
  });

  await send(api, chatId, '<b>💳 Активные долги</b>\n\n' + rows.join('\n\n'), mainMenu());
}

function currentUtcMonth(): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { start, end };
}

function utcToday(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

async function showPayments(api: TelegramApi, chatId: number, userId: string): Promise<void> {
  const { start, end } = currentUtcMonth();
  const installments = await prisma.paymentSchedule.findMany({
    where: {
      dueDate: { gte: start, lt: end },
      status: { in: ['PENDING', 'PARTIALLY_PAID'] },
      credit: { userId, status: 'ACTIVE' },
    },
    include: {
      credit: {
        select: { name: true, type: true, graceReplenishSum: true },
      },
    },
    orderBy: [{ dueDate: 'asc' }, { credit: { name: 'asc' } }],
    take: 50,
  });

  // Grace replenishments are presented separately and never counted as obligations.
  const regular = installments.filter((item) => {
    if (item.credit.type !== 'CREDIT_CARD' || item.credit.graceReplenishSum === null) return true;
    return Number(item.interestPart) !== 0 || Number(item.amount) !== Number(item.credit.graceReplenishSum);
  });

  const graceCredits = await prisma.credit.findMany({
    where: {
      userId,
      status: 'ACTIVE',
      frozen: true,
      graceReplenishSum: { gt: 0 },
      nextFreezeCheckAt: { gte: start, lt: end },
    },
    select: { id: true, name: true, graceReplenishSum: true, nextFreezeCheckAt: true },
    orderBy: { nextFreezeCheckAt: 'asc' },
  });

  const lines = regular.map((item) => {
    const remaining = Math.max(0, Number(item.amount) - Number(item.paidAmount ?? 0));
    return (
      '<b>' + escapeHtml(item.credit.name) + '</b>' +
      '\n   ' + formatMoney(remaining) + ' · до ' + formatDate(item.dueDate)
    );
  });

  const keyboard: InlineKeyboardMarkup = {
    inline_keyboard: regular.slice(0, 20).map((item) => [{
      text: 'Оплатил: ' + item.credit.name.slice(0, 28),
      callback_data: 'pay:' + item.id,
    }]),
  };

  const graceReady = graceCredits.filter(
    (credit) => credit.nextFreezeCheckAt !== null && credit.nextFreezeCheckAt <= utcToday(),
  );
  const graceLines = graceCredits.map((credit) => (
    '🧊 <b>' + escapeHtml(credit.name) + '</b> — ' +
    formatMoney(credit.graceReplenishSum) + ' · до ' + formatDate(credit.nextFreezeCheckAt)
  ));

  const text = [
    '<b>📅 Платежи текущего месяца</b>',
    '',
    lines.length ? lines.join('\n\n') : 'Платежей по графику в этом месяце нет.',
    graceLines.length ? '\n\n<b>Обновление грейс-периода — отдельно от обязательств:</b>\n' + graceLines.join('\n') : '',
  ].join('\n');

  keyboard.inline_keyboard.push(...graceReady.slice(0, 10).map((credit) => [{
    text: 'Обновить грейс: ' + credit.name.slice(0, 22),
    callback_data: 'grace:' + credit.id,
  }]));
  keyboard.inline_keyboard.push([{ text: '↻ Обновить список', callback_data: 'menu:payments' }]);

  await send(api, chatId, text, keyboard);
}

async function startAddWizard(api: TelegramApi, chatId: number): Promise<void> {
  await send(api, chatId, 'Какой долг добавим?', debtTypeMenu());
}

function wizardPrompt(wizard: AddDebtWizard): string {
  switch (wizard.step) {
    case 'name':
      return 'Напиши название долга или банка';
    case 'balance':
      return 'Укажи текущий остаток долга в рублях. Для стартового расчёта он также станет первоначальной суммой';
    case 'rate':
      return 'Укажи годовую ставку в процентах. Например: 24,9';
    case 'termMonths':
      return 'Укажи оставшийся срок в месяцах';
    case 'termDays':
      return 'Укажи срок в днях';
    case 'paymentDay':
      return 'Укажи день платежа месяца (1–31)';
    case 'graceSum':
      return 'Укажи сумму пополнения для обновления льготного периода';
    case 'freezeDays':
      return 'Через сколько дней повторяется цикл грейса? Например: 30';
    case 'paymentType':
      return 'Выбери тип платежа на кнопках ниже';
  }
}

async function finishAddWizard(
  api: TelegramApi,
  chatId: number,
  userId: string,
  wizard: AddDebtWizard,
): Promise<void> {
  const common = {
    name: wizard.name,
    type: wizard.type,
    principal: wizard.principal,
    outstanding: wizard.principal,
    startDate: new Date(),
  };

  let input: Record<string, unknown>;
  switch (wizard.type) {
    case 'LOAN':
      input = { ...common };
      break;
    case 'CONSUMER':
    case 'MORTGAGE':
      input = {
        ...common,
        annualRate: wizard.annualRate,
        termMonths: wizard.termMonths,
        paymentDay: wizard.paymentDay,
        paymentType: wizard.paymentType,
        prepaymentMode: 'REDUCE_TERM',
      };
      break;
    case 'INSTALLMENT':
      input = {
        ...common,
        annualRate: 0,
        termDays: wizard.termDays,
        paymentDay: wizard.paymentDay,
        paymentType: 'ANNUITY',
        prepaymentMode: 'REDUCE_TERM',
      };
      break;
    case 'MICROLOAN':
      input = {
        ...common,
        annualRate: wizard.annualRate,
        termDays: wizard.termDays,
        paymentDay: wizard.paymentDay,
        paymentType: 'ANNUITY',
        prepaymentMode: 'REDUCE_TERM',
      };
      break;
    case 'CREDIT_CARD':
      input = {
        ...common,
        annualRate: wizard.annualRate,
        termMonths: 0,
        paymentDay: wizard.paymentDay,
        paymentType: 'MIN_PAYMENT',
        minPayment: 0,
        graceReplenishSum: wizard.graceReplenishSum,
        graceReplenishDay: wizard.paymentDay,
        frozen: true,
        freezeCycleDays: wizard.freezeCycleDays,
        prepaymentMode: 'REDUCE_TERM',
      };
      break;
  }

  const parsed = createCreditSchema.safeParse(input);
  if (!parsed.success) {
    wizards.delete(chatId);
    const issue = parsed.error.issues[0]?.message ?? 'Проверь введённые параметры';
    await send(api, chatId, 'Не удалось создать долг: ' + escapeHtml(issue) + '. Начни заново командой /add.', mainMenu());
    return;
  }

  const credit = await creditsService.create(userId, parsed.data);
  wizards.delete(chatId);
  await send(
    api,
    chatId,
    '✅ <b>Долг добавлен</b>\n' +
      escapeHtml(credit.name) + '\n' +
      'Текущий остаток: <b>' + formatMoney(credit.outstanding) + '</b>\n\n' +
      'Он появился в общем списке долгов.',
    mainMenu(),
  );
}

async function handleWizardText(
  api: TelegramApi,
  chatId: number,
  userId: string,
  text: string,
): Promise<boolean> {
  const wizard = wizards.get(chatId);
  if (!wizard) return false;

  if (wizard.step === 'name') {
    const name = text.trim();
    if (!name || name.length > 100) {
      await send(api, chatId, 'Название должно содержать от 1 до 100 символов. Попробуй ещё раз.');
      return true;
    }
    wizard.name = name;
    wizard.step = 'balance';
  } else if (wizard.step === 'balance') {
    const amount = parsePositiveNumber(text);
    if (amount === null || amount > 1_000_000_000) {
      await send(api, chatId, 'Введи положительную сумму, например 125000 или 125 000,50.');
      return true;
    }
    wizard.principal = amount;

    if (wizard.type === 'LOAN') {
      await finishAddWizard(api, chatId, userId, wizard);
      return true;
    }
    if (wizard.type === 'INSTALLMENT') {
      wizard.step = 'termDays';
    } else {
      wizard.step = 'rate';
    }
  } else if (wizard.step === 'rate') {
    const rate = parseNonNegativeNumber(text);
    if (rate === null || rate > 100) {
      await send(api, chatId, 'Введи ставку от 0 до 100%.');
      return true;
    }
    wizard.annualRate = rate;
    wizard.step = wizard.type === 'CREDIT_CARD'
      ? 'graceSum'
      : wizard.type === 'MICROLOAN'
        ? 'termDays'
        : 'termMonths';
  } else if (wizard.step === 'termMonths') {
    const term = parseIntegerInRange(text, 1, 600);
    if (term === null) {
      await send(api, chatId, 'Срок должен быть целым числом от 1 до 600 месяцев.');
      return true;
    }
    wizard.termMonths = term;
    wizard.step = 'paymentDay';
  } else if (wizard.step === 'termDays') {
    const term = parseIntegerInRange(text, 1, 365);
    if (term === null) {
      await send(api, chatId, 'Срок должен быть целым числом от 1 до 365 дней.');
      return true;
    }
    wizard.termDays = term;
    wizard.step = 'paymentDay';
  } else if (wizard.step === 'graceSum') {
    const amount = parsePositiveNumber(text);
    if (amount === null || amount > wizard.principal!) {
      await send(api, chatId, 'Сумма грейса должна быть больше нуля и не превышать остаток долга.');
      return true;
    }
    wizard.graceReplenishSum = amount;
    wizard.step = 'paymentDay';
  } else if (wizard.step === 'paymentDay') {
    const day = parseIntegerInRange(text, 1, 31);
    if (day === null) {
      await send(api, chatId, 'Укажи целый день месяца от 1 до 31.');
      return true;
    }
    wizard.paymentDay = day;
    if (wizard.type === 'CREDIT_CARD') {
      wizard.step = 'freezeDays';
    } else if (wizard.type === 'CONSUMER' || wizard.type === 'MORTGAGE') {
      wizard.step = 'paymentType';
      await send(api, chatId, wizardPrompt(wizard), paymentTypeMenu());
      return true;
    } else {
      await finishAddWizard(api, chatId, userId, wizard);
      return true;
    }
  } else if (wizard.step === 'freezeDays') {
    const days = parseIntegerInRange(text, 1, 365);
    if (days === null) {
      await send(api, chatId, 'Укажи целое число от 1 до 365 дней.');
      return true;
    }
    wizard.freezeCycleDays = days;
    await finishAddWizard(api, chatId, userId, wizard);
    return true;
  }

  await send(api, chatId, wizardPrompt(wizard));
  return true;
}

async function handleCallback(
  api: TelegramApi,
  callback: TelegramCallbackQuery,
): Promise<void> {
  const chatId = callback.message?.chat.id;
  if (!chatId) {
    await api.answerCallbackQuery(callback.id, 'Не удалось определить чат');
    return;
  }
  if (callback.message?.chat.type !== 'private') {
    await api.answerCallbackQuery(callback.id, 'Финансовые данные доступны только в личном чате с ботом');
    return;
  }

  const user = await getOrCreateTelegramUser(callback.from);
  const data = callback.data ?? '';

  if (data.startsWith('menu:')) {
    await api.answerCallbackQuery(callback.id);
    const action = data.slice(5);
    if (action === 'summary') return showSummary(api, chatId, user.id);
    if (action === 'debts') return showDebts(api, chatId, user.id);
    if (action === 'payments') return showPayments(api, chatId, user.id);
    if (action === 'add') return startAddWizard(api, chatId);
    if (action === 'income') {
      incomePendingChats.add(chatId);
      return send(api, chatId, 'Укажи ежемесячный доход на руки в рублях. Например: 150000. Его можно будет изменить командой /income.');
    }
    return send(api, chatId, 'Неизвестное действие', mainMenu());
  }

  if (data.startsWith('addtype:')) {
    const type = data.slice(8) as DebtType;
    const allowed: DebtType[] = ['CREDIT_CARD', 'CONSUMER', 'MORTGAGE', 'INSTALLMENT', 'MICROLOAN', 'LOAN'];
    if (!allowed.includes(type)) {
      await api.answerCallbackQuery(callback.id, 'Неизвестный тип долга');
      return;
    }
    wizards.set(chatId, { type, step: 'name' });
    await api.answerCallbackQuery(callback.id);
    await send(api, chatId, wizardPrompt(wizards.get(chatId)!));
    return;
  }

  if (data.startsWith('addpayment:')) {
    const wizard = wizards.get(chatId);
    const type = data.slice(11);
    if (!wizard || wizard.step !== 'paymentType' || (type !== 'ANNUITY' && type !== 'DIFFERENTIAL')) {
      await api.answerCallbackQuery(callback.id, 'Шаг добавления уже завершён');
      return;
    }
    wizard.paymentType = type;
    await api.answerCallbackQuery(callback.id);
    await finishAddWizard(api, chatId, user.id, wizard);
    return;
  }

  if (data.startsWith('pay:')) {
    const installmentId = data.slice(4);
    await api.answerCallbackQuery(callback.id, 'Записываю оплату…');
    const installment = await prisma.paymentSchedule.findFirst({
      where: { id: installmentId, credit: { userId: user.id } },
      select: { amount: true, paidAmount: true, credit: { select: { name: true } } },
    });
    if (!installment) {
      await send(api, chatId, 'Платёж не найден или уже недоступен.', mainMenu());
      return;
    }
    const remaining = Math.max(0, Number(installment.amount) - Number(installment.paidAmount ?? 0));
    if (remaining <= 0) {
      await send(api, chatId, 'Этот платёж уже полностью внесён.', mainMenu());
      return;
    }
    await paymentsService.payInstallment(
      user.id,
      installmentId,
      { amount: remaining },
      'telegram:' + callback.id,
    );
    await send(
      api,
      chatId,
      '✅ Оплата записана: <b>' + escapeHtml(installment.credit.name) + '</b>\n' +
        formatMoney(remaining) + '\n\nИстория и остаток долга обновлены.',
      mainMenu(),
    );
    return;
  }

  if (data.startsWith('grace:')) {
    const creditId = data.slice(6);
    await api.answerCallbackQuery(callback.id, 'Обновляю льготный период…');
    const credit = await creditsService.renewFreezeCycle(user.id, creditId);
    await send(
      api,
      chatId,
      '🧊 Цикл льготного периода обновлён: <b>' + escapeHtml(credit?.name ?? 'Кредитная карта') + '</b>\n' +
        'Следующая дата проверки: ' + formatDate(credit?.nextFreezeCheckAt) + '\n\n' +
        'Остаток долга не менялся.',
      mainMenu(),
    );
    return;
  }

  await api.answerCallbackQuery(callback.id, 'Неизвестное действие');
}

async function handleMessage(api: TelegramApi, message: TelegramMessage): Promise<void> {
  const chatId = message.chat.id;
  const text = message.text?.trim();
  if (!text || !message.from || message.from.is_bot) return;
  if (message.chat.type !== 'private') {
    await send(api, chatId, 'Для защиты финансовых данных используй бота только в личном чате.');
    return;
  }

  const command = text.split(/\s+/, 1)[0].split('@', 1)[0].toLowerCase();
  if (command === '/start' || command === '/menu' || command === '/help') {
    const user = await getOrCreateTelegramUser(message.from);
    const greeting = command === '/start'
      ? 'Привет, ' + escapeHtml(telegramDisplayName(message.from)) + '!\n\n' +
        'Профиль создан. Регистрация на сайте и пароль не нужны. Данные будут сохраняться в Credit Tracker.'
      : 'Главное меню Credit Tracker.';
    await send(api, chatId, greeting, mainMenu());
    return;
  }

  const user = await getOrCreateTelegramUser(message.from);
  if (command === '/cancel') {
    wizards.delete(chatId);
    incomePendingChats.delete(chatId);
    await send(api, chatId, 'Добавление долга отменено.', mainMenu());
    return;
  }
  if (command === '/summary') return showSummary(api, chatId, user.id);
  if (command === '/debts') return showDebts(api, chatId, user.id);
  if (command === '/payments') return showPayments(api, chatId, user.id);
  if (command === '/add') return startAddWizard(api, chatId);

  if (await handleWizardText(api, chatId, user.id, text)) return;
  await send(api, chatId, 'Не понял команду. Используй меню или /help.', mainMenu());
}

async function handleUpdate(api: TelegramApi, update: TelegramUpdate): Promise<void> {
  try {
    if (update.callback_query) {
      await handleCallback(api, update.callback_query);
    } else if (update.message) {
      await handleMessage(api, update.message);
    }
  } catch (error) {
    console.error('[telegram] Не удалось обработать update:', error);
    const chatId = update.message?.chat.id ?? update.callback_query?.message?.chat.id;
    if (chatId) {
      await send(api, chatId, 'Не удалось выполнить действие. Проверь данные и попробуй ещё раз.', mainMenu())
        .catch(() => undefined);
    }
  }
}

/**
 * Long polling is used for the first MVP: no public webhook URL or extra service
 * is required. Run exactly one instance for a bot token.
 */
export function startTelegramBot(token: string): () => void {
  const api = new TelegramApi(token);
  let stopped = false;
  let offset: number | undefined;

  const poll = async (): Promise<void> => {
    console.log('[telegram] Long polling запущен');
    while (!stopped) {
      try {
        const updates = await api.getUpdates(offset);
        for (const update of updates) {
          if (stopped) break;
          await handleUpdate(api, update);
          offset = update.update_id + 1;
        }
      } catch (error) {
        if (stopped) break;
        console.error('[telegram] Ошибка long polling:', error);
        await delay(3000);
      }
    }
    console.log('[telegram] Long polling остановлен');
  };

  void poll().catch((error) => console.error('[telegram] Polling завершился с ошибкой:', error));
  return () => {
    stopped = true;
  };
}
