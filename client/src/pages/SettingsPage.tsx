import { PushSettings } from '../components/PushSettings';
import { ReminderSettings } from '../components/ReminderSettings';
import { MotivationSettings } from '../components/MotivationSettings';
import { IncomeSettings } from '../components/IncomeSettings';
import { ThemeToggle } from '../components/ThemeToggle';
import { DataExport } from '../components/DataExport';
import { useAuthStore } from '../store/auth';

export function SettingsPage() {
  const user = useAuthStore((s) => s.user);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-title font-bold text-t1">Настройки</h1>
        <p className="mt-1 text-caption text-t3">Деньги, уведомления, оформление и данные</p>
      </header>

      <section className="space-y-2">
        <h2 className="px-1 section-title">Деньги</h2>
        <IncomeSettings />
      </section>

      <section className="space-y-2">
        <h2 className="px-1 text-xs font-medium uppercase tracking-wide text-t3">
          Уведомления
        </h2>
        <PushSettings />
        <ReminderSettings />
        <MotivationSettings />
      </section>

      <section className="space-y-2">
        <h2 className="px-1 text-xs font-medium uppercase tracking-wide text-t3">
          Оформление
        </h2>
        <div className="flex items-center justify-between gap-3 rounded-card border border-line bg-surface p-4">
          <div>
            <p className="font-medium text-t1">Тема оформления</p>
            <p className="mt-0.5 text-xs text-t3">Как в системе, светлая или тёмная</p>
          </div>
          <ThemeToggle />
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="px-1 text-xs font-medium uppercase tracking-wide text-t3">Данные</h2>
        <DataExport />
      </section>

      <section className="space-y-2">
        <h2 className="px-1 text-xs font-medium uppercase tracking-wide text-t3">Аккаунт</h2>
        <div className="rounded-card border border-line bg-surface p-4">
          <p className="text-xs text-t3">Вы вошли как</p>
          <p className="mt-0.5 text-sm text-t1">{user?.email}</p>
        </div>
      </section>
    </div>
  );
}
