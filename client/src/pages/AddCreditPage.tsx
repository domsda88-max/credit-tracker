import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { extractErrorMessage } from '../api/client';
import { creditsApi } from '../api/credits';

const optionalNumber = (min: number, max: number) =>
  z
    .union([z.literal(''), z.coerce.number()])
    .optional()
    .transform((v) => (v === '' || v == null ? undefined : v))
    .refine((v) => v === undefined || (v >= min && v <= max), {
      message: `Значение от ${min} до ${max}`,
    });

const optionalDays = () =>
  z
    .union([z.literal(''), z.coerce.number()])
    .optional()
    .transform((v) => (v === '' || v == null ? undefined : v))
    .refine((v) => v === undefined || (v >= 1 && v <= 365), {
      message: 'Значение от 1 до 365 дней',
    });

const schema = z
  .object({
    name: z.string().min(1, 'Укажите название банка или продукта'),
    type: z.enum(['CREDIT_CARD', 'CONSUMER', 'MORTGAGE', 'INSTALLMENT', 'MICROLOAN', 'LOAN']),
    paymentType: z.enum(['ANNUITY', 'DIFFERENTIAL', 'MIN_PAYMENT']).optional(),
    prepaymentMode: z.enum(['REDUCE_TERM', 'REDUCE_PAYMENT']).optional(),
    principal: z.coerce.number().positive('Сумма должна быть больше 0'),
    annualRate: optionalNumber(0, 100),
    startDate: z.string().optional(),
    termMonths: z.coerce.number().int().min(0).max(600).optional(),
    termDays: optionalDays(),
    paymentDay: optionalNumber(1, 31),
    minPayment: optionalNumber(0, Number.MAX_SAFE_INTEGER),
    gracePeriodEnds: z.string().optional(),
    graceReplenishSum: optionalNumber(0, Number.MAX_SAFE_INTEGER),
    graceReplenishDay: optionalNumber(1, 31),
    frozen: z.boolean().default(false),
    freezeCycleDays: z
      .union([z.literal(''), z.coerce.number().int().min(1).max(365)])
      .optional()
      .nullable()
      .transform((v) => (v === '' || v == null ? null : v)),
    markPastAsPaid: z.boolean().default(true),
    outstanding: optionalNumber(0, Number.MAX_SAFE_INTEGER),
  })
  .superRefine((data, ctx) => {
    // ----- Кредитная карта -----
    if (data.type === 'CREDIT_CARD') {
      if (data.annualRate == null || Number.isNaN(data.annualRate)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Укажите ставку % годовых', path: ['annualRate'] });
      }
      if (!data.paymentDay) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Укажите день платежа', path: ['paymentDay'] });
      }
    }

    // ----- Потребительский кредит / Ипотека -----
    if (data.type === 'CONSUMER' || data.type === 'MORTGAGE') {
      if (!data.paymentType) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Выберите тип платежа', path: ['paymentType'] });
      }
      if (data.annualRate == null || Number.isNaN(data.annualRate)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Укажите ставку % годовых', path: ['annualRate'] });
      }
      if (!data.startDate) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Укажите дату выдачи', path: ['startDate'] });
      }
      if (!data.termMonths || data.termMonths <= 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Укажите срок в месяцах', path: ['termMonths'] });
      }
      if (!data.paymentDay) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Укажите день платежа', path: ['paymentDay'] });
      }
    }

    // ----- Рассрочка / Сплит -----
    if (data.type === 'INSTALLMENT') {
      if (!data.termMonths || data.termMonths <= 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Укажите срок в месяцах', path: ['termMonths'] });
      }
      if (!data.paymentDay) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Укажите день платежа', path: ['paymentDay'] });
      }
    }

    // ----- Займ / МФО -----
    if (data.type === 'MICROLOAN') {
      if (data.annualRate == null || Number.isNaN(data.annualRate)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Укажите ставку % годовых', path: ['annualRate'] });
      }
      if (!data.termDays || data.termDays < 1 || data.termDays > 365) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Укажите срок в днях (1–365)', path: ['termDays'] });
      }
      if (!data.paymentDay) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Укажите день платежа', path: ['paymentDay'] });
      }
    }

    // ----- Заем (частный) — PRIVATE_LOAN -----
    if (data.type === 'LOAN') {
      // Ставка не обязательна — по умолчанию 0%. Срок не нужен.
    }
  });

