import { prisma } from '../../config/prisma';
import { sendUniquePush } from '../../modules/push/push.service';
import { isoDate, utcToday } from '../../utils/finance/date';
import { buildMotivationContext } from '../motivation.context';
import { MOTIVATION_CYCLE, motivationForDay } from '../motivation.texts';

/** Час и минута отправки мотивационной рассылки (локальное время пользователя). */
export const MOTIVATION_HOUR = 9;
export const MOTIVATION_MINUTE = 30;

/**
 * Локальные часы и минуты пользователя по его таймзоне.
 * При неверной таймзоне — Москва.
 */
export function localTime(timezone: string): { hour: number; minute: number } {
  const read = (tz: string) => {
    const parts = new Intl.DateTimeFormat('ru-RU', {
      timeZone: tz,
      hour: 'numeric',
      minute: 'numeric',
      hour12: false,
    }).formatToParts(new Date());
    const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
    const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
    return { hour, minute };
  };

  try {
    return read(timezone);
  } catch {
    return read('Europe/Moscow');
  }
}

/**
 * Отправить дневную мотивацию одному пользователю.
 * Возвращает true, если уведомление ушло (или уже было отправлено сегодня).
 */
export async function sendMotivationForUser(
  userId: string,
  day: number,
): Promise<boolean> {
  const today = utcToday();

  // Текст собирается под ЭТОГО пользователя: его долги, ставки, циклы, суммы.
  const context = await buildMotivationContext(userId);
  const text = motivationForDay(context, day);

  // Идемпотентность: одна мотивация в сутки на пользователя.
  const sent = await sendUniquePush(
    userId,
    null,
    'MOTIVATION',
    `${userId}:MOTIVATION:${isoDate(today)}`,
    {
      title: text.title,
      body: text.body,
      url: '/',
      tag: 'motivation',
    },
  );

  if (!sent) return false;

  // Переходим к следующему дню цикла (после последнего — снова день 1).
  const nextDay = (day % MOTIVATION_CYCLE) + 1;
  await prisma.user.update({
    where: { id: userId },
    data: { motivationDay: nextDay, motivationSentOn: today },
  });

  return true;
}

/**
 * Ежедневная мотивационная рассылка.
 *
 * Запускается каждые несколько минут; отправляет тем пользователям,
 * у кого мотивация включена, локальное время уже ≥ 9:30, и сегодня
 * ещё не отправлялось. Так пропущенный из-за сна сервера запуск
 * «догоняется» при первом пробуждении, а дубли отсекает журнал.
 */
export async function runMotivationJob(
  force = false,
): Promise<{ processedUsers: number; pushed: number }> {
  const users = await prisma.user.findMany({
    where: { motivationEnabled: true },
    select: { id: true, timezone: true, motivationDay: true },
  });

  let processedUsers = 0;
  let pushed = 0;

  for (const user of users) {
    try {
      if (!force) {
        const { hour, minute } = localTime(user.timezone);
        if (hour < MOTIVATION_HOUR) continue;
        if (hour === MOTIVATION_HOUR && minute < MOTIVATION_MINUTE) continue;
      }
      processedUsers += 1;

      const ok = await sendMotivationForUser(user.id, user.motivationDay ?? 1);
      if (ok) pushed += 1;
    } catch (error) {
      console.error(`[cron] Ошибка мотивации для ${user.id}:`, (error as Error).message);
    }
  }

  return { processedUsers, pushed };
}
