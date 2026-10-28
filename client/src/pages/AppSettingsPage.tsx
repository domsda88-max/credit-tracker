import { ArrowLeft, Bell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PushSettings } from '../components/PushSettings';
import { ReminderSettings } from '../components/ReminderSettings';
import { MotivationSettings } from '../components/MotivationSettings';

export function AppSettingsPage() {
  const navigate = useNavigate();

  return (
    <div className="w-full max-w-full space-y-5 overflow-x-hidden pb-24 safe-area-bottom touch-manipulation">
      <header className="px-1">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="mb-2 inline-flex items-center gap-1.5 text-sm text-t3 transition hover:text-t2"
        >
          <ArrowLeft size={16} />
          Назад
        </button>
        <div className="flex items-center gap-2">
          <Bell size={20} className="text-primary" />
          <h1 className="text-title font-bold text-t1">Настройки приложения</h1>
        </div>
        <p className="mt-1 text-caption text-t3">Уведомления и напоминания</p>
      </header>

      <section className="space-y-3">
        <h2 className="px-1 text-xs font-medium uppercase tracking-wide text-t3">Push-уведомления</h2>
        <PushSettings />
      </section>

      <section className="space-y-3">
        <h2 className="px-1 text-xs font-medium uppercase tracking-wide text-t3">Расписание</h2>
        <div className="rounded-card border border-line bg-surface overflow-hidden">
          <div className="p-4">
            <ReminderSettings />
          </div>
        </div>
        <div className="rounded-card border border-line bg-surface overflow-hidden">
          <div className="p-4">
            <MotivationSettings />
          </div>
        </div>
      </section>
    </div>
  );
}
