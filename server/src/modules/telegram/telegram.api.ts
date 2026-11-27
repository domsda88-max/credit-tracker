export interface TelegramUser {
  id: number;
  is_bot?: boolean;
  first_name?: string;
  last_name?: string;
  username?: string;
}

export interface TelegramChat {
  id: number;
  type: string;
}

export interface TelegramMessage {
  message_id: number;
  chat: TelegramChat;
  from?: TelegramUser;
  text?: string;
}

export interface TelegramCallbackQuery {
  id: string;
  from: TelegramUser;
  message?: TelegramMessage;
  data?: string;
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
}

export interface InlineKeyboardButton {
  text: string;
  callback_data: string;
}

export interface InlineKeyboardMarkup {
  inline_keyboard: InlineKeyboardButton[][];
}

interface TelegramResponse<T> {
  ok: boolean;
  result: T;
  description?: string;
}

export class TelegramApi {
  constructor(private readonly token: string) {}

  private async call<T>(method: string, body: Record<string, unknown>): Promise<T> {
    const response = await fetch('https://api.telegram.org/bot' + this.token + '/' + method, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      throw new Error('Telegram HTTP error: ' + response.status);
    }

    const payload = (await response.json()) as TelegramResponse<T>;
    if (!payload.ok) {
      throw new Error('Telegram API error: ' + (payload.description ?? 'unknown error'));
    }
    return payload.result;
  }

  getUpdates(offset?: number): Promise<TelegramUpdate[]> {
    return this.call<TelegramUpdate[]>('getUpdates', {
      ...(offset !== undefined ? { offset } : {}),
      timeout: 20,
      allowed_updates: ['message', 'callback_query'],
    });
  }

  sendMessage(
    chatId: number,
    text: string,
    replyMarkup?: InlineKeyboardMarkup,
  ): Promise<TelegramMessage> {
    return this.call<TelegramMessage>('sendMessage', {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
    });
  }

  answerCallbackQuery(callbackQueryId: string, text?: string): Promise<boolean> {
    return this.call<boolean>('answerCallbackQuery', {
      callback_query_id: callbackQueryId,
      ...(text ? { text } : {}),
    });
  }
}
