import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Request, Response } from 'express';
import { prisma } from '../../config/prisma';
import { env } from '../../config/env';
import { AppError } from '../../middlewares/errorHandler';
import { creditsService } from '../credits/credits.service';

type TgMessage = { text?: string; chat?: { id?: number | string; type?: string } };
type TgUpdate = { message?: TgMessage };
const hashCode = (code: string) => createHash('sha256').update(code).digest('hex');

async function callTelegram(method: string, payload: Record<string, unknown>): Promise<void> {
  if (!env.TELEGRAM_BOT_TOKEN) throw new Error('Telegram is not configured');
  const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload), signal: AbortSignal.timeout(10_000),
  });
  const result = await response.json().catch(() => null) as { ok?: boolean; description?: string } | null;
  if (!response.ok || !result?.ok) throw new Error(`Telegram API ${method} failed (HTTP ${response.status}): ${result?.description ?? 'unknown error'}`);
}

export async function sendTelegramToUser(userId: string, payload: { title: string; body: string; url?: string }): Promise<void> {
  try {
    if (!env.TELEGRAM_BOT_TOKEN) return;
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { telegramChatId: true } });
    if (!user?.telegramChatId) return;
    const baseUrl = env.PUBLIC_BASE_URL ? (env.PUBLIC_BASE_URL.endsWith('/') ? env.PUBLIC_BASE_URL.slice(0, -1) : env.PUBLIC_BASE_URL) : '';
    const link = payload.url && baseUrl ? `\n\nОткрыть Credit Tracker: ${baseUrl}${payload.url}` : '';
    await callTelegram('sendMessage', { chat_id: user.telegramChatId, text: `${payload.title}\n${payload.body}${link}`, disable_web_page_preview: true });
  } catch (error) {
    // Telegram must never break the existing push/cron delivery pipeline.
    console.error('[telegram] delivery failed:', (error as Error).message);
  }
}
const sendChat = (chatId: number | string, text: string) => callTelegram('sendMessage', { chat_id: chatId, text, disable_web_page_preview: true });

async function redeemCode(chatId: string, code: string): Promise<string> {
  if (!/^[a-f0-9]{16}$/.test(code)) return 'Код должен состоять из 16 символов a–f и 0–9. Создай новый код в приложении Credit Tracker.';
  try {
    const user = await prisma.$transaction(async (tx) => {
      const link = await tx.telegramLinkCode.findFirst({ where: { codeHash: hashCode(code), usedAt: null, expiresAt: { gt: new Date() } }, select: { id: true, userId: true } });
      if (!link) throw new AppError(400, 'Код недействителен или истёк. Создай новый код в приложении.');
      const claimed = await tx.telegramLinkCode.updateMany({ where: { id: link.id, usedAt: null }, data: { usedAt: new Date() } });
      if (claimed.count !== 1) throw new AppError(400, 'Код уже использован. Создай новый код.');
      return tx.user.update({ where: { id: link.userId }, data: { telegramChatId: chatId }, select: { name: true, email: true } });
    });
    return `Готово! Telegram подключён к ${user.name || user.email}.\n/summary — сводка\n/payments — платежи текущего месяца\n/unlink — отключить.`;
  } catch (error) {
    if ((error as { code?: string }).code === 'P2002') return 'Этот Telegram уже привязан к другому аккаунту Credit Tracker.';
    if (error instanceof AppError) return error.message;
    throw error;
  }
}

async function summaryText(userId: string): Promise<string> {
  const s = await creditsService.summary(userId);
  const money = (n: number | null) => n === null ? 'не задан' : `${n.toLocaleString('ru-RU')} ₽`;
  const lines = ['💳 Credit Tracker — сводка', `Активных долгов: ${s.activeCount}`, `Остаток долга: ${money(s.outstandingSum)}`, `Платежи текущего месяца: ${money(s.monthlyPayments)}`, `Свободно (доход − плановые платежи): ${money(s.freeMoney)}`];
  if (s.graceReplenishTotal > 0) lines.push(`Отдельно для сохранения грейса: ${money(s.graceReplenishTotal)}`);
  return lines.join('\n');
}

async function paymentsText(userId: string): Promise<string> {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const rows = await prisma.paymentSchedule.findMany({
    where: { status: { in: ['PENDING', 'PARTIALLY_PAID'] }, dueDate: { gte: start, lt: end }, credit: { userId, status: 'ACTIVE' } },
    include: { credit: { select: { name: true, type: true, graceReplenishSum: true } } }, orderBy: { dueDate: 'asc' },
  });
  const mandatory = rows.filter((r) => !(r.credit.type === 'CREDIT_CARD' && Number(r.interestPart) === 0 && Number(r.amount) === Number(r.credit.graceReplenishSum)));
  const lines = ['📅 Платежи текущего месяца'];
  if (!mandatory.length) lines.push('Обязательных платежей по графику нет.');
  for (const r of mandatory) lines.push(`• ${r.dueDate.toISOString().slice(0, 10)} — ${r.credit.name}: ${Math.max(0, Number(r.amount) - Number(r.paidAmount ?? 0)).toLocaleString('ru-RU')} ₽`);
  const grace = await prisma.credit.findMany({ where: { userId, status: 'ACTIVE', frozen: true, graceReplenishSum: { not: null } }, select: { name: true, graceReplenishSum: true, nextFreezeCheckAt: true } });
  const graceItems = grace.filter((c) => Number(c.graceReplenishSum) > 0);
  if (graceItems.length) { lines.push('', '⚠️ Отдельно для сохранения грейса (не входит в обязательные платежи):'); for (const c of graceItems) lines.push(`• ${c.name}: ${Number(c.graceReplenishSum).toLocaleString('ru-RU')} ₽${c.nextFreezeCheckAt ? ` — до ${c.nextFreezeCheckAt.toISOString().slice(0, 10)}` : ''}`); }
  return lines.join('\n');
}

