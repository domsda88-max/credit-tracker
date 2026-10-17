import cron from 'node-cron';
import { runReminderJob } from './jobs/reminder.job';

/**
 * Регистрация фоновых задач.
 * Задача напоминаний запускается каждый час в :00 — внутри джобы
 * каждый пользователь отбирается по своему локальному времени (10:00).
 */
export function registerCronJobs(): void {
  cron.schedule('0 * * * *', () => {
    void runReminderJob().catch((error) => console.error('[cron] Сбой джобы напоминаний:', error));
  });

  console.log('⏰ Cron: ежечасная проверка дат платежей зарегистрирована');
}
