-- Частичная оплата, отдельный учёт переплаты и аудит отклонённых отмен.
-- Не изменяет реальные данные и не запускается автоматически в этой смене.

ALTER TYPE "InstallmentStatus" ADD VALUE IF NOT EXISTS 'PARTIALLY_PAID';
ALTER TYPE "PaymentEventKind" ADD VALUE IF NOT EXISTS 'OVERPAYMENT';

ALTER TABLE "Credit"
    ADD COLUMN "overpaymentBalance" DECIMAL(12,2) NOT NULL DEFAULT 0;

ALTER TABLE "PaymentSchedule"
    ADD COLUMN "paidPrincipalPart" DECIMAL(12,2),
    ADD COLUMN "paidInterestPart" DECIMAL(12,2),
    ADD COLUMN "paidOverpayment" DECIMAL(12,2);

ALTER TABLE "PaymentEvent"
    ADD COLUMN "scheduleId" TEXT,
    ADD COLUMN "cancelledAt" TIMESTAMP(3),
    ADD COLUMN "idempotencyKey" TEXT;

CREATE INDEX "PaymentEvent_scheduleId_cancelledAt_idx" ON "PaymentEvent"("scheduleId", "cancelledAt");
CREATE UNIQUE INDEX "PaymentEvent_idempotencyKey_key" ON "PaymentEvent"("idempotencyKey");

ALTER TABLE "PaymentEvent"
    ADD CONSTRAINT "PaymentEvent_scheduleId_fkey"
    FOREIGN KEY ("scheduleId") REFERENCES "PaymentSchedule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "creditId" TEXT NOT NULL,
    "installmentId" TEXT,
    "kind" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "dedupKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AuditEvent_dedupKey_key" UNIQUE ("dedupKey")
);

CREATE INDEX "AuditEvent_userId_createdAt_idx" ON "AuditEvent"("userId", "createdAt");
