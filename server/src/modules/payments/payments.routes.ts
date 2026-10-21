import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth';
import { asyncHandler } from '../../middlewares/errorHandler';
import { validate } from '../../middlewares/validate';
import { paymentsController } from './payments.controller';
import { earlyRepaymentSchema, payInstallmentSchema } from './payments.schemas';

export const paymentsRouter = Router();

paymentsRouter.use(requireAuth);

/** «Я оплатил» — отметить конкретный платёж графика (можно с фактической суммой и датой). */
paymentsRouter.post(
  '/installments/:installmentId/pay',
  validate(payInstallmentSchema),
  asyncHandler(paymentsController.payInstallment),
);

/** Досрочное погашение по кредиту (частичное или полное). */
paymentsRouter.post(
  '/credits/:creditId/early-repayment',
  validate(earlyRepaymentSchema),
  asyncHandler(paymentsController.earlyRepayment),
);

/** Предпросмотр досрочного погашения: экономия процентов и срока (без записи). */
paymentsRouter.post(
  '/credits/:creditId/early-preview',
  validate(earlyRepaymentSchema),
  asyncHandler(paymentsController.previewEarlyRepayment),
);
