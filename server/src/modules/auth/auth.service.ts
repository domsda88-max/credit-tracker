import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env';
import { prisma } from '../../config/prisma';
import { AppError } from '../../middlewares/errorHandler';
import type { LoginDto, RegisterDto, UpdateSettingsDto } from './auth.schemas';

const publicUserSelect = {
  id: true,
  email: true,
  name: true,
  timezone: true,
  reminderHour: true,
  leadDaysList: true,
  motivationEnabled: true,
  motivationDay: true,
  motivationTime: true,
  motivationPerDay: true,
  monthlyIncome: true,
} as const;

function signToken(userId: string, email: string): string {
  return jwt.sign({ email }, env.JWT_SECRET, {
    subject: userId,
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
}

export const authService = {
  async register(dto: RegisterDto) {
    const existing = await prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new AppError(409, 'Пользователь с таким email уже существует');

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await prisma.user.create({
      data: { email: dto.email, passwordHash, name: dto.name },
      select: publicUserSelect,
    });

    return { user, token: signToken(user.id, user.email) };
  },

  async login(dto: LoginDto) {
    const user = await prisma.user.findUnique({ where: { email: dto.email } });
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new AppError(401, 'Неверный email или пароль');
    }

    const { passwordHash: _passwordHash, ...publicUser } = user;
    return { user: publicUser, token: signToken(user.id, user.email) };
  },

  async getMe(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: publicUserSelect });
    if (!user) throw new AppError(404, 'Пользователь не найден');
    return user;
  },

  /** Обновление настроек напоминаний (часовой пояс, час дайджеста, за сколько дней предупреждать). */
  async updateSettings(userId: string, dto: UpdateSettingsDto) {
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        timezone: dto.timezone,
        reminderHour: dto.reminderHour,
        leadDaysList: dto.leadDaysList,
        ...(dto.motivationEnabled !== undefined ? { motivationEnabled: dto.motivationEnabled } : {}),
        ...(dto.motivationTime !== undefined ? { motivationTime: dto.motivationTime } : {}),
        ...(dto.motivationPerDay !== undefined ? { motivationPerDay: dto.motivationPerDay } : {}),
        ...(dto.monthlyIncome !== undefined ? { monthlyIncome: dto.monthlyIncome } : {}),
      },
      select: publicUserSelect,
    });
    return user;
  },
};
