import type { Request, Response } from 'express';
import type { LoginDto, RegisterDto } from './auth.schemas';
import { authService } from './auth.service';

export const authController = {
  async register(req: Request, res: Response) {
    const result = await authService.register(req.body as RegisterDto);
    res.status(201).json(result);
  },

  async login(req: Request, res: Response) {
    const result = await authService.login(req.body as LoginDto);
    res.json(result);
  },

  async me(req: Request, res: Response) {
    const result = await authService.getMe(req.user!.sub);
    res.json(result);
  },
};
