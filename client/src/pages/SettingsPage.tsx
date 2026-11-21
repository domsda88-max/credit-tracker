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
    <div className="w-full max-w-full page-stack overflow-x-hidden touch-manipulation">
      <section className="border-b border-line pb-4">
        <h2 className="text-3xl font-bold tracking-tight text-t1">Тема</h2>
        <SegmentedControl />
      </section>

      <section className="border-b border-line pb-4">
        <h2 className="text-3xl font-bold tracking-tight text-t1">Деньги</h2>
        <p className="text-xs uppercase tracking-widest text-t3">
          Покажем, сколько остаётся после обязательных платежей
        </p>
        <IncomeSettings />
      </section>

      <section className="border-b border-line pb-4">
        <h2 className="text-3xl font-bold tracking-tight text-t1">Уведомления</h2>
        <p className="text-xs uppercase tracking-widest text-t3">
          Сводка платежей в выбранное время + напоминания о сроках
        </p>
        <PushSettings />
        <ReminderSettings />
        <MotivationSettings />
      </section>

      <section className="border-b border-line pb-4">
        <h2 className="text-3xl font-bold tracking-tight text-t1">Данные</h2>
        <DataExport />
        <div className="mt-4 space-y-3">
          <p className="text-xs uppercase tracking-widest text-t3">
            Импорт оплат
          </p>
          <p className="text-xs text-t3">
            Импортируются только строки со статусом «Оплачен». Используйте файл, скачанный
            через «Экспорт CSV».
          </p>
          <button
            type="button"
            onClick={() => setImportOpen(true)}
            className="flex w-full items-center justify-center gap-1.5 rounded-control border border-line px-3 py-2 text-sm text-t2 transition hover:border-primary/50"
          >
            <Upload size={16} aria-hidden="true" /> Импортировать CSV
          </button>
        </div>
      </section>

      <section className="border-b border-line pb-4">
        <h2 className="text-3xl font-bold tracking-tight text-t1">Аккаунт</h2>
        <div className="p-5">
          <p className="text-xs uppercase tracking-widest text-t3">Вы вошли как</p>
          <p className="mt-0.5 text-sm text-t1 break-all">{user?.email}</p>
          <button type="button" onClick={handleLogout} className="mt-3 w-full rounded-control border border-danger/60 bg-transparent px-4 py-2.5 text-sm font-medium text-danger-fg transition hover:bg-danger/10">Выйти из аккаунта</button>
        </div>
      </section>

      <TipsSection />

      <ImportPaymentsBottomSheet isOpen={importOpen} onClose={() => setImportOpen(false)} />
    </div>
  );
}
