import { ChevronDown, Upload } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PushSettings } from '../components/PushSettings';
import { ReminderSettings } from '../components/ReminderSettings';
import { MotivationSettings } from '../components/MotivationSettings';
import { IncomeSettings } from '../components/IncomeSettings';
import { useThemeStore } from '../store/theme';
import { SegmentedControl } from '../components/SegmentedControl';
import { DataExport } from '../components/DataExport';
import { ImportPaymentsBottomSheet } from '../components/ImportPaymentsBottomSheet';
import { useAuthStore } from '../store/auth';

function Accordion({ title, subtitle, defaultOpen = false, children }: {
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="overflow-hidden rounded-card border border-line bg-surface">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-surface2"
        aria-expanded={open}
      >
        <div>
          <p className="font-medium text-t1">{title}</p>
          {subtitle && <p className="mt-0.5 text-xs text-t3">{subtitle}</p>}
        </div>
        <ChevronDown
          size={18}
          className={`shrink-0 text-t3 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      <div className="acc" data-open={open}>
        <div className="acc__inner">
          <div className="border-t border-line">{children}</div>
        </div>
      </div>
    </div>
  );
}

/** Sr-only визуально скрытый заголовок для скринридеров. */
function SrOnly({ children }: { children: React.ReactNode }) {
  return <h2 className="sr-only">{children}</h2>;
}

export function SettingsPage() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const themeMode = useThemeStore((s) => s.mode);
  const setThemeMode = useThemeStore((s) => s.setMode);
  const [importOpen, setImportOpen] = useState(false);
  const handleLogout = () => { logout(); navigate('/login', { replace: true }); };

  return (
    <div className="w-full max-w-full space-y-5 overflow-x-hidden touch-manipulation">
      <SrOnly>Настройки</SrOnly>

      <section className="space-y-3">
        <SrOnly>Деньги</SrOnly>
        <Accordion title="Доход в месяц" subtitle="Покажем, сколько остаётся после обязательных платежей">
          <IncomeSettings />
        </Accordion>
      </section>

      <section className="space-y-3">
        <SrOnly>Уведомления</SrOnly>
        <Accordion title="Push-уведомления" subtitle="Сводка платежей в выбранное время + напоминания о сроках">
          <PushSettings />
        </Accordion>
        <Accordion title="Напоминания" subtitle="Во сколько присылать сводку и за сколько дней предупреждать">
          <ReminderSettings />
        </Accordion>
        <Accordion title="Мотивация" subtitle="Ежедневные мотивирующие уведомления">
          <MotivationSettings />
        </Accordion>
      </section>

      <section className="space-y-3">
        <SrOnly>Оформление</SrOnly>
        <div className="rounded-card border border-line bg-surface p-4">
          <p className="font-medium text-t1">Тема оформления</p>
          <p className="mt-0.5 text-xs text-t3">Светлая или тёмная</p>
          <div className="mt-3">
            <SegmentedControl
              value={themeMode}
              options={[
                { value: 'dark', label: 'Тёмная' },
                { value: 'light', label: 'Светлая' },
              ]}
              onChange={(v) => setThemeMode(v as 'dark' | 'light')}
              ariaLabel="Тема оформления"
            />
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <SrOnly>Данные</SrOnly>
        <Accordion title="Экспорт данных" subtitle="Скачать CSV / JSON">
          <DataExport />
        </Accordion>
        <Accordion title="Импорт оплат" subtitle="Восстановить историю из CSV-экспорта">
          <div className="space-y-3">
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
        </Accordion>
      </section>

      <section className="space-y-3">
        <SrOnly>Аккаунт</SrOnly>
        <div className="rounded-card border border-line bg-surface p-4">
          <p className="text-xs text-t3">Вы вошли как</p>
          <p className="mt-0.5 text-sm text-t1 break-all">{user?.email}</p>
          <button type="button" onClick={handleLogout} className="mt-3 w-full rounded-control border border-danger/60 bg-transparent px-4 py-2.5 text-sm font-medium text-danger transition hover:bg-danger/10">Выйти из аккаунта</button>
        </div>
      </section>

      <ImportPaymentsBottomSheet isOpen={importOpen} onClose={() => setImportOpen(false)} />
    </div>
  );
}
