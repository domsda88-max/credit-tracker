import { prisma } from '../../config/prisma';
import { sendUniquePush } from '../../modules/push/push.service';
import { addUTCDays, isoDate, utcToday } from '../../utils/finance/date';

/** Час (локального времени пользователя), в который отправляем дневной дайджест. */
const DEFAULT_REMINDER_HOUR = 10;

/** Горизонт предупреждения о конце цикла заморозки (дней). */
const FREEZE_WARNING_DAYS = 2;

/** Дни предупреждения по умолчанию: за 3, за 2, за 1 день и в сам день платежа. */
const DEFAULT_LEAD_DAYS = [3, 2, 1, 0];

/** Локальный час пользователя по его таймзоне; при неверной таймзоне — Москва. */
function localHour(timezone: string): number {
  const read = (tz: string): number =>
    Number(
      new Intl.DateTimeFormat('ru-RU', { timeZone: tz, hour: 'numeric', hour12: false }).format(
        new Date(),
      ),
    );

  try {
    return read(timezone);
  } catch {
    return read('Europe/Moscow');
  }
}

interface DueItem {
  creditName: string;
  amount: number;
  dueDate: Date;
}

function sum(items: DueItem[]): number {
  return Math.round(items.reduce((acc, item) => acc + item.amount, 0) * 100) / 100;
}

function describe(items: DueItem[]): string {
  return items.map((item) => `${item.creditName} — ${item.amount.toLocaleString('ru-RU')} ₽`).join('; ');
}

/**
 * Напоминания о платежах. Для каждого дня из `leadDaysList` (например [3, 2, 1, 0])
 * отправляем отдельное уведомление тем платежам, срок которых наступает ровно
 * через N дней. Плюс раз в день — сводка по просрочке.
 *
 * Идемпотентность: dedupKey включает дату и число дней, поэтому при «догоне»
 * после пробуждения сервера дубли не отправляются.
 */
async function sendDigestForUser(userId: string, leadDaysList: number[]): Promise<void> {
  const today = utcToday();
  const days = leadDaysList.length > 0 ? leadDaysList : DEFAULT_LEAD_DAYS;
  const maxLead = Math.max(...days);

  // Все незакрытые платежи в пределах самого дальнего горизонта предупреждения.
  const pending = await prisma.paymentSchedule.findMany({
    where: {
      status: 'PENDING',
      dueDate: { lte: addUTCDays(today, maxLead) },
      credit: { userId, status: 'ACTIVE' },
    },
    include: { credit: { select: { name: true } } },
    orderBy: { dueDate: 'asc' },
  });

  console.log('[digest] user:', userId, 'pending count:', pending.length);
  if (pending.length === 0) {
    console.log('[digest] no pending payments, skip');
    return;
  }

  const overdue: DueItem[] = [];
  const byLead = new Map<number, DueItem[]>();

  for (const item of pending) {
    const entry: DueItem = {
      creditName: item.credit.name,
      amount: Number(item.amount),
      dueDate: item.dueDate,
    };
    const diffDays = Math.round((item.dueDate.getTime() - today.getTime()) / 86_400_000);
    if (diffDays < 0) {
      overdue.push(entry);
    } else {
      const bucket = byLead.get(diffDays) ?? [];
      bucket.push(entry);
      byLead.set(diffDays, bucket);
    }
  }

  // 1) Просрочка — одним сообщением в день.
  if (overdue.length > 0) {
    const total = sum(overdue);
    await sendUniquePush(userId, null, 'DIGEST', `${userId}:OVERDUE:${isoDate(today)}`, {
      title: `🔴 Просрочено платежей: ${overdue.length}`,
      body: `${describe(overdue)}\n💰 Итого: ${total.toLocaleString('ru-RU')} ₽`,
      url: '/',
      tag: 'overdue',
    });
  }

  // 2) Предупреждения по каждому дню из настроек.
  for (const lead of days) {
    const items = byLead.get(lead);
    if (!items || items.length === 0) continue;

    const total = sum(items);
    const title =
      lead === 0
        ? `🟠 Сегодня платёж: ${items.length}`
        : `🟡 Через ${lead} ${pluralDays(lead)} платёж: ${items.length}`;

    await sendUniquePush(userId, null, 'DIGEST', `${userId}:DIGEST:${lead}:${isoDate(today)}`, {
      title,
      body: `${describe(items)}\n💰 Итого: ${total.toLocaleString('ru-RU')} ₽`,
      url: '/',
      tag: `due-${lead}`,
    });
  }
}

