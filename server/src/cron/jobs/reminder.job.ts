import { prisma } from '../../config/prisma';
import { sendUniquePush } from '../../modules/push/push.service';
import { addUTCDays, formatDate, isoDate, utcToday } from '../../utils/finance/date';

/** Час (локального времени пользователя), в который отправляем дневной дайджест. */
const REMINDER_HOUR = 10;

/** Горизонт предупреждения о конце цикла заморозки (дней). */
const FREEZE_WARNING_DAYS = 2;

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

/** Сводный дайджест: просрочка + платежи сегодня + платежи завтра — одним пушем. */
async function sendDigestForUser(userId: string): Promise<void> {
  const today = utcToday();
  const tomorrow = addUTCDays(today, 1);

  const pending = await prisma.paymentSchedule.findMany({
    where: {
      status: 'PENDING',
      dueDate: { lte: tomorrow },
      credit: { userId, status: 'ACTIVE' },
    },
    include: { credit: { select: { name: true } } },
    orderBy: { dueDate: 'asc' },
  });

  if (pending.length === 0) return;

  const overdue: DueItem[] = [];
  const dueToday: DueItem[] = [];
  const dueTomorrow: DueItem[] = [];

  for (const item of pending) {
    const entry: DueItem = {
      creditName: item.credit.name,
      amount: Number(item.amount),
      dueDate: item.dueDate,
    };
    const time = item.dueDate.getTime();
    if (time < today.getTime()) overdue.push(entry);
    else if (time === today.getTime()) dueToday.push(entry);
    else dueTomorrow.push(entry);
  }

  const sections: string[] = [];
  if (overdue.length > 0) sections.push(`🔴 Просрочка (${overdue.length}): ${describe(overdue)}`);
  if (dueToday.length > 0) sections.push(`🟠 Сегодня (${dueToday.length}): ${describe(dueToday)}`);
  if (dueTomorrow.length > 0) sections.push(`🟡 Завтра (${dueTomorrow.length}): ${describe(dueTomorrow)}`);

  const total = sum([...overdue, ...dueToday, ...dueTomorrow]);
  sections.push(`💰 Итого: ${total.toLocaleString('ru-RU')} ₽`);

  const hasOverdue = overdue.length > 0;
  await sendUniquePush(userId, null, 'DIGEST', `${userId}:DIGEST:${isoDate(today)}`, {
    title: hasOverdue ? '🔴 Есть просроченные платежи' : '💳 Платежи по кредитам',
    body: sections.join('\n'),
    url: '/',
    tag: 'daily-digest',
  });
}

/** Предупреждение об окончании цикла заморозки («снежинка» 🧊). */
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
    await sendUniquePush(
      userId,
      credit.id,
      'FREEZE_ENDING',
      `${userId}:FREEZE:${credit.id}:${isoDate(today)}`,
      {
        title: '🧊 Цикл заморозки скоро закончится',
        body: `По «${credit.name}» заморозка истекает ${formatDate(credit.nextFreezeCheckAt!)}. Продлите период, иначе начнут начисляться проценты.`,
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
  const users = await prisma.user.findMany({ select: { id: true, timezone: true } });

  let processedUsers = 0;
  let pushed = 0;

  for (const user of users) {
    try {
      if (!force && localHour(user.timezone) < REMINDER_HOUR) continue;
      processedUsers += 1;

      const before = await prisma.notificationLog.count({
        where: { userId: user.id, type: 'DIGEST' },
      });

      await sendDigestForUser(user.id);
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
