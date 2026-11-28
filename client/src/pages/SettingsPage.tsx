import { BellRing, ChevronDown, Upload } from 'lucide-react';
import { TelegramSettings } from '../components/TelegramSettings';
import { useId, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { PushSettings } from '../components/PushSettings';
import { ReminderSettings } from '../components/ReminderSettings';
import { MotivationSettings } from '../components/MotivationSettings';
import { IncomeSettings } from '../components/IncomeSettings';
import { useThemeStore, type ThemeMode } from '../store/theme';
import { DataExport } from '../components/DataExport';
import { ImportPaymentsBottomSheet } from '../components/ImportPaymentsBottomSheet';
import { TipsSection } from '../components/TipsSection';
import { useAuthStore } from '../store/auth';
import { usePushNotifications, type PushStatus } from '../hooks/usePushNotifications';

const THEMES: ReadonlyArray<{ mode: ThemeMode; label: string; swatch: string }> = [
  {
    mode: 'light',
    label: 'Светлая',
    swatch: 'linear-gradient(135deg, #F5F4F0 0%, #FFFFFF 55%, #6654A6 140%)',
  },
  {
    mode: 'dark',
    label: 'Тёмная',
    swatch: 'linear-gradient(135deg, #11151C 0%, #1A202B 55%, #A69BCF 140%)',
  },
];

function Accordion({ title, subtitle, defaultOpen = false, testId, children }: {
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  testId?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const contentId = useId();

  return (
    <div className="card overflow-hidden" data-testid={testId} data-open={open}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={contentId}
        className="tap flex min-h-[52px] w-full items-center justify-between gap-3 px-5 py-3.5 text-left transition-colors hover:bg-surface2"
      >
        <span className="min-w-0">
          <span className="block font-semibold text-t1">{title}</span>
          {subtitle && <span className="mt-0.5 block text-xs text-t3">{subtitle}</span>}
        </span>
        <ChevronDown
          size={18}
          className={`shrink-0 text-t3 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>
      <div id={contentId} className="acc" data-open={open}>
        <div className="acc__inner">
          <div className="border-t border-line px-5 py-4">{children}</div>
        </div>
      </div>
    </div>
  );
}

interface NotificationsProps {
  status: PushStatus;
  error: string | null;
  busy: boolean;
  onToggle: () => void;
}

/** Один компактный аккордеон: кнопка включения и стрелка раскрытия работают независимо. */
function NotificationsAccordion({ status, error, busy, onToggle }: NotificationsProps) {
  const [open, setOpen] = useState(false);
  const contentId = useId();
  const subscribed = status === 'subscribed';
  const toggleDisabled = busy || status === 'loading' || status === 'unsupported';

  return (
    <div className="card overflow-hidden" data-testid="notifications-accordion" data-open={open}>
      <div className="flex items-center gap-2 px-5 py-2.5">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={contentId}
          data-testid="notifications-title"
          className="tap flex min-h-[52px] min-w-0 flex-1 items-center gap-3 text-left"
        >
          <BellRing size={19} className="shrink-0 text-primary" aria-hidden="true" />
          <span className="min-w-0">
            <span className="block font-semibold text-t1">Уведомления</span>
            <span className="mt-0.5 block truncate text-xs text-t3">
              {subscribed ? 'Включены сводка и напоминания' : 'Сводка платежей и напоминания о сроках'}
            </span>
          </span>
        </button>
        <button
          type="button"
          data-testid="push-toggle-button"
          onClick={onToggle}
          disabled={toggleDisabled}
          aria-label={subscribed ? 'Выключить уведомления' : 'Включить уведомления'}
          className={`btn min-h-[44px] shrink-0 px-3 py-2 text-sm disabled:opacity-50 ${
            subscribed ? 'btn-secondary' : 'btn-primary'
          }`}
        >
          {subscribed ? 'Выключить' : 'Включить'}
        </button>
        <button
          type="button"
          data-testid="notifications-chevron"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={contentId}
          aria-label={open ? 'Свернуть настройки уведомлений' : 'Раскрыть настройки уведомлений'}
          className="tap flex h-11 w-11 shrink-0 items-center justify-center rounded-control text-t2 transition-colors hover:bg-surface2"
        >
          <ChevronDown
            size={18}
            className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        </button>
      </div>
      <div id={contentId} className="acc" data-open={open}>
        <div className="acc__inner">
          <div className="border-t border-line">
            <PushSettings status={status} error={error} busy={busy} onToggle={onToggle} />
          </div>
          <div className="border-t border-line">
            <ReminderSettings />
          </div>
          <div className="border-t border-line">
            <MotivationSettings pushStatus={status} />
          </div>
        </div>
      </div>
    </div>
  );
}

export function SettingsPage() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const themeMode = useThemeStore((s) => s.mode);
  const setThemeMode = useThemeStore((s) => s.setMode);
  const [importOpen, setImportOpen] = useState(false);
  const { status, error, subscribe, unsubscribe } = usePushNotifications();
  const [pushBusy, setPushBusy] = useState(false);

  const togglePush = async () => {
    if (pushBusy) return;
    setPushBusy(true);
    try {
      if (status === 'subscribed') await unsubscribe();
      else await subscribe();
    } finally {
      setPushBusy(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="page-stack w-full max-w-full overflow-x-hidden touch-manipulation">
      <section className="space-y-3">
        <h2 className="section-title">Тема</h2>
        <div className="card card-pad">
          <div className="grid grid-cols-2 gap-3">
            {THEMES.map((theme) => {
              const selected = themeMode === theme.mode;
              return (
                <button
                  key={theme.mode}
                  type="button"
                  data-testid={`theme-${theme.mode}`}
                  aria-label={`Тема ${theme.mode}`}
                  aria-pressed={selected}
                  onClick={() => setThemeMode(theme.mode)}
                  className={`tap flex min-h-[52px] items-center gap-3 rounded-control border p-2.5 text-left transition-all duration-200 ${
                    selected ? 'border-primary ring-2 ring-primary/30' : 'border-line hover:border-primary/40'
                  }`}
                >
                  <span
                    className="h-9 w-9 shrink-0 rounded-full border border-line"
                    style={{ background: theme.swatch }}
                    aria-hidden="true"
                  />
                  <span className={`text-sm font-medium ${selected ? 'text-t1' : 'text-t2'}`}>
                    {theme.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="section-title">Уведомления</h2>
        <NotificationsAccordion
          status={status}
          error={error}
          busy={pushBusy}
          onToggle={() => void togglePush()}
        />
      </section>

      <section className="space-y-3">
        <h2 className="section-title">Деньги</h2>
        <Accordion
          title="Доход в месяц"
          subtitle="Покажем, сколько остаётся после обязательных платежей"
          testId="income-accordion"
        >
          <IncomeSettings />
        </Accordion>
      </section>

      <section className="space-y-3">
        <h2 className="section-title">Данные</h2>
        <Accordion title="Экспорт данных" subtitle="Скачать CSV / JSON" testId="export-accordion">
          <DataExport />
        </Accordion>
        <Accordion title="Импорт оплат" subtitle="Восстановить историю из CSV-экспорта" testId="import-accordion">
          <div className="space-y-3">
            <p className="text-xs text-t3">
              Импортируются только строки со статусом «Оплачен». Используйте файл, скачанный
              через «Экспорт CSV».
            </p>
            <button
              type="button"
              onClick={() => setImportOpen(true)}
              className="btn btn-secondary w-full text-sm"
            >
              <Upload size={16} aria-hidden="true" /> Импортировать CSV
            </button>
          </div>
        </Accordion>
      </section>

      <section className="space-y-3">
        <h2 className="section-title">Telegram</h2>
        <TelegramSettings />
      </section>

      <section className="space-y-3">
        <h2 className="section-title">Аккаунт</h2>
        <div className="card card-pad">
          <p className="text-xs text-t3">Вы вошли как</p>
          <p className="mt-0.5 break-all text-sm text-t1">{user?.email}</p>
          <button
            type="button"
            onClick={handleLogout}
            className="btn btn-danger mt-3 w-full text-sm"
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
