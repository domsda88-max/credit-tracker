import type { Request, Response } from 'express';
import type { CreateCreditDto, ToggleFreezeDto, UpdateCreditDto } from './credits.schemas';
import { creditsService } from './credits.service';

export const creditsController = {
  async list(req: Request, res: Response) {
    res.json(await creditsService.list(req.user!.sub));
  },

  async summary(req: Request, res: Response) {
    const extra = Number(req.query.extra);
    res.json(await creditsService.summary(req.user!.sub, Number.isFinite(extra) && extra > 0 ? extra : undefined));
  },

  async exportData(req: Request, res: Response) {
    res.json(await creditsService.exportData(req.user!.sub));
  },

  async create(req: Request, res: Response) {
    const credit = await creditsService.create(req.user!.sub, req.body as CreateCreditDto);
    res.status(201).json(credit);
  },

  async getById(req: Request, res: Response) {
    res.json(await creditsService.getById(req.user!.sub, req.params.id));
  },

  async update(req: Request, res: Response) {
    res.json(await creditsService.update(req.user!.sub, req.params.id, req.body as UpdateCreditDto));
  },

  async toggleFreeze(req: Request, res: Response) {
    res.json(
      await creditsService.toggleFreeze(req.user!.sub, req.params.id, req.body as ToggleFreezeDto),
    );
  },

  async renewFreezeCycle(req: Request, res: Response) {
    res.json(await creditsService.renewFreezeCycle(req.user!.sub, req.params.id));
  },

  async remove(req: Request, res: Response) {
    await creditsService.remove(req.user!.sub, req.params.id);
    res.status(204).send();
  },
};