type FormValues = z.infer<typeof schema>;

const inputClass =
  'mt-1 w-full rounded-control border border-line bg-surface px-3 py-2.5 text-t1 outline-none transition focus:border-primary';

const TYPE_LABELS: Record<FormValues['type'], string> = {
  CREDIT_CARD: 'Кредитная карта',
  CONSUMER: 'Потребительский кредит',
  MORTGAGE: 'Ипотека',
  INSTALLMENT: 'Рассрочка / Сплит',
  MICROLOAN: 'Займ (МФО)',
  LOAN: 'Заем (частный)',
};

export function AddCreditPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const prevTypeRef = useRef<FormValues['type'] | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      type: 'CONSUMER',
      paymentType: 'ANNUITY',
      prepaymentMode: 'REDUCE_PAYMENT',
      frozen: false,
      markPastAsPaid: true,
    },
  });

  const type = watch('type');
  const paymentType = watch('paymentType');
  const frozen = watch('frozen');
  const markPast = watch('markPastAsPaid');
  const startDate = watch('startDate');

  const startInPast = Boolean(startDate) && new Date(startDate ?? '') < new Date();

  // --- Сбрасываем поля, нерелевантные для нового типа продукта ---
  useEffect(() => {
    if (prevTypeRef.current === type) return;
    prevTypeRef.current = type;

    switch (type) {
      case 'CREDIT_CARD':
        setValue('paymentType', 'MIN_PAYMENT');
        setValue('prepaymentMode', undefined);
        setValue('startDate', undefined);
        setValue('termMonths', undefined);
        setValue('termDays', undefined);
        setValue('markPastAsPaid', true);
        setValue('outstanding', undefined);
        break;

      case 'CONSUMER':
      case 'MORTGAGE':
        setValue('paymentType', 'ANNUITY');
        setValue('prepaymentMode', 'REDUCE_PAYMENT');
        setValue('minPayment', undefined);
        setValue('gracePeriodEnds', undefined);
        setValue('graceReplenishSum', undefined);
        setValue('graceReplenishDay', undefined);
        setValue('frozen', false);
        setValue('freezeCycleDays', null);
        break;

      case 'INSTALLMENT':
        setValue('paymentType', 'ANNUITY');
        setValue('prepaymentMode', undefined);
        setValue('startDate', undefined);
        setValue('termDays', undefined);
        setValue('minPayment', undefined);
        setValue('gracePeriodEnds', undefined);
        setValue('graceReplenishSum', undefined);
        setValue('graceReplenishDay', undefined);
        setValue('frozen', false);
        setValue('freezeCycleDays', null);
        setValue('markPastAsPaid', true);
        setValue('outstanding', undefined);
        break;

      case 'MICROLOAN':
        setValue('paymentType', undefined);
        setValue('prepaymentMode', undefined);
        setValue('startDate', undefined);
        setValue('termMonths', undefined);
        setValue('minPayment', undefined);
        setValue('gracePeriodEnds', undefined);
        setValue('graceReplenishSum', undefined);
        setValue('graceReplenishDay', undefined);
        setValue('frozen', false);
        setValue('freezeCycleDays', null);
        setValue('markPastAsPaid', true);
        setValue('outstanding', undefined);
        break;

      case 'LOAN':
        setValue('paymentType', undefined);
        setValue('prepaymentMode', undefined);
        setValue('startDate', undefined);
        setValue('termMonths', undefined);
        setValue('termDays', undefined);
        setValue('annualRate', undefined);
        setValue('minPayment', undefined);
        setValue('gracePeriodEnds', undefined);
        setValue('graceReplenishSum', undefined);
        setValue('graceReplenishDay', undefined);
        setValue('frozen', false);
        setValue('freezeCycleDays', null);
        setValue('markPastAsPaid', true);
        setValue('outstanding', undefined);
        break;
    }
  }, [type, setValue]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const parsed = schema.parse(values);
      return creditsApi.create({
        ...parsed,
        annualRate: parsed.type === 'LOAN' ? 0 : parsed.annualRate ?? 0,
        startDate: parsed.startDate ? new Date(parsed.startDate).toISOString() : new Date().toISOString(),
        gracePeriodEnds: parsed.gracePeriodEnds ? new Date(parsed.gracePeriodEnds).toISOString() : null,
        paymentDay: parsed.paymentDay ?? null,
        minPayment: parsed.minPayment ?? null,
        graceReplenishSum: parsed.graceReplenishSum ?? null,
        graceReplenishDay: parsed.graceReplenishDay ?? null,
        freezeCycleDays: parsed.freezeCycleDays ?? null,
        frozen: parsed.frozen,
        markPastAsPaid: parsed.markPastAsPaid,
        outstanding: parsed.outstanding ?? null,
        paymentType: parsed.paymentType ?? 'ANNUITY',
        // Кредитная карта — revolving-продукт, срок не нужен
        termMonths:
          parsed.type === 'CREDIT_CARD' || parsed.type === 'MICROLOAN' ? undefined : parsed.termMonths,
      });
    },
    onSuccess: async (credit) => {
      await queryClient.invalidateQueries({ queryKey: ['credits'] });
      navigate(`/credits/${credit.id}`);
    },
    onError: (err) => setError(extractErrorMessage(err)),
  });

  const sectionClass = 'transition-all duration-300 ease-in-out';

  return (
    <div className="min-w-0 w-full max-w-full space-y-4 px-4 pb-28 safe-area-bottom">
      <h1 className="text-heading font-bold text-t1">Добавить долг</h1>
      <p className="mt-1 text-sm text-t3">
        График платежей будет построен автоматически по выбранному типу
      </p>
      {Object.keys(errors).length > 0 && (
        <p className="mt-3 rounded-control border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
          Проверьте выделенные поля — форма не отправится, пока они не заполнены верно.
        </p>
      )}

      <form
        onSubmit={handleSubmit((values) => mutation.mutate(values))}
        className="mt-5 space-y-4 touch-manipulation"
      >
        {/* === ОБЩИЕ ПОЛЯ (всегда видны) === */}
        <label className="block">
          <span className="text-sm text-t2">Название</span>
          <input placeholder="Например, Альфа-Банк" {...register('name')} className={inputClass} />
          {errors.name && <p className="mt-1 text-xs text-danger">{errors.name.message}</p>}
        </label>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm text-t2">Тип продукта</span>
            <select {...register('type')} className={inputClass}>
              <option value="CONSUMER">Потребительский кредит</option>
              <option value="CREDIT_CARD">Кредитная карта</option>
              <option value="MORTGAGE">Ипотека</option>
              <option value="INSTALLMENT">Рассрочка / Сплит</option>
              <option value="MICROLOAN">Займ (МФО)</option>
              <option value="LOAN">Заем (частный)</option>
            </select>
          </label>

          <label className="block">
            <span className="text-sm text-t2">Сумма долга, ₽</span>
            <input type="number" step="0.01" {...register('principal')} className={inputClass} />
            {errors.principal && (
              <p className="mt-1 text-xs text-danger">{errors.principal.message}</p>
            )}
          </label>
        </div>

        {/* === СПЕЦИФИЧНЫЕ ПОЛЯ ПО ТИПУ === */}
        {type === 'CREDIT_CARD' && (
          <section className={`space-y-4 rounded-card border border-primary/30 bg-primary/5 p-4 ${sectionClass}`}>
            <h3 className="text-sm font-medium text-primary">Параметры кредитной карты</h3>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <label className="block">
                <span className="text-sm text-t2">Ставка, % годовых</span>
                <input type="number" step="0.01" {...register('annualRate')} className={inputClass} />
                {errors.annualRate && (
                  <p className="mt-1 text-xs text-danger">{errors.annualRate.message}</p>
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

              <label className="block">
                <span className="text-sm text-t2">Сумма для продления грейса, ₽</span>
                <input
                  type="number"
                  step="0.01"
                  placeholder="43 000"
                  {...register('graceReplenishSum')}
                  className={inputClass}
                />
                {errors.graceReplenishSum && (
                  <p className="mt-1 text-xs text-danger">{errors.graceReplenishSum.message}</p>
                )}
              </label>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm text-t2">Льготный период до</span>
                <input type="date" {...register('gracePeriodEnds')} className={inputClass} />
              </label>

              <label className="block">
                <span className="text-sm text-t2">День пополнения</span>
                <input
                  type="number"
                  min={1}
                  max={31}
                  {...register('graceReplenishDay')}
                  className={inputClass}
                />
              </label>
            </div>

            <div className="space-y-3 rounded-card border border-success/30 bg-success/5 p-4">
              <label className="flex items-start gap-2 text-sm text-t2">
                <input
                  type="checkbox"
                  {...register('frozen')}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-success"
                />
                <span>Цикл заморозки («снежинка»)</span>
              </label>

              {frozen && (
                <label className="block">
                  <span className="text-sm text-t2">Период заморозки, дней</span>
                  <input
                    type="number"
                    min={1}
                    max={365}
                    {...register('freezeCycleDays')}
                    className={inputClass}
                  />
                  {errors.freezeCycleDays && (
                    <p className="mt-1 text-xs text-danger">{errors.freezeCycleDays.message}</p>
                  )}
                </label>
              )}
            </div>

            <p className="mt-2 text-xs text-t3">
              Тип платежа автоматически: <b>Минимальный платёж</b>. Срок и дата выдачи не нужны — карта revolving.
            </p>
          </section>
        )}

        {(type === 'CONSUMER' || type === 'MORTGAGE') && (
          <section className={`space-y-4 rounded-card border border-primary/30 bg-primary/5 p-4 ${sectionClass}`}>
            <h3 className="text-sm font-medium text-primary">
              Параметры {type === 'CONSUMER' ? 'потребительского кредита' : 'ипотеки'}
            </h3>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <label className="block">
                <span className="text-sm text-t2">Тип платежа</span>
                <select {...register('paymentType')} className={inputClass}>
                  <option value="ANNUITY">Аннуитетный</option>
                  <option value="DIFFERENTIAL">Дифференцированный</option>
                </select>
              </label>

              <label className="block">
                <span className="text-sm text-t2">Ставка, % годовых</span>
                <input type="number" step="0.01" {...register('annualRate')} className={inputClass} />
                {errors.annualRate && (
                  <p className="mt-1 text-xs text-danger">{errors.annualRate.message}</p>
                )}
              </label>

              <label className="block">
                <span className="text-sm text-t2">Дата выдачи</span>
                <input type="date" {...register('startDate')} className={inputClass} />
                {errors.startDate && (
                  <p className="mt-1 text-xs text-danger">{errors.startDate.message}</p>
                )}
              </label>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <label className="block">
                <span className="text-sm text-t2">Срок, месяцев</span>
                <input type="number" {...register('termMonths')} className={inputClass} />
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

              <label className="block">
                <span className="text-sm text-t2">Режим досрочного погашения</span>
                <select {...register('prepaymentMode')} className={inputClass}>
                  <option value="REDUCE_PAYMENT">Уменьшать платёж</option>
                  <option value="REDUCE_TERM">Сокращать срок</option>
                </select>
              </label>
            </div>
          </section>
        )}

        {type === 'INSTALLMENT' && (
          <section className={`space-y-4 rounded-card border border-cyan-500 bg-cyan-950/20 p-4 ${sectionClass}`}>
            <h3 className="text-sm font-medium text-cyan-400">Параметры рассрочки / сплита</h3>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <label className="block">
                <span className="text-sm text-t2">Срок, месяцев</span>
                <input type="number" {...register('termMonths')} className={inputClass} />
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

              <label className="block">
                <span className="text-sm text-t2">Ставка, % годовых</span>
                <input type="number" step="0.01" {...register('annualRate')} className={inputClass} />
                {errors.annualRate && (
                  <p className="mt-1 text-xs text-danger">{errors.annualRate.message}</p>
                )}
                <span className="mt-1 block text-xs text-t3">0% — без процентов, либо укажите свою ставку</span>
              </label>
            </div>
          </section>
        )}

        {/* === ОПЦИОННЫЙ БЛОК: «рассрочка оформлена раньше» (для INSTALLMENT) === */}
        {type === 'INSTALLMENT' && markPast && (
          <div className={`space-y-3 rounded-card border border-success/30 bg-success/5 p-4 ${sectionClass}`}>
            <label className="flex items-start gap-2 text-sm text-t2">
              <input
                type="checkbox"
                {...register('markPastAsPaid')}
                className="mt-0.5 h-4 w-4 shrink-0 accent-success"
              />
              <span>
                Рассрочка оформлена раньше — платежи, срок которых уже прошёл, считать внесёнными
                <span className="mt-0.5 block text-xs text-t3">
                  Укажите дату выдачи, чтобы прошедшие платежи отметились оплаченными
                </span>
              </span>
            </label>

            {markPast && (
              <label className="block">
                <span className="text-sm text-t2">Дата выдачи</span>
                <input
                  type="date"
                  {...register('startDate')}
                  className={inputClass}
                />
                {errors.startDate && (
                  <p className="mt-1 text-xs text-danger">{errors.startDate.message}</p>
                )}
              </label>
            )}

            {markPast && (
              <label className="block">
                <span className="text-sm text-t2">
                  Остаток долга сейчас, ₽ <span className="text-xs text-t3">необязательно</span>
                </span>
                <input
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  placeholder="оставьте пустым — посчитаю сам"
                  {...register('outstanding')}
                  className={inputClass}
                />
                <span className="mt-1 block text-xs text-t3">
                  Если знаете точный остаток из приложения банка — введите его, и он заменит расчёт.
                </span>
                {errors.outstanding && (
                  <p className="mt-1 text-xs text-danger">{errors.outstanding.message}</p>
                )}
              </label>
            )}
          </div>
        )}

        {type === 'MICROLOAN' && (
          <section className={`space-y-4 rounded-card border border-warning/30 bg-warning/5 p-4 ${sectionClass}`}>
            <h3 className="text-sm font-medium text-warning">Параметры займа (МФО)</h3>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <label className="block">
                <span className="text-sm text-t2">Ставка, % годовых</span>
                <input type="number" step="0.01" {...register('annualRate')} className={inputClass} />
                {errors.annualRate && (
                  <p className="mt-1 text-xs text-danger">{errors.annualRate.message}</p>
                )}
              </label>

              <label className="block">
                <span className="text-sm text-t2">Срок, дней</span>
                <input
                  type="number"
                  {...register('termDays')}
                  placeholder="напр. 30"
                  className={inputClass}
                />
                {errors.termDays && (
                  <p className="mt-1 text-xs text-danger">{errors.termDays.message}</p>
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

            <p className="mt-2 text-xs text-t3">
              Один баллонный платёж в конце срока. Дата выдачи не нужна — займ краткосрочный.
            </p>
          </section>
        )}

        {type === 'LOAN' && (
          <p className="mt-2 text-xs text-t3">
            Частный заём без графика — только название и сумма. Ставка 0%.
          </p>
        )}

        {/* === ОПЦИОННЫЙ БЛОК: «кредит оформлен раньше» (только для CONSUMER/MORTGAGE) === */}
        {(type === 'CONSUMER' || type === 'MORTGAGE') && (
          <div className={`space-y-3 rounded-card border border-success/30 bg-success/5 p-4 ${sectionClass}`}>
            <label className="flex items-start gap-2 text-sm text-t2">
              <input
                type="checkbox"
                {...register('markPastAsPaid')}
                className="mt-0.5 h-4 w-4 shrink-0 accent-success"
              />
              <span>
                Кредит оформлен раньше — платежи, срок которых уже прошёл, считать внесёнными
                <span className="mt-0.5 block text-xs text-t3">
                  {startInPast
                    ? 'Дата выдачи в прошлом: график будет построен целиком, прошедшие платежи отметятся оплаченными, а остаток долга уменьшится на их «тело».'
                    : 'Укажите прошедшую дату выдачи, чтобы это сработало.'}
                </span>
              </span>
            </label>

            {markPast && (
              <label className="block">
                <span className="text-sm text-t2">
                  Остаток долга сейчас, ₽ <span className="text-xs text-t3">необязательно</span>
                </span>
                <input
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  placeholder="оставьте пустым — посчитаю сам"
                  {...register('outstanding')}
                  className={inputClass}
                />
                <span className="mt-1 block text-xs text-t3">
                  Если знаете точный остаток из приложения банка — введите его, и он заменит расчёт.
                </span>
                {errors.outstanding && (
                  <p className="mt-1 text-xs text-danger">{errors.outstanding.message}</p>
                )}
              </label>
            )}
          </div>
        )}

        {error && <p className="text-sm text-danger">{error}</p>}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={isSubmitting || mutation.isPending}
            className="inline-flex items-center justify-center gap-2 min-w-[150px] whitespace-nowrap rounded-control bg-primary px-4 py-2.5 font-medium text-white disabled:opacity-70"
          >
            {mutation.isPending ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                Сохраняю…
              </>
            ) : (
              'Сохранить'
            )}
          </button>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="rounded-control border border-line px-4 py-2.5 text-t2 transition hover:border-slate-500"
          >
            Отмена
          </button>
        </div>
      </form>
    </div>
  );
}
