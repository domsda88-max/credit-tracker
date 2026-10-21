import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth';
import { asyncHandler } from '../../middlewares/errorHandler';
import { validate } from '../../middlewares/validate';
import { authController } from './auth.controller';
import { loginSchema, registerSchema, updateSettingsSchema } from './auth.schemas';

export const authRouter = Router();

authRouter.post('/register', validate(registerSchema), asyncHandler(authController.register));
authRouter.post('/login', validate(loginSchema), asyncHandler(authController.login));
authRouter.get('/me', requireAuth, asyncHandler(authController.me));
authRouter.put(
  '/settings',
  requireAuth,
  validate(updateSettingsSchema),
  asyncHandler(authController.updateSettings),
);
