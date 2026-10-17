import { PrismaClient } from '@prisma/client';

/**
 * Единый экземпляр PrismaClient на всё приложение
 * (в dev tsx watch перезапускает процесс, поэтому кэшируем в globalThis).
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
