import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth';
import { asyncHandler } from '../../middlewares/errorHandler';
import { validate } from '../../middlewares/validate';
import { creditsController } from './credits.controller';
import { createCreditSchema, toggleFreezeSchema, updateCreditSchema } from './credits.schemas';

export const creditsRouter = Router();

creditsRouter.use(requireAuth);

creditsRouter.get('/', asyncHandler(creditsController.list));
creditsRouter.get('/summary', asyncHandler(creditsController.summary));
creditsRouter.post('/', validate(createCreditSchema), asyncHandler(creditsController.create));
creditsRouter.get('/:id', asyncHandler(creditsController.getById));
creditsRouter.put('/:id', validate(updateCreditSchema), asyncHandler(creditsController.update));
creditsRouter.post(
  '/:id/freeze',
  validate(toggleFreezeSchema),
  asyncHandler(creditsController.toggleFreeze),
);
creditsRouter.delete('/:id', asyncHandler(creditsController.remove));
