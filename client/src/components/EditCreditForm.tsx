import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { extractErrorMessage } from '../api/client';
import { creditsApi } from '../api/credits';
import type { CreditDetail } from '../types';

/** Необязательное числовое поле: '' → undefined (иначе coerce('') даёт 0). */
const optionalNumber = (min: number, max: number) =>
  z
    .union([z.literal(''), z.coerce.number()])
    .optional()
    .transform((v) => (v === '' || v == null ? undefined : v))
    .refine((v) => v === undefined || (v >= min && v <= max), {
      message: `Значение от ${min} до ${max}`,
    });

const schema = z.object({
  name: z.string().min(1, 'Укажите название'),
  principal: z.coerce.number().positive('Сумма должна быть больше 0'),
  annualRate: z.coerce.number().min(0).max(100),
  startDate: z.string().min(1, 'Укажите дату выдачи'),
  termMonths: z.coerce.number().int().min(1, 'Минимум 1 месяц').max(600),
  paymentDay: optionalNumber(1, 31),
  outstanding: optionalNumber(0, Number.MAX_SAFE_INTEGER),
  markPastAsPaid: z.boolean().default(false),
});

type FormValues = z.input<typeof schema>;

const inputClass =
  'mt-1 w-full rounded-control border border-line bg-surface px-3 py-2.5 text-t1 outline-none transition focus:border-primary';

/** Дату из ISO переводим в формат <input type="date">. */
const toDateInput = (iso: string) => new Date(iso).toISOString().slice(0, 10);

export function EditCreditForm({
  credit,
  onClose,
}: {
  credit: CreditDetail;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: credit.name,
      principal: Number(credit.principal),
      annualRate: Number(credit.annualRate),
      startDate: toDateInput(credit.startDate),
      termMonths: credit.termMonths,
      paymentDay: credit.paymentDay ?? undefined,
      // Пусто = «посчитай сам». Заполняем только если пользователь вводит вручную.
      outstanding: undefined,
    },
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const parsed = schema.parse(values);
      return creditsApi.update(credit.id, {
        name: parsed.name,
        principal: parsed.principal,
        annualRate: parsed.annualRate,
        startDate: new Date(parsed.startDate).toISOString(),
        termMonths: parsed.termMonths,
        paymentDay: parsed.paymentDay ?? null,
        outstanding: parsed.outstanding ?? null,
        markPastAsPaid: parsed.markPastAsPaid,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['credit', credit.id] });
      await queryClient.invalidateQueries({ queryKey: ['credits'] });
      onClose();
    },
    onError: (err) => setError(extractErrorMessage(err)),
  });

  return (
    <section className="rounded-card border border-primary/30 bg-primary/5 p-4">
      <h2 className="font-medium text-t1">Изменить кредит</h2>
      <p className="mt-0.5 text-xs text-t3">
        Если меняются сумма, ставка, дата или срок — график пересчитается заново
      </p>

      <form
        onSubmit={handleSubmit((values) => mutation.mutate(values))}
        className="mt-4 space-y-4"
      >
        <label className="block">
          <span className="text-sm text-t2">Название</span>
          <input {...register('name')} className={inputClass} />
          {errors.name && <p className="mt-1 text-xs text-danger">{errors.name.message}</p>}
        </label>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm text-t2">Сумма долга, ₽</span>
            <input type="number" step="0.01" inputMode="decimal" {...register('principal')} className={inputClass} />
            {errors.principal && (
              <p className="mt-1 text-xs text-danger">{errors.principal.message}</p>
            )}
          </label>

          <label className="block">
            <span className="text-sm text-t2">Ставка, % годовых</span>
            <input type="number" step="0.01" inputMode="decimal" {...register('annualRate')} className={inputClass} />
            {errors.annualRate && (
              <p className="mt-1 text-xs text-danger">{errors.annualRate.message}</p>
            )}
          </label>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <label className="block">
            <span className="text-sm text-t2">Дата выдачи</span>
            <input type="date" {...register('startDate')} className={inputClass} />
            {errors.startDate && (
              <p className="mt-1 text-xs text-danger">{errors.startDate.message}</p>
            )}
          </label>

          <label className="block">
            <span className="text-sm text-t2">Срок, месяцев</span>
            <input type="number" inputMode="numeric" {...register('termMonths')} className={inputClass} />
            {errors.termMonths && (
              <p className="mt-1 text-xs text-danger">{errors.termMonths.message}</p>
            )}
          </label>

          <label className="block">
            <span className="text-sm text-t2">День платежа</span>
            <input
              type="number"
              min={1}
              max={31}
              inputMode="numeric"
              placeholder="напр. 20"
              {...register('paymentDay')}
              className={inputClass}
            />
            {errors.paymentDay && (
              <p className="mt-1 text-xs text-danger">{errors.paymentDay.message}</p>
            )}
          </label>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

          <label className="block">
            <span className="text-sm text-t2">
              Остаток долга сейчас, ₽ <span className="text-xs text-t3">необязательно</span>
            </span>
            <input
              type="number"
              step="0.01"
              inputMode="decimal"
              placeholder={`сейчас ${Number(credit.outstanding).toLocaleString('ru-RU')}`}
              {...register('outstanding')}
              className={inputClass}
            />
            <span className="mt-1 block text-xs text-t3">
              Оставьте пустым — рассчитаю сам. Заполните, чтобы точно совпадало с приложением банка.
            </span>
            {errors.outstanding && (
              <p className="mt-1 text-xs text-danger">{errors.outstanding.message}</p>
            )}
          </label>
        </div>

        <div className="space-y-3 rounded-card border border-success/30 bg-success/5 p-4">
        <label className="flex items-start gap-2 text-sm text-t2">
          <input type="checkbox" {...register('markPastAsPaid')} className="mt-0.5 h-4 w-4 shrink-0 accent-success" />
          <span>
            Кредит оформлен раньше — платежи, срок которых уже прошёл, считать внесёнными
            <span className="mt-0.5 block text-xs text-t3">
              Снять галочку, если прошедшие платежи НЕ внесены — иначе система сама отметит их оплаченными.
            </span>
          </span>
        </label>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="submit"
            disabled={mutation.isPending}
            className="inline-flex w-full items-center justify-center gap-2 whitespace-normal rounded-control bg-primary px-5 py-2.5 font-medium text-white disabled:opacity-70 sm:w-auto"
          >
            {mutation.isPending ? (<><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />…</>) : 'Сохранить изменения'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-control border border-line px-4 py-2.5 text-t2 transition hover:border-slate-500"
          >
            Отмена
          </button>
        </div>
      </form>
    </section>
  );
}
