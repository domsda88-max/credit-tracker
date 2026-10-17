import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env';
import { errorHandler } from './middlewares/errorHandler';
import { authRouter } from './modules/auth/auth.routes';
import { creditsRouter } from './modules/credits/credits.routes';
import { paymentsRouter } from './modules/payments/payments.routes';
import { pushRouter } from './modules/push/push.routes';

/** Сборка Express-приложения (без listen — удобно для тестов). */
export function createApp(): express.Express {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.CLIENT_ORIGIN === '*' ? true : env.CLIENT_ORIGIN }));
  app.use(express.json({ limit: '1mb' }));
  if (env.NODE_ENV === 'development') app.use(morgan('dev'));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/credits', creditsRouter);
  app.use('/api/payments', paymentsRouter);
  app.use('/api/push', pushRouter);

  app.use((_req, res) => res.status(404).json({ error: 'Маршрут не найден' }));
  app.use(errorHandler);

  return app;
}
