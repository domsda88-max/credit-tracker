import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { extractErrorMessage } from '../api/client';
import { creditsApi } from '../api/credits';

/** Схема формы. Числа приходят строками из input → coerce. */
const schema = z.object({
  name: z.string().min(1, 'Укажите название банка или продукта'),
  type: z.enum(['CREDIT_CARD', 'CONSUMER', 'MORTGAGE', 'INSTALLMENT', 'MICROLOAN']),
  paymentType: z.enum(['ANNUITY', 'DIFFERENTIAL', 'MIN_PAYMENT']),
  prepaymentMode: z.enum(['REDUCE_TERM', 'REDUCE_PAYMENT']),
  principal: z.coerce.number().positive('Сумма должна быть больше 0'),
  annualRate: z.coerce.number().min(0).max(100),
  startDate: z.string().min(1, 'Укажите дату выдачи'),
  termMonths: z.coerce.number().int().min(1, 'Минимум 1 месяц').max(600),
  paymentDay: z.coerce.number().int().min(1).max(31).optional(),
  minPayment: z.coerce.number().min(0).optional(),
  gracePeriodEnds: z.string().optional(),
  graceReplenishSum: z.coerce.number().min(0).optional(),
  graceReplenishDay: z.coerce.number().int().min(1).max(31).optional(),
  frozen: z.boolean().default(false),
  freezeCycleDays: z.coerce.number().int().min(1).max(365).optional().nullable(),
});

type FormValues = z.input<typeof schema>;

const inputClass =
  'mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-slate-100 outline-none transition focus:border-sky-500';

export function AddCreditPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      type: 'CONSUMER',
      paymentType: 'ANNUITY',
      prepaymentMode: 'REDUCE_PAYMENT',
      frozen: false,
    },
  });

  const paymentType = watch('paymentType');
  const isCard = paymentType === 'MIN_PAYMENT';
  const frozen = watch('frozen');

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const parsed = schema.parse(values);
      return creditsApi.create({
        ...parsed,
        startDate: new Date(parsed.startDate).toISOString(),
        gracePeriodEnds: parsed.gracePeriodEnds
          ? new Date(parsed.gracePeriodEnds).toISOString()
          : null,
        paymentDay: parsed.paymentDay ?? null,
        minPayment: parsed.minPayment ?? null,
        graceReplenishSum: parsed.graceReplenishSum ?? null,
        graceReplenishDay: parsed.graceReplenishDay ?? null,
        freezeCycleDays: parsed.freezeCycleDays ?? null,
        frozen: parsed.frozen,
      });
    },
    onSuccess: async (credit) => {
      await queryClient.invalidateQueries({ queryKey: ['credits'] });
      navigate(`/credits/${credit.id}`);
    },
    onError: (err) => setError(extractErrorMessage(err)),
  });

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-100">Новый кредит</h1>
      <p className="mt-1 text-sm text-slate-500">
        График платежей будет построен автоматически по выбранному типу
      </p>

      <form
        onSubmit={handleSubmit((values) => mutation.mutate(values))}
        className="mt-5 space-y-4"
      >
        <label className="block">
          <span className="text-sm text-slate-400">Название</span>
          <input placeholder="Например, Альфа-Банк" {...register('name')} className={inputClass} />
          {errors.name && <p className="mt-1 text-xs text-rose-400">{errors.name.message}</p>}
        </label>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm text-slate-400">Тип продукта</span>
            <select {...register('type')} className={inputClass}>
              <option value="CREDIT_CARD">Кредитная карта</option>
              <option value="CONSUMER">Потребительский кредит</option>
              <option value="MORTGAGE">Ипотека</option>
              <option value="INSTALLMENT">Рассрочка / Сплит</option>
              <option value="MICROLOAN">Займ (МФО)</option>
            </select>
          </label>

          <label className="block">
            <span className="text-sm text-slate-400">Тип платежа</span>
            <select {...register('paymentType')} className={inputClass}>
              <option value="ANNUITY">Аннуитетный</option>
              <option value="DIFFERENTIAL">Дифференцированный</option>
              <option value="MIN_PAYMENT">Минимальный платёж (кредитка)</option>
            </select>
          </label>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm text-slate-400">Сумма долга, ₽</span>
            <input type="number" step="0.01" {...register('principal')} className={inputClass} />
            {errors.principal && (
              <p className="mt-1 text-xs text-rose-400">{errors.principal.message}</p>
            )}
          </label>

          <label className="block">
            <span className="text-sm text-slate-400">Ставка, % годовых</span>
            <input type="number" step="0.01" {...register('annualRate')} className={inputClass} />
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
            <input type="number" {...register('termMonths')} className={inputClass} />
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
              placeholder="напр. 20"
              {...register('paymentDay')}
              className={inputClass}
            />
          </label>
        </div>

        {isCard && (
          <fieldset className="space-y-4 rounded-2xl border border-sky-500/30 bg-sky-500/5 p-4">
            <legend className="px-1 text-sm font-medium text-sky-300">Льготный период карты</legend>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <label className="block">
                <span className="text-sm text-slate-400">Мин. платёж, ₽</span>
                <input type="number" step="0.01" {...register('minPayment')} className={inputClass} />
              </label>

              <label className="block">
                <span className="text-sm text-slate-400">Сумма для продления, ₽</span>
                <input
                  type="number"
                  step="0.01"
                  placeholder="43 000"
                  {...register('graceReplenishSum')}
                  className={inputClass}
                />
              </label>

              <label className="block">
                <span className="text-sm text-slate-400">День пополнения</span>
                <input
                  type="number"
                  min={1}
                  max={31}
                  {...register('graceReplenishDay')}
                  className={inputClass}
                />
              </label>
            </div>

            <label className="block">
              <span className="text-sm text-slate-400">Льготный период до</span>
              <input type="date" {...register('gracePeriodEnds')} className={inputClass} />
            </label>
          </fieldset>
        )}

        <label className="block">
          <span className="text-sm text-slate-400">Режим досрочного погашения</span>
          <select {...register('prepaymentMode')} className={inputClass}>
            <option value="REDUCE_PAYMENT">Уменьшать платёж</option>
            <option value="REDUCE_TERM">Сокращать срок</option>
          </select>
        </label>

        <div className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" {...register('frozen')} className="h-4 w-4 accent-sky-500" />
            🧊 Цикл заморозки (деньги заморожены)
          </label>

          {frozen && (
            <label className="flex items-center gap-2 text-sm text-slate-400">
              Продлевать каждые
              <input
                type="number"
                min={1}
                max={365}
                placeholder="7"
                {...register('freezeCycleDays', {
                  setValueAs: (v) => (v === '' || v === null || v === undefined ? undefined : Number(v)),
                })}
                className="w-20 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-slate-100 outline-none focus:border-sky-500"
              />
              дней
              <span className="text-xs text-slate-500">
                (необязательно — оставьте пустым, если заморозка без цикла)
              </span>
            </label>
          )}
        </div>

        {error && <p className="text-sm text-rose-400">{error}</p>}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={isSubmitting || mutation.isPending}
            className="rounded-xl bg-sky-500 px-4 py-2.5 font-medium text-slate-950 transition hover:bg-sky-400 disabled:opacity-50"
          >
            {mutation.isPending ? 'Сохраняю…' : 'Сохранить и построить график'}
          </button>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="rounded-xl border border-slate-700 px-4 py-2.5 text-slate-300 transition hover:border-slate-500"
          >
            Отмена
          </button>
        </div>
      </form>
    </div>
  );
}
