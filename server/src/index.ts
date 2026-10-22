import { createApp } from './app';
import { env } from './config/env';
import { prisma } from './config/prisma';
import { ensureVapidConfigured } from './config/vapid';
import { runMotivationJob } from './cron/jobs/motivation.job';
import { runReminderJob } from './cron/jobs/reminder.job';
import { registerCronJobs } from './cron/scheduler';

async function bootstrap(): Promise<void> {
  await prisma.$connect();
  ensureVapidConfigured();

  const app = createApp();
  const server = app.listen(env.PORT, () => {
    console.log(`✅ API запущен: http://localhost:${env.PORT}`);
    console.log(`   Режим: ${env.NODE_ENV}`);
  });

  registerCronJobs();

  // Free-инстанс Render засыпает и может пропустить плановый запуск в 10:00.
  // Догоняем напоминания сразу при старте; повторную отправку отсекает журнал.
  setTimeout(() => {
    void runReminderJob().catch((error) =>
      console.error('[cron] Сбой догоняющего запуска напоминаний:', error),
    );
    void runMotivationJob().catch((error) =>
      console.error('[cron] Сбой догоняющего запуска мотивации:', error),
    );
  }, 10_000);

  const shutdown = async (signal: string): Promise<void> => {
    console.log(`\n${signal}: останавливаю сервер...`);
    server.close();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

bootstrap().catch((error) => {
  console.error('❌ Не удалось запустить сервер:', error);
  process.exit(1);
});
