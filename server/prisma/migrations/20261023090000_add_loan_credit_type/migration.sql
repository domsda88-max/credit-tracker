-- Новый тип продукта: частный заём (без графика платежей и минимального платежа).
ALTER TYPE "CreditType" ADD VALUE IF NOT EXISTS 'LOAN';
