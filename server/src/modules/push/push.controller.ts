import type { Request, Response } from 'express';
import type { SubscribeDto, UnsubscribeDto } from './push.schemas';
import { pushService } from './push.service';

export const pushController = {
  /** Публичный VAPID-ключ для подписки браузера. */
  async publicKey(_req: Request, res: Response) {
    res.json({ publicKey: pushService.getPublicKey() });
  },

  async subscribe(req: Request, res: Response) {
    const dto = req.body as SubscribeDto;
    const subscription = await pushService.saveSubscription(
      req.user!.sub,
      dto,
      req.headers['user-agent'],
    );
    res.status(201).json({ id: subscription.id, endpoint: subscription.endpoint });
  },

  async unsubscribe(req: Request, res: Response) {
    const dto = req.body as UnsubscribeDto;
    await pushService.removeSubscription(req.user!.sub, dto.endpoint);
    res.status(204).send();
  },
};
