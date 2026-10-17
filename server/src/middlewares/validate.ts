import type { NextFunction, Request, Response } from 'express';
import type { ZodTypeAny } from 'zod';
import { AppError } from './errorHandler';

/**
 * Валидация тела запроса zod-схемой.
 * При ошибке возвращает 400 со списком конкретных проблем,
 * при успехе — заменяет req.body на провалидированные (и приведённые) данные.
 */
export const validate =
  (schema: ZodTypeAny) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const issues = result.error.issues
        .map((issue) => `${issue.path.join('.') || 'body'}: ${issue.message}`)
        .join('; ');
      next(new AppError(400, `Некорректные данные — ${issues}`));
      return;
    }

    req.body = result.data;
    next();
  };
