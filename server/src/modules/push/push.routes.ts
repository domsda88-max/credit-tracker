import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth';
import { asyncHandler } from '../../middlewares/errorHandler';
import { validate } from '../../middlewares/validate';
import { pushController } from './push.controller';
import { subscribeSchema, unsubscribeSchema } from './push.schemas';

export const pushRouter = Router();

// Публичный — нужен до/во время регистрации Service Worker.
pushRouter.get('/vapid-public-key', asyncHandler(pushController.publicKey));

pushRouter.post('/subscribe', requireAuth, validate(subscribeSchema), asyncHandler(pushController.subscribe));
pushRouter.delete('/subscribe', requireAuth, validate(unsubscribeSchema), asyncHandler(pushController.unsubscribe));
