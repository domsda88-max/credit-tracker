import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { extractErrorMessage } from '../api/client';
import type { CreateCreditPayload } from '../types';
import { creditsApi } from '../api/credits';
import { formatMoney } from '../utils/format';

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
    prepaymentMode: z.enum(['REDUCE_TERM']).optional(),
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
    if (data.type === 'CREDIT_CARD') {
      if (data.annualRate == null || Number.isNaN(data.annualRate)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Укажите ставку % годовых…', path: ['annualRate'] });
      }
      if (!data.paymentDay) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Укажите день платежа', path: ['paymentDay'] });
      }
    }
    if (data.type === 'CONSUMER' || data.type === 'MORTGAGE') {
      if (!data.paymentType) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Выберите тип платежа', path: ['paymentType'] });
      }
      if (data.annualRate == null || Number.isNaN(data.annualRate)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Укажите ставку % годовых…', path: ['annualRate'] });
      }
      if (!data.startDate) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Укажите дату выдачи', path: ['startDate'] });
      }
      if (!data.termMonths || data.termMonths <= 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Укажите срок в месяцах…', path: ['termMonths'] });
      }
      if (!data.paymentDay) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Укажите день платежа', path: ['paymentDay'] });
      }
    }
    if (data.type === 'INSTALLMENT') {
      if (!data.termDays && !(data.termMonths && data.termMonths > 0)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Укажите срок…', path: ['termMonths'] });
      }
      if (!data.paymentDay) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Укажите день платежа', path: ['paymentDay'] });
      }
    }
    if (data.type === 'MICROLOAN') {
      if (data.annualRate == null || Number.isNaN(data.annualRate)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Укажите ставку % годовых…', path: ['annualRate'] });
      }
      if (!data.termDays) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Укажите срок в днях… (1–365)', path: ['termDays'] });
      }
      if (!data.paymentDay) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Укажите день платежа', path: ['paymentDay'] });
      }
    }
    if (data.type === 'LOAN') {
      if (!data.startDate) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Укажите дату выдачи', path: ['startDate'] });
      }
    }
  });

type FormValues = z.infer<typeof schema>;
type MutationValues = FormValues & { earlyRepayments: NonNullable<CreateCreditPayload['earlyRepayments']> };

const inputClass =
  'mt-1 w-full rounded-control border border-line bg-surface px-3 py-2.5 text-t1 outline-none transition focus:border-primary';

const typePassport: Record<FormValues['type'], { title: string; desc: string; req: string[]; icons: string }> = {
  CONSUMER: { title: 'Потребительский кредит', desc: 'Стандартный кредит с фиксированным сроком и ставкой. График строится сервером.', req: ['Ставка %', 'Дата выдачи', 'Срок мес.', 'День платежа'], icons: '🏦' },
  CREDIT_CARD: { title: 'Кредитная карта', desc: 'Revolving-лимит. Не нужны срок и дата выдачи — только ставка и день платежа.', req: ['Ставка %', 'День платежа'], icons: '💳' },
  MORTGAGE: { title: 'Ипотека', desc: 'Долгосрочный кредит на недвижимость. Требует дату выдачи и срок.', req: ['Ставка %', 'Дата выдачи', 'Срок мес.', 'День платежа'], icons: '🏠' },
  INSTALLMENT: { title: 'Рассрочка / Сплит', desc: 'Короткая рассрочка в днях. Ставка может быть 0%.', req: ['Срок дней', 'День платежа'], icons: '🧾' },
  MICROLOAN: { title: 'Займ (МФО)', desc: 'Краткосрочный balloon-займ — один платёж в конце срока.', req: ['Ставка %', 'Срок дней', 'День платежа'], icons: '⚡' },
  LOAN: { title: 'Займ (частный)', desc: 'Долг человеку без графика и ставки. Только название, сумма и дата выдачи.', req: ['Дата выдачи'], icons: '🤝' },
};

