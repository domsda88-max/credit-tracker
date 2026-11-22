import type { Request, Response } from 'express';
import type {
  EarlyRepaymentDto,
  ImportPaymentsDto,
  PayInstallmentDto,
} from './payments.schemas';
import { paymentsService } from './payments.service';

/** Ключ идемпотентности: заголовок приоритетнее тела (офлайн-очередь шлёт оба). */
function idempotencyKey(req: Request, body: { idempotencyKey?: string }): string | undefined {
  const header = req.header('Idempotency-Key');
  return header?.trim() || body.idempotencyKey?.trim() || undefined;
}

export const paymentsController = {
  async cancelPayment(req: Request, res: Response) {
    const result = await paymentsService.cancelPayment(req.user!.sub, req.params.installmentId);
    res.json(result);
  },

  async payInstallment(req: Request, res: Response) {
    const body = req.body as PayInstallmentDto;
    const result = await paymentsService.payInstallment(
      req.user!.sub,
      req.params.installmentId,
      body,
      idempotencyKey(req, body),
    );
    res.json(result);
  },

  async earlyRepayment(req: Request, res: Response) {
    const body = req.body as EarlyRepaymentDto;
    const result = await paymentsService.earlyRepayment(
      req.user!.sub,
      req.params.creditId,
      body,
      idempotencyKey(req, body),
    );
    res.json(result);
  },

  async previewEarlyRepayment(req: Request, res: Response) {
    const result = await paymentsService.previewEarlyRepayment(
      req.user!.sub,
      req.params.creditId,
      req.body as EarlyRepaymentDto,
    );
    res.json(result);
  },

  /** Массовый импорт фактических оплат: частичный успех вместо «всё или ничего». */
  async importPayments(req: Request, res: Response) {
    const result = await paymentsService.importPayments(
      req.user!.sub,
      req.body as ImportPaymentsDto,
    );
    res.json(result);
  },
};
