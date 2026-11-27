import { useEffect, useState } from 'react';
import { extractErrorMessage } from '../api/client';
import { telegramApi } from '../api/telegram';

export function TelegramSettings() {
  const [linked, setLinked] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    telegramApi.status().then((result) => { if (active) { setLinked(result.linked); setConfigured(result.configured); } })
      .catch((e: unknown) => { if (active) setError(extractErrorMessage(e)); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, []);
  const createCode = async () => {
    setBusy(true); setError(null); setCode(null);
    try { const result = await telegramApi.createLinkCode(); setCode(result.code); setExpiresAt(result.expiresAt); }
    catch (e) { setError(extractErrorMessage(e)); }
    finally { setBusy(false); }
  };
  const unlink = async () => {
    setBusy(true); setError(null);
    try { await telegramApi.unlink(); setLinked(false); setCode(null); }
    catch (e) { setError(extractErrorMessage(e)); }
    finally { setBusy(false); }
  };
  return (
    <div className="card card-pad space-y-3">
      <div>
        <p className="font-semibold text-t1">Уведомления и управление через Telegram</p>
        <p className="mt-1 text-xs text-t3">Бот отправляет напоминания о платежах и мотивационные сообщения. Команды /summary и /payments показывают данные твоего аккаунта.</p>
      </div>
      {busy && <p className="text-xs text-t3">Проверяем подключение…</p>}
      {!busy && !configured && <p className="text-xs text-warning-fg">Бот ещё не настроен на сервере. Сначала добавь токен и webhook secret в Render Secrets.</p>}
      {!busy && linked && <p className="text-sm text-success-fg">Telegram подключён к аккаунту.</p>}
      {!busy && !linked && <p className="text-sm text-t2">Telegram пока не подключён.</p>}
      {code && <div className="rounded-control border border-line bg-surface2 p-3">
        <p className="text-xs text-t3">Отправь боту эту команду (код действует 10 минут):</p>
        <p className="mt-1 break-all font-mono text-sm text-t1">/link {code}</p>
        <p className="mt-1 text-xs text-t3">Истекает: {new Date(expiresAt ?? '').toLocaleTimeString()}</p>
        <button type="button" className="btn btn-secondary mt-2 w-full text-sm" onClick={() => void navigator.clipboard?.writeText(`/link ${code}`)}>Скопировать команду</button>
      </div>}
      {error && <p role="alert" className="text-xs text-danger-fg">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <a className="btn btn-secondary flex-1 text-center text-sm" href="https://t.me/MyCreditTrackerBot" target="_blank" rel="noreferrer">Открыть бота</a>
        {!linked && <button type="button" className="btn btn-primary flex-1 text-sm" disabled={busy || !configured} onClick={() => void createCode()}>Создать код</button>}
        {linked && <button type="button" className="btn btn-danger flex-1 text-sm" disabled={busy} onClick={() => void unlink()}>Отключить</button>}
      </div>
    </div>
  );
}