async function handleMessage(message: TgMessage): Promise<void> {
  const chat = message.chat;
  if (!chat?.id || chat.type !== 'private' || !message.text) return;
  const [rawCommand, ...args] = message.text.trim().split(/\s+/);
  const command = rawCommand.split('@')[0].toLowerCase();
  const chatId = String(chat.id);
  if (command === '/start' || command === '/help') {
    const linked = await prisma.user.findUnique({ where: { telegramChatId: chatId }, select: { id: true } });
    await sendChat(chat.id, linked ? 'Credit Tracker подключён.\n/summary — сводка\n/payments — платежи текущего месяца\n/unlink — отключить' : 'Привет! Чтобы подключить аккаунт, создай одноразовый код в приложении Credit Tracker и отправь: /link <16-символьный-код>. Код действует 10 минут.'); return;
  }
  if (command === '/link') { await sendChat(chat.id, await redeemCode(chatId, args[0] ?? '')); return; }
  const user = await prisma.user.findUnique({ where: { telegramChatId: chatId }, select: { id: true } });
  if (command === '/unlink') { if (user) await prisma.user.update({ where: { id: user.id }, data: { telegramChatId: null } }); await sendChat(chat.id, user ? 'Telegram отключён от Credit Tracker.' : 'Этот чат не привязан.'); return; }
  if (!user) { await sendChat(chat.id, 'Сначала подключи аккаунт через код: /link <16-символьный-код>.'); return; }
  if (command === '/summary') { await sendChat(chat.id, await summaryText(user.id)); return; }
  if (command === '/payments') { await sendChat(chat.id, await paymentsText(user.id)); return; }
  await sendChat(chat.id, 'Неизвестная команда. Доступно: /summary, /payments, /unlink, /help.');
}

export const telegramService = {
  async createLinkCode(userId: string): Promise<{ code: string; expiresAt: Date }> {
    await prisma.telegramLinkCode.deleteMany({ where: { userId } });
    for (let i = 0; i < 5; i++) {
      const code = randomBytes(8).toString('hex');
      const expiresAt = new Date(Date.now() + 10 * 60_000);
      try { await prisma.telegramLinkCode.create({ data: { userId, codeHash: hashCode(code), expiresAt } }); return { code, expiresAt }; }
      catch (error) { if ((error as { code?: string }).code !== 'P2002') throw error; }
    }
    throw new AppError(503, 'Не удалось создать код привязки. Попробуй ещё раз.');
  },
  async getStatus(userId: string): Promise<{ linked: boolean; configured: boolean }> { const user = await prisma.user.findUnique({ where: { id: userId }, select: { telegramChatId: true } }); return { linked: Boolean(user?.telegramChatId), configured: Boolean(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_WEBHOOK_SECRET && env.PUBLIC_BASE_URL) }; },
  async unlink(userId: string): Promise<void> { await prisma.user.update({ where: { id: userId }, data: { telegramChatId: null } }); await prisma.telegramLinkCode.deleteMany({ where: { userId } }); },
  async webhook(req: Request, res: Response): Promise<void> {
    const supplied = req.header('x-telegram-bot-api-secret-token') ?? '';
    const expected = env.TELEGRAM_WEBHOOK_SECRET ?? '';
    const valid = supplied.length === expected.length && expected.length >= 16 && timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));
    if (!valid) { res.status(401).json({ error: 'Unauthorized' }); return; }
    try { await handleMessage((req.body as TgUpdate).message ?? {}); res.sendStatus(200); }
    catch (error) { console.error('[telegram] update processing failed:', (error as Error).message); res.sendStatus(200); }
  },
  async configureWebhook(): Promise<void> {
    if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_WEBHOOK_SECRET || !env.PUBLIC_BASE_URL) return;
    const baseUrl = env.PUBLIC_BASE_URL.endsWith('/') ? env.PUBLIC_BASE_URL.slice(0, -1) : env.PUBLIC_BASE_URL;
    await callTelegram('setWebhook', { url: `${baseUrl}/api/telegram/webhook`, secret_token: env.TELEGRAM_WEBHOOK_SECRET, allowed_updates: ['message'], drop_pending_updates: false });
    await callTelegram('setMyCommands', { commands: [
      { command: 'start', description: 'Начать работу с Credit Tracker' },
      { command: 'help', description: 'Список команд' },
      { command: 'summary', description: 'Финансовая сводка' },
      { command: 'payments', description: 'Платежи текущего месяца' },
      { command: 'unlink', description: 'Отключить Telegram от аккаунта' },
    ] });
    console.log('[telegram] webhook and command menu configured');
  },
};
