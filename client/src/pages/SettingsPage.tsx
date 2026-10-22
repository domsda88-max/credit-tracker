import { PushSettings } from '../components/PushSettings';
import { ReminderSettings } from '../components/ReminderSettings';

export function SettingsPage() {
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold text-slate-100">Настройки</h1>
        <p className="mt-1 text-sm text-slate-500">Push-уведомления и напоминания</p>
      </header>

      <PushSettings />
      <ReminderSettings />
    </div>
  );
}