function annuityMonthly(principal: number, annualRate: number, termMonths: number) {
  if (!principal || !termMonths) return 0;
  const r = annualRate / 100 / 12;
  if (r === 0) return principal / termMonths;
  return (principal * r) / (1 - Math.pow(1 + r, -termMonths));
}

function MoneyInput({ register, name, placeholder }: { register: ReturnType<typeof useForm<FormValues>>['register']; name: Parameters<ReturnType<typeof useForm<FormValues>>['register']>[0]; placeholder?: string }) {
  return (
    <input
      type="text"
      inputMode="decimal"
      placeholder={placeholder}
      {...register(name, {
        setValueAs: (v: string) => {
          if (typeof v !== 'string') return v;
          const cleaned = v.replace(/\s/g, '').replace(',', '.');
          return cleaned === '' ? '' : Number(cleaned);
        },
      })}
      className={inputClass}
    />
  );
}

export function AddCreditPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [earlyRepayments, setEarlyRepayments] = useState<Array<{ amount: string; date: string }>>([]);
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
      prepaymentMode: 'REDUCE_TERM',
      frozen: false,
      markPastAsPaid: true,
    },
  });

  const type = watch('type');
  const frozen = watch('frozen');
  const markPast = watch('markPastAsPaid');
  const startDate = watch('startDate');
  const name = watch('name');
  const principal = watch('principal');
  const annualRate = watch('annualRate');
  const termMonths = watch('termMonths');
  const termDays = watch('termDays');
  const paymentDay = watch('paymentDay');

  const startInPast = Boolean(startDate) && new Date(startDate ?? '') < new Date();

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
        setValue('prepaymentMode', 'REDUCE_TERM');
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
        setValue('annualRate', undefined);
        setValue('termMonths', undefined);
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
    }
  }, [type, setValue]);

  const mutation = useMutation({
    mutationFn: (values: MutationValues) => {
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
        earlyRepayments: values.earlyRepayments,
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

  const hasName = Boolean(name && String(name).trim());
  const hasPrincipal = principal !== undefined && Number(principal) > 0;
  const hasType = !!(type && String(type).trim());
  const hasStartDate = !!(startDate && String(startDate).trim());
  const hasRate = annualRate !== undefined && Number.isFinite(Number(annualRate));
  const hasTerm = !!((termMonths && Number(termMonths) > 0) || (termDays && Number(termDays) > 0));
  const hasPayDay = !!(paymentDay && Number(paymentDay) >= 1 && Number(paymentDay) <= 31);
  const pass = typePassport[type];
  const monthly = type === 'CONSUMER' || type === 'MORTGAGE' ? annuityMonthly(Number(principal || 0), Number(annualRate || 0), Number(termMonths || 0)) : 0;

  const handleClose = () => navigate(-1);

  return (
    <div className="min-w-0 w-full max-w-full space-y-4 px-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-heading font-bold text-t1">Добавление долга</h1>
        <button type="button" onClick={handleClose} aria-label="Закрыть" className="rounded-full p-1.5 text-t3 hover:bg-surface2 transition">×</button>
      </div>

      <form onSubmit={handleSubmit((values) => mutation.mutate({ ...values, earlyRepayments: earlyRepayments.filter((er) => er.amount && er.date).map((er) => ({ amount: Number(er.amount), date: er.date })) }))} className="mt-5 space-y-4 touch-manipulation">
        <label className="block">
          <span className="text-sm text-t2">Название <span className="text-danger-fg">*</span></span>
          <input placeholder="Например, Альфа-Банк" {...register('name')} className={inputClass} />
          {errors.name && <p className="mt-1 text-xs text-danger-fg">{errors.name.message}</p>}
        </label>

        {hasName && (
          <div className="rounded-card border border-line bg-surface p-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-lg">{pass.icons}</span>
              <div>
                <p className="font-semibold text-t1">{pass.title}</p>
                <p className="mt-0.5 text-xs text-t3">{pass.desc}</p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {pass.req.map((r) => (
                <span key={r} className="rounded-full border border-line bg-surface2/60 px-2 py-0.5 text-[11px] text-t2">{r}</span>
              ))}
            </div>
            <label className="block mt-4">
              <span className="text-sm text-t2">Тип долга</span>
              <select {...register('type')} className={inputClass}>
                <option value="CONSUMER">Потребительский кредит</option>
                <option value="CREDIT_CARD">Кредитная карта</option>
                <option value="MORTGAGE">Ипотека</option>
                <option value="INSTALLMENT">Рассрочка / Сплит</option>
                <option value="MICROLOAN">Займ (МФО)</option>
                <option value="LOAN">Займ (частный)</option>
              </select>
            </label>
          </div>
        )}

        {hasName && hasType && (
          <label className="block">
            <span className="text-sm text-t2">Остаток долга, ₽ <span className="text-danger-fg">*</span></span>
            <MoneyInput register={register} name="principal" placeholder="150 000" />
            {errors.principal && <p className="mt-1 text-xs text-danger-fg">{errors.principal.message}</p>}
          </label>
        )}

        {hasName && hasType && hasPrincipal && type === 'CREDIT_CARD' && (
          <section className="space-y-4 rounded-card border border-line bg-surface2/40 p-4">
            <h3 className="text-sm font-medium text-t2">
              Параметры карты
              {hasRate && hasPayDay && <span className="ml-2 text-xs text-success-fg">✓</span>}
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <label className="block">
                <span className="text-sm text-t2">Ставка, % годовых <span className="text-danger-fg">*</span></span>
                <input type="number" step="0.01" inputMode="decimal" placeholder="19.9" {...register('annualRate')} className={inputClass} />
                {errors.annualRate && <p className="mt-1 text-xs text-danger-fg">{errors.annualRate.message}</p>}
                <span className="mt-1 block text-xs text-t3">Ставка по Revolving, напр. 19.9%</span>
              </label>
              <label className="block">
                <span className="text-sm text-t2">День платежа</span>
                <input type="number" min={1} max={31} inputMode="numeric" placeholder="напр. 20" {...register('paymentDay')} className={inputClass} />
                {errors.paymentDay && <p className="mt-1 text-xs text-danger-fg">{errors.paymentDay.message}</p>}
                <span className="mt-1 block text-xs text-t3">Число месяца для min. платежа</span>
              </label>
              <label className="block">
                <span className="text-sm text-t2">Сумма для продления грейса, ₽</span>
                <MoneyInput register={register} name="graceReplenishSum" placeholder="43 000" />
                {errors.graceReplenishSum && <p className="mt-1 text-xs text-danger-fg">{errors.graceReplenishSum.message}</p>}
                <span className="mt-1 block text-xs text-t3">Для продления льготного периода (опционально)</span>
              </label>
            </div>
          </section>
        )}

        {(type === 'CONSUMER' || type === 'MORTGAGE') && hasName && hasType && hasPrincipal && (
          <section className="space-y-4 rounded-card border border-line bg-surface2/40 p-4">
            <h3 className="text-sm font-medium text-t2">
              Параметры {type === 'CONSUMER' ? 'потребительского кредита' : 'ипотеки'}
              {hasRate && hasStartDate && hasTerm && hasPayDay && <span className="ml-2 text-xs text-success-fg">✓</span>}
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <label className="block">
                <span className="text-sm text-t2">Тип платежа</span>
                <select {...register('paymentType')} className={inputClass}>
                  <option value="ANNUITY">Аннуитетный</option>
                  <option value="DIFFERENTIAL">Дифференцированный</option>
                </select>
                <span className="mt-1 block text-xs text-t3">Аннуитет — равные платежи, Дифф. — убывающие</span>
              </label>
              <label className="block">
                <span className="text-sm text-t2">Ставка, % годовых</span>
                <input type="number" step="0.01" {...register('annualRate')} className={inputClass} />
                {errors.annualRate && <p className="mt-1 text-xs text-danger-fg">{errors.annualRate.message}</p>}
                <span className="mt-1 block text-xs text-t3">Годовая ставка, напр. 19.9</span>
              </label>
              <label className="block">
                <span className="text-sm text-t2">Дата выдачи</span>
                <input type="date" {...register('startDate')} className={inputClass} />
                {errors.startDate && <p className="mt-1 text-xs text-danger-fg">{errors.startDate.message}</p>}
                <p className="mt-1 text-xs text-t3">Если не указана — берётся дата создания записи.</p>
              </label>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm text-t2">Срок, месяцев</span>
                <input type="number" {...register('termMonths')} className={inputClass} />
                {errors.termMonths && <p className="mt-1 text-xs text-danger-fg">{errors.termMonths.message}</p>}
              </label>
              <label className="block">
                <span className="text-sm text-t2">День платежа</span>
                <input type="number" min={1} max={31} inputMode="numeric" placeholder="напр. 20" {...register('paymentDay')} className={inputClass} />
                {errors.paymentDay && <p className="mt-1 text-xs text-danger-fg">{errors.paymentDay.message}</p>}
              </label>
            </div>
            {monthly > 0 && <p className="text-sm text-t2">≈ Ежемесячно <b className="text-t1">{formatMoney(monthly)}</b></p>}
          </section>
        )}

        {type === 'INSTALLMENT' && hasName && hasType && hasPrincipal && (
          <section className="space-y-4 rounded-card border border-line bg-surface2/40 p-4">
            <h3 className="text-sm font-medium text-t2">
              Параметры рассрочки / сплита
              {(hasTerm || hasPayDay) && <span className="ml-2 text-xs text-success-fg">✓</span>}
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <label className="block">
                <span className="text-sm text-t2">Срок, дней <span className="text-danger-fg">*</span></span>
                <input type="number" inputMode="numeric" min="1" placeholder="напр. 30" {...register('termDays')} className={inputClass} />
                {errors.termDays && <p className="mt-1 text-xs text-danger-fg">{errors.termDays.message}</p>}
                <span className="mt-1 block text-xs text-t3">Полный срок рассрочки, напр. 90</span>
              </label>
              <label className="block">
                <span className="text-sm text-t2">День платежа</span>
                <input type="number" min={1} max={31} inputMode="numeric" placeholder="напр. 20" {...register('paymentDay')} className={inputClass} />
                {errors.paymentDay && <p className="mt-1 text-xs text-danger-fg">{errors.paymentDay.message}</p>}
                <span className="mt-1 block text-xs text-t3">Число месяца для платежа</span>
              </label>
              <label className="block">
                <span className="text-sm text-t2">Ставка, % годовых</span>
                <input type="number" step="0.01" {...register('annualRate')} className={inputClass} />
                {errors.annualRate && <p className="mt-1 text-xs text-danger-fg">{errors.annualRate.message}</p>}
                <span className="mt-1 block text-xs text-t3">0% — без процентов, либо укажите свою ставку</span>
              </label>
            </div>
          </section>
        )}

        {type === 'MICROLOAN' && hasName && hasType && hasPrincipal && (
          <section className="space-y-4 rounded-card border border-line bg-surface2/40 p-4">
            <h3 className="text-sm font-medium text-t2">
              Параметры займа (МФО)
              {hasRate && hasTerm && hasPayDay && <span className="ml-2 text-xs text-success-fg">✓</span>}
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <label className="block">
                <span className="text-sm text-t2">Ставка, % годовых</span>
                <input type="number" step="0.01" {...register('annualRate')} className={inputClass} />
                {errors.annualRate && <p className="mt-1 text-xs text-danger-fg">{errors.annualRate.message}</p>}
                <span className="mt-1 block text-xs text-t3">Годовая ставка МФО, напр. 292%</span>
              </label>
              <label className="block">
                <span className="text-sm text-t2">Срок, дней</span>
                <input type="number" {...register('termDays')} placeholder="напр. 30" className={inputClass} />
                {errors.termDays && <p className="mt-1 text-xs text-danger-fg">{errors.termDays.message}</p>}
                <span className="mt-1 block text-xs text-t3">До 365 дней</span>
              </label>
              <label className="block">
                <span className="text-sm text-t2">День платежа</span>
                <input type="number" min={1} max={31} inputMode="numeric" placeholder="напр. 20" {...register('paymentDay')} className={inputClass} />
                {errors.paymentDay && <p className="mt-1 text-xs text-danger-fg">{errors.paymentDay.message}</p>}
                <span className="mt-1 block text-xs text-t3">Число месяца для платежа</span>
              </label>
            </div>
            <p className="mt-2 text-xs text-t3">Один balloon-платёж в конце срока. Дата выдачи не нужна — займ краткосрочный.</p>
          </section>
        )}

        {type === 'LOAN' && hasName && hasType && hasPrincipal && (
          <div className="space-y-4 rounded-card border border-line bg-surface2/40 p-4">
            <h3 className="text-sm font-medium text-t2">
              Частный займ
              {hasStartDate && <span className="ml-2 text-xs text-success-fg">✓</span>}
            </h3>
            <label className="block">
              <span className="text-sm text-t2">Дата выдачи</span>
              <input type="date" {...register('startDate')} className={inputClass} />
              {errors.startDate && <p className="mt-1 text-xs text-danger-fg">{errors.startDate.message}</p>}
              <span className="mt-1 block text-xs text-t3">Обязательно для корректного учёта срока займа</span>
            </label>
            <p className="mt-2 text-xs text-t3">Частный займ без графика — только название и сумма. Ставка 0%.</p>
          </div>
        )}

        {type === 'CREDIT_CARD' && hasName && hasType && hasPrincipal && (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm text-t2">Льготный период до</span>
                <input type="date" {...register('gracePeriodEnds')} className={inputClass} />
              </label>
              <label className="block">
                <span className="text-sm text-t2">День пополнения</span>
                <input type="number" min={1} max={31} {...register('graceReplenishDay')} className={inputClass} />
              </label>
            </div>
            <p className="mt-2 text-xs text-t3">Тип платежа автоматический: <b>минимальный платёж</b>. Срок и дата выдачи не нужны — карта revolving.</p>
          </>
        )}

        {(type === 'CONSUMER' || type === 'MORTGAGE') && markPast && hasName && hasType && hasPrincipal && (
          <div className="space-y-3 rounded-card border border-line bg-surface2/40 p-4">
            <label className="flex items-start gap-2 text-sm text-t2">
              <input type="checkbox" {...register('markPastAsPaid')} className="mt-0.5 h-4 w-4 shrink-0 accent-success" />
              <span>
                Кредит оформлен раньше — платежи, срок которых уже прошёл, считаем внесёнными
                <span className="mt-0.5 block text-xs text-t3">{startInPast ? 'Дата выдачи в прошлом: график будет построен целиком, прошедшие платежи отметятся оплаченными, а остаток долга уменьшится на «тело».' : 'Укажите прошедшую дату выдачи, чтобы это сработало.'}</span>
              </span>
            </label>
            {markPast && (
              <label className="block">
                <span className="text-sm text-t2">Остаток долга сейчас, ₽ <span className="text-xs text-t3">необязательно</span></span>
                <MoneyInput register={register} name="outstanding" placeholder="оставьте пустым — посчитаем сами" />
                {errors.outstanding && <p className="mt-1 text-xs text-danger-fg">{errors.outstanding.message}</p>}
              </label>
            )}
          </div>
        )}

        {type === 'CREDIT_CARD' && frozen && hasName && hasType && hasPrincipal && (
          <div className="space-y-3 rounded-card border border-line bg-surface2/40 p-4">
            <label className="block">
              <span className="text-sm text-t2">Период заморозки, дней</span>
              <input type="number" min={1} max={365} {...register('freezeCycleDays')} className={inputClass} />
              {errors.freezeCycleDays && <p className="mt-1 text-xs text-danger-fg">{errors.freezeCycleDays.message}</p>}
            </label>
          </div>
        )}

        {hasName && hasType && hasPrincipal && type === 'CREDIT_CARD' && (
          <label className="flex items-start gap-2 text-sm text-t2">
            <input type="checkbox" {...register('frozen')} className="mt-0.5 h-4 w-4 shrink-0 accent-success" />
            <span>Цикл заморозки («снежинка»)</span>
          </label>
        )}

        {hasName && hasType && hasPrincipal && (
          <details className="rounded-card border border-line bg-surface p-4">
            <summary className="cursor-pointer text-sm font-medium text-t1">История досрочных погашений (опционально)</summary>
            <div className="mt-3 space-y-3">
              {earlyRepayments.map((er, idx) => (
                <div key={idx} className="flex gap-2">
                  <input type="number" placeholder="Сумма, ₽" value={er.amount} onChange={(e) => { const updated = [...earlyRepayments]; updated[idx] = { ...updated[idx], amount: e.target.value }; setEarlyRepayments(updated); }} className="flex-1 rounded-control border border-line bg-surface px-3 py-2 text-t1" />
                  <input type="date" value={er.date} onChange={(e) => { const updated = [...earlyRepayments]; updated[idx] = { ...updated[idx], date: e.target.value }; setEarlyRepayments(updated); }} className="flex-1 rounded-control border border-line bg-surface px-3 py-2 text-t1" />
                  <button type="button" onClick={() => setEarlyRepayments(earlyRepayments.filter((_, i) => i !== idx))} className="rounded-control border border-danger/40 px-3 text-danger-fg">×</button>
                </div>
              ))}
              <button type="button" onClick={() => setEarlyRepayments([...earlyRepayments, { amount: '', date: '' }])} className="w-full rounded-control border border-line px-3 py-2 text-sm text-t2">+ Добавить досрочку</button>
            </div>
          </details>
        )}

        {hasName && hasType && hasPrincipal && principal && Number(principal) > 0 && (
          <div className="rounded-card border border-line bg-surface p-4">
            <h3 className="text-sm font-medium text-t1">Предпросмотр</h3>
            <p className="mt-2 text-sm text-t2">Сумма долга: <b className="text-t1">{formatMoney(Number(principal))}</b></p>
            <p className="mt-1 text-sm text-t2">Тип: <b className="text-t1">{pass.title}</b></p>
            {monthly > 0 && <p className="mt-1 text-sm text-t2">≈ Ежемесячно <b className="text-t1">{formatMoney(monthly)}</b></p>}
            <p className="mt-1 text-xs text-t3">Точный график построится на сервере после сохранения.</p>
          </div>
        )}

        {error && <p className="text-sm text-danger-fg">{error}</p>}

        {(hasName && hasType && hasPrincipal) && (
          <div className="flex gap-3">
            <button type="submit" disabled={isSubmitting || mutation.isPending} className="inline-flex w-full items-center justify-center gap-2 whitespace-normal rounded-control bg-primary px-4 py-2.5 font-medium text-bg disabled:opacity-70">
              {mutation.isPending ? (<><span className="h-4 w-4 animate-spin rounded-full border-2 border-bg/40 border-t-bg" />…</>) : ('Сохранить')}
            </button>
            <button type="button" onClick={() => navigate(-1)} className="rounded-control border border-line px-4 py-2.5 text-t2 transition hover:border-t3">Отмена</button>
          </div>
        )}
      </form>
    </div>
  );
}
