import { PushSettings } from '../components/PushSettings';
import { ReminderSettings } from '../components/ReminderSettings';
import { MotivationSettings } from '../components/MotivationSettings';
import { ThemeToggle } from '../components/ThemeToggle';
import { DataExport } from '../components/DataExport';
import { useAuthStore } from '../store/auth';

export function SettingsPage() {
  const user = useAuthStore((s) => s.user);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-semibold text-slate-100">Настройки</h1>
        <p className="mt-1 text-sm text-slate-500">Уведомления, оформление и данные</p>
      </header>

      <section className="space-y-2">
        <h2 className="px-1 text-xs font-medium uppercase tracking-wide text-slate-500">
          Уведомления
        </h2>
        <PushSettings />
        <ReminderSettings />
        <MotivationSettings />
      </section>

      <section className="space-y-2">
        <h2 className="px-1 text-xs font-medium uppercase tracking-wide text-slate-500">
          Оформление
        </h2>
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
          <div>
            <p className="font-medium text-slate-100">Тема оформления</p>
            <p className="mt-0.5 text-xs text-slate-500">Как в системе, светлая или тёмная</p>
          </div>
          <ThemeToggle />
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="px-1 text-xs font-medium uppercase tracking-wide text-slate-500">Данные</h2>
        <DataExport />
      </section>

      <section className="space-y-2">
        <h2 className="px-1 text-xs font-medium uppercase tracking-wide text-slate-500">Аккаунт</h2>
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
          <p className="text-xs text-slate-500">Вы вошли как</p>
          <p className="mt-0.5 text-sm text-slate-200">{user?.email}</p>
        </div>
      </section>
    </div>
  );
}
