-- Ежедневная мотивационная рассылка (9:30 по локальному времени пользователя).
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "motivationEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "motivationDay" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "motivationSentOn" DATE;
