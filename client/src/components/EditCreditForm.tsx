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
  prepaymentMode: z.enum(['REDUCE_TERM', 'REDUCE_PAYMENT']),
  outstanding: optionalNumber(0, Number.MAX_SAFE_INTEGER),
});

type FormValues = z.input<typeof schema>;

const inputClass =
  'mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-slate-100 outline-none transition focus:border-sky-500';

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
      prepaymentMode: credit.prepaymentMode,
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
        prepaymentMode: parsed.prepaymentMode,
        outstanding: parsed.outstanding ?? null,
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
    <section className="rounded-2xl border border-sky-500/30 bg-sky-500/5 p-4">
      <h2 className="font-medium text-slate-100">Изменить кредит</h2>
      <p className="mt-0.5 text-xs text-slate-500">
        Если меняются сумма, ставка, дата или срок — график пересчитается заново
      </p>

      <form
        onSubmit={handleSubmit((values) => mutation.mutate(values))}
        className="mt-4 space-y-4"
      >
        <label className="block">
          <span className="text-sm text-slate-400">Название</span>
          <input {...register('name')} className={inputClass} />
          {errors.name && <p className="mt-1 text-xs text-rose-400">{errors.name.message}</p>}
        </label>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm text-slate-400">Сумма долга, ₽</span>
            <input type="number" step="0.01" inputMode="decimal" {...register('principal')} className={inputClass} />
            {errors.principal && (
              <p className="mt-1 text-xs text-rose-400">{errors.principal.message}</p>
            )}
          </label>

          <label className="block">
            <span className="text-sm text-slate-400">Ставка, % годовых</span>
            <input type="number" step="0.01" inputMode="decimal" {...register('annualRate')} className={inputClass} />
            {errors.annualRate && (
              <p className="mt-1 text-xs text-rose-400">{errors.annualRate.message}</p>
            )}
          </label>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <label className="block">
            <span className="text-sm text-slate-400">Дата выдачи</span>
            <input type="date" {...register('startDate')} className={inputClass} />
            {errors.startDate && (
              <p className="mt-1 text-xs text-rose-400">{errors.startDate.message}</p>
            )}
          </label>

          <label className="block">
            <span className="text-sm text-slate-400">Срок, месяцев</span>
            <input type="number" inputMode="numeric" {...register('termMonths')} className={inputClass} />
            {errors.termMonths && (
              <p className="mt-1 text-xs text-rose-400">{errors.termMonths.message}</p>
            )}
          </label>

          <label className="block">
            <span className="text-sm text-slate-400">День платежа</span>
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
              <p className="mt-1 text-xs text-rose-400">{errors.paymentDay.message}</p>
            )}
          </label>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm text-slate-400">Режим досрочного погашения</span>
            <select {...register('prepaymentMode')} className={inputClass}>
              <option value="REDUCE_PAYMENT">Уменьшать платёж</option>
              <option value="REDUCE_TERM">Сокращать срок</option>
            </select>
          </label>

          <label className="block">
            <span className="text-sm text-slate-400">
              Остаток долга сейчас, ₽ <span className="text-xs text-slate-500">необязательно</span>
            </span>
            <input
              type="number"
              step="0.01"
              inputMode="decimal"
              placeholder={`сейчас ${Number(credit.outstanding).toLocaleString('ru-RU')}`}
              {...register('outstanding')}
              className={inputClass}
            />
            <span className="mt-1 block text-xs text-slate-500">
              Оставьте пустым — рассчитаю сам. Заполните, чтобы точно совпадало с приложением банка.
            </span>
            {errors.outstanding && (
              <p className="mt-1 text-xs text-rose-400">{errors.outstanding.message}</p>
            )}
          </label>
        </div>

        {error && <p className="text-sm text-rose-400">{error}</p>}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={mutation.isPending}
            className="rounded-xl bg-sky-500 px-4 py-2.5 font-medium text-slate-950 transition hover:bg-sky-400 disabled:opacity-50"
          >
            {mutation.isPending ? 'Сохраняю…' : 'Сохранить изменения'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-700 px-4 py-2.5 text-slate-300 transition hover:border-slate-500"
          >
            Отмена
          </button>
        </div>
      </form>
    </section>
  );
}
