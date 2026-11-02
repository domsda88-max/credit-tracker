import { prisma } from '../../config/prisma';
import { sendUniquePush } from '../../modules/push/push.service';
import { isoDate, utcToday } from '../../utils/finance/date';
import { MOTIVATION_70 } from '../motivation70.texts';

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
  slot = 0,
): Promise<boolean> {
  const today = utcToday();

  // Используем заранее подготовленный список из 70 мотивационных сообщений:
  // каждое успешное отправление сдвигает курсор, поэтому сообщения
  // не повторяются подряд и учитываются частота (1–24 раза в день).
  const index = (((day ?? 1) - 1) % MOTIVATION_70.length + MOTIVATION_70.length) % MOTIVATION_70.length;
  const text = MOTIVATION_70[index];

  const sent = await sendUniquePush(
    userId,
    null,
    'MOTIVATION',
    `${userId}:MOTIVATION:${isoDate(today)}:slot${slot}`,
    {
      title: '💡 Мотивация',
      body: text,
      url: '/',
      tag: `motivation-${slot}`,
    },
  );

  if (!sent) return false;

  // Курсор продвигается после каждого успешно доставленного пуши,
  // чтобы при разных частотах и паузах сообщения не повторялись.
  const nextDay = ((day ?? 1) % MOTIVATION_70.length) + 1;
  await prisma.user.update({
    where: { id: userId },
    data: { motivationDay: nextDay },
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
function parseTime(s: string | null | undefined): { h: number; m: number } {
  const v = s ?? '09:30';
  const [hh, mm] = v.split(':');
  return { h: Number(hh) || 9, m: Number(mm) || 30 };
}

/** Локальное время в минутах от полуночи. */
function localMinutes(timezone: string): number {
  const { hour, minute } = localTime(timezone);
  return hour * 60 + minute;
}

export async function runMotivationJob(
  force = false,
): Promise<{ processedUsers: number; pushed: number }> {
  const users = await prisma.user.findMany({
    where: { motivationEnabled: true },
    select: {
      id: true,
      timezone: true,
      motivationDay: true,
      motivationTime: true,
      motivationPerDay: true,
    },
  });

  let processedUsers = 0;
  let pushed = 0;

  for (const user of users) {
    try {
      const perDay = user.motivationPerDay ?? 1;
      const { h, m } = parseTime(user.motivationTime);
      const base = h * 60 + m;
      const step = Math.round(1440 / perDay);
      const slots: number[] = [];
      for (let k = 0; k < perDay; k++) {
        slots.push((base + k * step) % 1440);
      }

      const nowMin = localMinutes(user.timezone);
      processedUsers += 1;

      for (let k = 0; k < slots.length; k++) {
        const slotMin = slots[k];
        if (!force && nowMin < slotMin) continue;
        const ok = await sendMotivationForUser(user.id, user.motivationDay ?? 1, k);
        if (ok) pushed += 1;
      }
    } catch (error) {
      console.error(`[cron] Ошибка мотивации для ${user.id}:`, (error as Error).message);
    }
  }

  return { processedUsers, pushed };
}
