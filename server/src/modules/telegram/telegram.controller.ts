import type { Request, Response } from 'express';
import { telegramService } from './telegram.service';
export const telegramController = {
  async createLinkCode(req: Request, res: Response) { const result = await telegramService.createLinkCode(req.user!.sub); res.status(201).json({ ...result, instructions: `Отправь боту команду /link ${result.code}. Код действует 10 минут.` }); },
  async status(req: Request, res: Response) { res.json(await telegramService.getStatus(req.user!.sub)); },
  async unlink(req: Request, res: Response) { await telegramService.unlink(req.user!.sub); res.json({ ok: true }); },
  async webhook(req: Request, res: Response) { await telegramService.webhook(req, res); },
};
