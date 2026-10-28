-- Время и частота мотивационной рассылки
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "motivationTime" TEXT DEFAULT '09:30';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "motivationPerDay" INTEGER DEFAULT 1;
