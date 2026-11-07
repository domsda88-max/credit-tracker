import { ArrowLeft, Bell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PushSettings } from '../components/PushSettings';
import { ReminderSettings } from '../components/ReminderSettings';
import { MotivationSettings } from '../components/MotivationSettings';

export function AppSettingsPage() {
  const navigate = useNavigate();

  return (
    <div className="w-full max-w-full space-y-5 overflow-x-hidden touch-manipulation">
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
          <Bell size={20} className="text-primary-fg" />
          <h1 className="text-title font-bold text-t1">Настройки приложения</h1>
        </div>
        <p className="mt-1 text-caption text-t3">Уведомления и напоминания</p>
      </header>

      <section className="space-y-3">
        <h2 className="section-title px-1">Push-уведомления</h2>
        <div className="overflow-hidden rounded-card border border-line bg-surface">
          <PushSettings />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="section-title px-1">Расписание</h2>
        <div className="overflow-hidden rounded-card border border-line bg-surface">
          <ReminderSettings />
        </div>
        <div className="overflow-hidden rounded-card border border-line bg-surface">
          <MotivationSettings />
        </div>
      </section>
    </div>
  );
}