/** «день / дня / дней» — чтобы текст не выглядел машинным. */
function pluralDays(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'день';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'дня';
  return 'дней';
}

/**
 * Предупреждения об окончании цикла заморозки («снежинка» 🧊).
 *
 * У карты в цикле заморозки нет минимального платежа и срока: раз в цикл
 * (день `graceReplenishDay`) нужно внести сумму обновления беспроцентного
 * периода. Напоминаем за 2 дня и в сам день — с акцентом, что пропускать нельзя.
 */
async function sendFreezeAlerts(userId: string): Promise<void> {
  const today = utcToday();
  const horizon = addUTCDays(today, FREEZE_WARNING_DAYS);

  const credits = await prisma.credit.findMany({
    where: {
      userId,
      status: 'ACTIVE',
      frozen: true,
      nextFreezeCheckAt: { not: null, lte: horizon },
    },
  });

  for (const credit of credits) {
    const day = credit.graceReplenishDay ?? credit.paymentDay;
    const sum = credit.graceReplenishSum ? Number(credit.graceReplenishSum) : null;
    const sumLabel = sum ? `${sum.toLocaleString('ru-RU')} ₽` : 'сумму обновления';
    const dayLabel = day ? ` до ${day} числа` : '';

    await sendUniquePush(
      userId,
      credit.id,
      'FREEZE_ENDING',
      `${userId}:FREEZE:${credit.id}:${isoDate(today)}`,
      {
        title: '🧊 Обновите беспроцентный период',
        body: `«${credit.name}»: внесите ${sumLabel}${dayLabel} — иначе льготный период сгорит и банк начнёт начислять проценты.`,
        url: `/credits/${credit.id}`,
        tag: `freeze-${credit.id}`,
      },
    );
  }
}

/**
 * Основная задача напоминаний.
     * Запускается каждый час; фактическую отправку делает для тех пользователей,
 * у кого напоминание на сегодня ещё не отправлено и локальное время уже
 * наступило (≥ 10:00). Так пропущенный из-за сна сервера запуск «догоняется»
 * при первом же пробуждении: повторную отправку отсекает уникальный ключ в журнале.
 * Экспортируется для ручного запуска и тестов.
 */
export async function runReminderJob(force = false): Promise<{ processedUsers: number; pushed: number }> {
  const users = await prisma.user.findMany({
    select: { id: true, timezone: true, reminderHour: true, leadDaysList: true },
  });

  let processedUsers = 0;
  let pushed = 0;

  for (const user of users) {
    try {
      const hour = user.reminderHour ?? DEFAULT_REMINDER_HOUR;
      const lh = localHour(user.timezone);
      console.log('[cron] user:', user.id, 'timezone:', user.timezone, 'localHour:', lh, 'REMINDER_HOUR:', hour);
      if (!force && lh < hour) {
        console.log('[cron] skip user:', user.id, 'hour mismatch');
        continue;
      }
      processedUsers += 1;

      const before = await prisma.notificationLog.count({
        where: { userId: user.id, type: 'DIGEST' },
      });

      await sendDigestForUser(user.id, user.leadDaysList ?? DEFAULT_LEAD_DAYS);
      await sendFreezeAlerts(user.id);

      const after = await prisma.notificationLog.count({
        where: { userId: user.id, type: 'DIGEST' },
      });
      if (after > before) pushed += 1;
    } catch (error) {
      console.error(`[cron] Ошибка обработки пользователя ${user.id}:`, (error as Error).message);
    }
  }

  return { processedUsers, pushed };
}
