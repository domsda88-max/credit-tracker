import cors from 'cors';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
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

  // Клиент (React SPA) отдаётся с того же домена, что и API:
  // нет CORS, нет отдельного статик-сайта и нет переменной VITE_API_URL.
  const clientDist = path.resolve(__dirname, '../../client/dist');
  if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist, { index: false, maxAge: '1h' }));
    app.get(/^\/(?!api\/).*/, (_req, res) => {
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  }

  app.use((_req, res) => res.status(404).json({ error: 'Маршрут не найден' }));
  app.use(errorHandler);

  return app;
}
