import { Router } from 'express';
import { env } from '../../config/env';
import { prisma } from '../../config/prisma';
import { reseedCredits } from './reseed.data';

/**
 * Служебные маршруты. Активируются только если задан ADMIN_RESET_SECRET.
 * Секрет передаётся заголовком `x-admin-secret`.
 *
 * ВАЖНО: это временный инструмент для разового пересоздания данных
 * на Render (где нет Shell). После использования маршрут удаляется.
 */
export const adminRouter = Router();

adminRouter.use((req, res, next) => {
  if (!env.ADMIN_RESET_SECRET) {
    return res.status(404).json({ error: 'Маршрут не найден' });
  }
  const provided = req.header('x-admin-secret');
  if (provided !== env.ADMIN_RESET_SECRET) {
    return res.status(401).json({ error: 'Неверный секрет' });
  }
  next();
});

/**
 * POST /api/admin/reseed — удалить все кредиты пользователя и создать заново
 * по таблице. Тело необязательно: { email }.
 */
adminRouter.post('/reseed', async (req, res, next) => {
  try {
    const email = typeof req.body?.email === 'string' ? req.body.email : undefined;
    const result = await reseedCredits(prisma, email);
    res.json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
});
