import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth';
import { asyncHandler } from '../../middlewares/errorHandler';
import { telegramController } from './telegram.controller';
export const telegramRouter = Router();
telegramRouter.post('/webhook', asyncHandler(telegramController.webhook));
telegramRouter.get('/status', requireAuth, asyncHandler(telegramController.status));
telegramRouter.post('/link-code', requireAuth, asyncHandler(telegramController.createLinkCode));
telegramRouter.delete('/link', requireAuth, asyncHandler(telegramController.unlink));
