import cron from 'node-cron';
import { runMotivationJob } from './jobs/motivation.job';
import { runReminderJob } from './jobs/reminder.job';

/**
 * Регистрация фоновых задач.
 *
 * • Напоминания о платежах — каждый час в :00; внутри джобы каждый пользователь
 *   отбирается по своему локальному времени (10:00).
 * • Ежедневная мотивация — каждые 10 минут; отправляется тем, у кого локальное
 *   время уже ≥ 9:30 и сегодня ещё не отправлялось (дубли отсекает журнал).
 */
export function registerCronJobs(): void {
  cron.schedule('0 * * * *', () => {
    void runReminderJob().catch((error) => console.error('[cron] Сбой джобы напоминаний:', error));
  });

  cron.schedule('*/10 * * * *', () => {
    void runMotivationJob().catch((error) => console.error('[cron] Сбой джобы мотивации:', error));
  });

  console.log('⏰ Cron: напоминания (ежечасно) и мотивация (9:30) зарегистрированы');
}
