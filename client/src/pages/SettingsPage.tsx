import { Upload } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PushSettings } from '../components/PushSettings';
import { ReminderSettings } from '../components/ReminderSettings';
import { MotivationSettings } from '../components/MotivationSettings';
import { IncomeSettings } from '../components/IncomeSettings';
import { DataExport } from '../components/DataExport';
import { ImportPaymentsBottomSheet } from '../components/ImportPaymentsBottomSheet';
import { TipsSection } from '../components/TipsSection';
import { SegmentedControl } from '../components/SegmentedControl';
import { useAuthStore } from '../store/auth';

export function SettingsPage() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const [importOpen, setImportOpen] = useState(false);
  const handleLogout = () => { logout(); navigate('/login', { replace: true }); };

  return (
    <div className="w-full max-w-full page-stack overflow-x-hidden touch-manipulation animate-fade-in">
      <header className="space-y-1 pb-1">
        <p className="section-title">Персонализация</p>
        <h1 className="text-2xl font-bold tracking-tight text-t1">Настройки</h1>
        <p className="text-sm text-t3">Настройте приложение под себя</p>
      </header>

      <section className="card card-pad space-y-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-t1">Внешний вид</h2>
          <p className="mt-1 text-sm text-t3">Выберите комфортную тему приложения</p>
        </div>
        <SegmentedControl />
      </section>

      <section className="card card-pad space-y-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-t1">Деньги</h2>
          <p className="mt-1 text-sm text-t3">Доход и свободный остаток после обязательных платежей</p>
        </div>
        <IncomeSettings />
      </section>

      <section className="card card-pad space-y-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-t1">Уведомления</h2>
          <p className="mt-1 text-sm text-t3">Напоминания о сроках и сводки платежей</p>
        </div>
        <div className="space-y-3">
          <PushSettings />
          <ReminderSettings />
          <MotivationSettings />
        </div>
      </section>

      <section className="card card-pad space-y-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-t1">Данные</h2>
          <p className="mt-1 text-sm text-t3">Экспортируйте или восстановите историю платежей</p>
        </div>
        <DataExport />
        <div className="card-inner space-y-3 p-4">
          <div>
            <p className="text-sm font-semibold text-t1">Импорт оплат</p>
            <p className="mt-1 text-sm leading-relaxed text-t3">
              Импортируются только строки со статусом «Оплачен». Используйте файл, скачанный через «Экспорт CSV».
            </p>
          </div>
          <button
            type="button"
            onClick={() => setImportOpen(true)}
            className="btn btn-secondary w-full"
          >
            <Upload size={17} aria-hidden="true" /> Импортировать CSV
          </button>
        </div>
      </section>

      <section className="card card-pad space-y-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-t1">Аккаунт</h2>
          <p className="mt-1 text-sm text-t3">Параметры вашей учётной записи</p>
        </div>
        <div className="card-inner p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-t3">Вы вошли как</p>
          <p className="mt-1 break-all text-sm font-medium text-t1">{user?.email}</p>
          <button
            type="button"
            onClick={handleLogout}
            className="mt-4 w-full rounded-xl border border-danger/40 bg-danger/5 px-4 py-3 text-sm font-semibold text-danger-fg transition hover:bg-danger/10"
          >
            Выйти из аккаунта
          </button>
        </div>
      </section>

      <TipsSection />
      <ImportPaymentsBottomSheet isOpen={importOpen} onClose={() => setImportOpen(false)} />
    </div>
  );
}
