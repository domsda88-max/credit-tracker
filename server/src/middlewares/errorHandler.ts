import type { NextFunction, Request, Response } from 'express';

/** Ошибка с HTTP-статусом — бросается в сервисах, ловится errorHandler'ом. */
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

/** Обёртка для async-хендлеров: убирает try/catch из контроллеров. */
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

/** Последний middleware в цепочке: приводит любые ошибки к JSON-ответу. */
export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }

  console.error('[error]', err);
  res.status(500).json({ error: 'Внутренняя ошибка сервера' });
}
