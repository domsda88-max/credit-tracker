import type { Request, Response } from 'express';
import type { EarlyRepaymentDto, PayInstallmentDto } from './payments.schemas';
import { paymentsService } from './payments.service';

export const paymentsController = {
  async payInstallment(req: Request, res: Response) {
    const result = await paymentsService.payInstallment(
      req.user!.sub,
      req.params.installmentId,
      req.body as PayInstallmentDto,
    );
    res.json(result);
  },

  async earlyRepayment(req: Request, res: Response) {
    const result = await paymentsService.earlyRepayment(
      req.user!.sub,
      req.params.creditId,
      req.body as EarlyRepaymentDto,
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
};
