-- CreateEnum
CREATE TYPE "CreditType" AS ENUM ('CREDIT_CARD', 'CONSUMER', 'MORTGAGE', 'INSTALLMENT', 'MICROLOAN');

-- CreateEnum
CREATE TYPE "PaymentType" AS ENUM ('ANNUITY', 'DIFFERENTIAL', 'MIN_PAYMENT');

-- CreateEnum
CREATE TYPE "PrepaymentMode" AS ENUM ('REDUCE_TERM', 'REDUCE_PAYMENT');

-- CreateEnum
CREATE TYPE "CreditStatus" AS ENUM ('ACTIVE', 'CLOSED');

-- CreateEnum
CREATE TYPE "InstallmentStatus" AS ENUM ('PENDING', 'PAID', 'OVERDUE');

-- CreateEnum
CREATE TYPE "PaymentEventKind" AS ENUM ('SCHEDULED', 'EARLY_PARTIAL', 'EARLY_FULL', 'MIN_PAYMENT');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Moscow',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Credit" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "CreditType" NOT NULL,
    "paymentType" "PaymentType" NOT NULL,
    "prepaymentMode" "PrepaymentMode" NOT NULL DEFAULT 'REDUCE_PAYMENT',
    "principal" DECIMAL(12,2) NOT NULL,
    "outstanding" DECIMAL(12,2) NOT NULL,
    "annualRate" DECIMAL(5,2) NOT NULL,
    "startDate" DATE NOT NULL,
    "termMonths" INTEGER NOT NULL,
    "paymentDay" INTEGER,
    "minPayment" DECIMAL(12,2),
    "gracePeriodEnds" DATE,
    "graceReplenishSum" DECIMAL(12,2),
    "graceReplenishDay" INTEGER,
    "frozen" BOOLEAN NOT NULL DEFAULT false,
    "freezeCycleDays" INTEGER,
    "freezeStartedAt" TIMESTAMP(3),
    "nextFreezeCheckAt" TIMESTAMP(3),
    "status" "CreditStatus" NOT NULL DEFAULT 'ACTIVE',
    "closedAt" TIMESTAMP(3),
    "totalPaid" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Credit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentSchedule" (
    "id" TEXT NOT NULL,
    "creditId" TEXT NOT NULL,
    "dueDate" DATE NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "principalPart" DECIMAL(12,2) NOT NULL,
    "interestPart" DECIMAL(12,2) NOT NULL,
    "status" "InstallmentStatus" NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),
    "paidAmount" DECIMAL(12,2),

    CONSTRAINT "PaymentSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentEvent" (
    "id" TEXT NOT NULL,
    "creditId" TEXT NOT NULL,
    "kind" "PaymentEventKind" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "creditId" TEXT,
    "type" TEXT NOT NULL,
    "dedupKey" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Credit_userId_status_idx" ON "Credit"("userId", "status");

-- CreateIndex
CREATE INDEX "PaymentSchedule_dueDate_status_idx" ON "PaymentSchedule"("dueDate", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentSchedule_creditId_dueDate_key" ON "PaymentSchedule"("creditId", "dueDate");

-- CreateIndex
CREATE INDEX "PaymentEvent_creditId_paidAt_idx" ON "PaymentEvent"("creditId", "paidAt");

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");

-- CreateIndex
CREATE INDEX "PushSubscription_userId_idx" ON "PushSubscription"("userId");

-- CreateIndex
CREATE INDEX "NotificationLog_userId_sentAt_idx" ON "NotificationLog"("userId", "sentAt");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationLog_dedupKey_key" ON "NotificationLog"("dedupKey");

-- AddForeignKey
ALTER TABLE "Credit" ADD CONSTRAINT "Credit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentSchedule" ADD CONSTRAINT "PaymentSchedule_creditId_fkey" FOREIGN KEY ("creditId") REFERENCES "Credit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentEvent" ADD CONSTRAINT "PaymentEvent_creditId_fkey" FOREIGN KEY ("creditId") REFERENCES "Credit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_creditId_fkey" FOREIGN KEY ("creditId") REFERENCES "Credit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
