import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Banknote,
  ChevronDown,
  CreditCard,
  Handshake,
  House,
  ReceiptText,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react';
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
    markPastAsPaid: z.boolean().default(false),
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

const typePassport: Record<FormValues['type'], { title: string; desc: string; req: string[]; icon: LucideIcon }> = {
  CONSUMER: { title: 'Потребительский кредит', desc: 'Фиксированный срок и ставка. График строит сервер.', req: ['Ставка %', 'Дата выдачи', 'Срок, мес.', 'День платежа'], icon: Banknote },
  CREDIT_CARD: { title: 'Кредитная карта', desc: 'Возобновляемый лимит. Нужны только ставка и день платежа.', req: ['Ставка %', 'День платежа'], icon: CreditCard },
  MORTGAGE: { title: 'Ипотека', desc: 'Долгосрочный кредит на недвижимость. Нужны дата выдачи и срок.', req: ['Ставка %', 'Дата выдачи', 'Срок, мес.', 'День платежа'], icon: House },
  INSTALLMENT: { title: 'Рассрочка / Сплит', desc: 'Короткая рассрочка в днях. Ставка может быть 0%.', req: ['Срок, дней', 'День платежа'], icon: ReceiptText },
  MICROLOAN: { title: 'Займ (МФО)', desc: 'Краткосрочный займ — один платёж в конце срока.', req: ['Ставка %', 'Срок, дней', 'День платежа'], icon: Zap },
  LOAN: { title: 'Займ (частный)', desc: 'Долг человеку без графика и ставки.', req: ['Дата выдачи'], icon: Handshake },
};

const TYPE_ORDER: FormValues['type'][] = [
  'CONSUMER',
  'CREDIT_CARD',
  'MORTGAGE',
  'INSTALLMENT',
  'MICROLOAN',
  'LOAN',
];

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
      markPastAsPaid: false,
    },
  });

  const type = watch('type');
  const frozen = watch('frozen');
  const markPast = watch('markPastAsPaid');
  const startDate = watch('startDate');
  const principal = watch('principal');
  const annualRate = watch('annualRate');
  const termMonths = watch('termMonths');

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
        setValue('markPastAsPaid', false);
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
        setValue('markPastAsPaid', false);
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
        setValue('markPastAsPaid', false);
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
        setValue('markPastAsPaid', false);
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
          parsed.type === 'CREDIT_CARD' || parsed.type === 'MICROLOAN'
            ? undefined
            : parsed.type === 'INSTALLMENT' && parsed.termDays
              ? Math.max(1, Math.ceil(parsed.termDays / 30))
              : parsed.termMonths,
      });
    },
    onSuccess: async (credit) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['credits'] }),
        queryClient.invalidateQueries({ queryKey: ['summary'] }),
      ]);
      navigate(`/credits/${credit.id}`);
    },
    onError: (err) => setError(extractErrorMessage(err)),
  });

  const pass = typePassport[type];
  const PassIcon = pass.icon;
  const monthly = type === 'CONSUMER' || type === 'MORTGAGE' ? annuityMonthly(Number(principal || 0), Number(annualRate || 0), Number(termMonths || 0)) : 0;

  const handleClose = () => navigate(-1);

  return (
    <div className="credit-create-shell min-w-0 w-full max-w-full page-stack">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-heading font-bold text-t1">Новый долг</h1>
        <button type="button" onClick={handleClose} aria-label="Закрыть" className="flex h-11 w-11 items-center justify-center rounded-full text-ink-on-dark transition hover:bg-surface2">
          <X size={20} />
        </button>
      </div>

      <form
        onSubmit={handleSubmit((values) =>
          mutation.mutate({
            ...values,
            earlyRepayments: earlyRepayments
              .filter((er) => er.amount && er.date)
              .map((er) => ({ amount: Number(er.amount), date: er.date })),
          }),
        )}
        className="page-stack touch-manipulation"
      >
        {/* Шаг 1. Тип долга — определяет, какие поля нужны дальше. */}
        <section className="card card-pad">
          <p className="section-title mb-3">Тип долга</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {TYPE_ORDER.map((t) => {
              const item = typePassport[t];
              const ItemIcon = item.icon;
              const selected = type === t;
              return (
                <button
                  key={t}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setValue('type', t, { shouldValidate: false })}
                  className={`flex flex-col items-start gap-2 rounded-control border p-3 text-left transition ${
                    selected
                      ? 'border-primary bg-primary/10'
                      : 'border-line bg-surface hover:border-primary/40'
                  }`}
                >
                  <span
                    className={`flex h-9 w-9 items-center justify-center rounded-chip ${
                      selected ? 'bg-primary/15 text-primary-fg' : 'bg-surface2 text-t3'
                    }`}
                  >
                    <ItemIcon size={18} aria-hidden="true" />
                  </span>
                  <span className={`text-xs font-medium leading-tight ${selected ? 'text-t1' : 'text-t2'}`}>
                    {item.title}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Шаг 2. Основное — есть у любого долга. */}
        <section className="card card-pad space-y-4">
          <p className="section-title">Основное</p>
          <label className="block">
            <span className="text-sm text-t2">Название <span className="text-danger-fg">*</span></span>
            <input placeholder="Например, Альфа-Банк" {...register('name')} className={inputClass} />
            {errors.name && <p className="mt-1 text-xs text-danger-fg">{errors.name.message}</p>}
          </label>
          <label className="block">
            <span className="text-sm text-t2">Сумма долга, ₽ <span className="text-danger-fg">*</span></span>
            <MoneyInput register={register} name="principal" placeholder="150 000" />
            {errors.principal && <p className="mt-1 text-xs text-danger-fg">{errors.principal.message}</p>}
          </label>
        </section>

        {/* Шаг 3. Параметры выбранного типа. */}
        <section className="card card-pad space-y-4">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control bg-primary/12 text-primary-fg">
              <PassIcon size={20} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-t1">{pass.title}</h2>
              <p className="mt-0.5 text-xs text-t3">{pass.desc}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {pass.req.map((r) => (
              <span key={r} className="rounded-full border border-line bg-surface2/60 px-2 py-0.5 text-[11px] text-ink-on-dark">
                {r}
              </span>
            ))}
          </div>

          {type === 'CREDIT_CARD' && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <label className="block">
                <span className="text-sm text-t2">Ставка, % годовых <span className="text-danger-fg">*</span></span>
                <input type="number" step="0.01" inputMode="decimal" placeholder="19.9" {...register('annualRate')} className={inputClass} />
                {errors.annualRate && <p className="mt-1 text-xs text-danger-fg">{errors.annualRate.message}</p>}
                <span className="mt-1 block text-xs text-t3">Ставка по Revolving, напр. 19,9</span>
              </label>
              <label className="block">
                <span className="text-sm text-t2">День платежа <span className="text-danger-fg">*</span></span>
                <input type="number" min={1} max={31} inputMode="numeric" placeholder="напр. 20" {...register('paymentDay')} className={inputClass} />
                {errors.paymentDay && <p className="mt-1 text-xs text-danger-fg">{errors.paymentDay.message}</p>}
                <span className="mt-1 block text-xs text-t3">Число месяца для min. платежа</span>
              </label>
              <label className="block">
                <span className="text-sm text-t2">Сумма для продления грейса, ₽</span>
                <MoneyInput register={register} name="graceReplenishSum" placeholder="43 000" />
                {errors.graceReplenishSum && <p className="mt-1 text-xs text-danger-fg">{errors.graceReplenishSum.message}</p>}
                <span className="mt-1 block text-xs text-t3">Опционально</span>
              </label>
            </div>
          )}

          {(type === 'CONSUMER' || type === 'MORTGAGE') && (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <label className="block">
                  <span className="text-sm text-t2">Тип платежа</span>
                  <select {...register('paymentType')} className={inputClass}>
                    <option value="ANNUITY">Аннуитетный</option>
                    <option value="DIFFERENTIAL">Дифференцированный</option>
                  </select>
                  <span className="mt-1 block text-xs text-t3">Аннуитет — равные платежи, дифф. — убывающие</span>
                </label>
                <label className="block">
                  <span className="text-sm text-t2">Ставка, % годовых <span className="text-danger-fg">*</span></span>
                  <input type="number" step="0.01" placeholder="19.9" {...register('annualRate')} className={inputClass} />
                  {errors.annualRate && <p className="mt-1 text-xs text-danger-fg">{errors.annualRate.message}</p>}
                </label>
                <label className="block">
                  <span className="text-sm text-t2">Дата выдачи <span className="text-danger-fg">*</span></span>
                  <input type="date" {...register('startDate')} className={inputClass} />
                  {errors.startDate && <p className="mt-1 text-xs text-danger-fg">{errors.startDate.message}</p>}
                </label>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm text-t2">Срок, месяцев <span className="text-danger-fg">*</span></span>
                  <input type="number" placeholder="напр. 36" {...register('termMonths')} className={inputClass} />
                  {errors.termMonths && <p className="mt-1 text-xs text-danger-fg">{errors.termMonths.message}</p>}
                </label>
                <label className="block">
                  <span className="text-sm text-t2">День платежа <span className="text-danger-fg">*</span></span>
                  <input type="number" min={1} max={31} inputMode="numeric" placeholder="напр. 20" {...register('paymentDay')} className={inputClass} />
                  {errors.paymentDay && <p className="mt-1 text-xs text-danger-fg">{errors.paymentDay.message}</p>}
                </label>
              </div>
              {monthly > 0 && (
                <p className="text-sm text-t2">≈ Ежемесячно <b className="tabular text-t1">{formatMoney(monthly)}</b></p>
              )}
            </>
          )}

          {type === 'INSTALLMENT' && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <label className="block">
                <span className="text-sm text-t2">Срок, дней <span className="text-danger-fg">*</span></span>
                <input type="number" inputMode="numeric" min="1" placeholder="напр. 90" {...register('termDays')} className={inputClass} />
                {errors.termDays && <p className="mt-1 text-xs text-danger-fg">{errors.termDays.message}</p>}
              </label>
              <label className="block">
                <span className="text-sm text-t2">День платежа <span className="text-danger-fg">*</span></span>
                <input type="number" min={1} max={31} inputMode="numeric" placeholder="напр. 20" {...register('paymentDay')} className={inputClass} />
                {errors.paymentDay && <p className="mt-1 text-xs text-danger-fg">{errors.paymentDay.message}</p>}
              </label>
              <label className="block">
                <span className="text-sm text-t2">Ставка, % годовых</span>
                <input type="number" step="0.01" placeholder="0" {...register('annualRate')} className={inputClass} />
                {errors.annualRate && <p className="mt-1 text-xs text-danger-fg">{errors.annualRate.message}</p>}
                <span className="mt-1 block text-xs text-t3">0% — без процентов</span>
              </label>
            </div>
          )}

          {type === 'MICROLOAN' && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <label className="block">
                <span className="text-sm text-t2">Ставка, % годовых <span className="text-danger-fg">*</span></span>
                <input type="number" step="0.01" placeholder="напр. 292" {...register('annualRate')} className={inputClass} />
                {errors.annualRate && <p className="mt-1 text-xs text-danger-fg">{errors.annualRate.message}</p>}
              </label>
              <label className="block">
                <span className="text-sm text-t2">Срок, дней <span className="text-danger-fg">*</span></span>
                <input type="number" placeholder="напр. 30" {...register('termDays')} className={inputClass} />
                {errors.termDays && <p className="mt-1 text-xs text-danger-fg">{errors.termDays.message}</p>}
                <span className="mt-1 block text-xs text-t3">До 365 дней</span>
              </label>
              <label className="block">
                <span className="text-sm text-t2">День платежа <span className="text-danger-fg">*</span></span>
                <input type="number" min={1} max={31} inputMode="numeric" placeholder="напр. 20" {...register('paymentDay')} className={inputClass} />
                {errors.paymentDay && <p className="mt-1 text-xs text-danger-fg">{errors.paymentDay.message}</p>}
              </label>
            </div>
          )}

          {type === 'LOAN' && (
            <label className="block">
              <span className="text-sm text-t2">Дата выдачи <span className="text-danger-fg">*</span></span>
              <input type="date" {...register('startDate')} className={inputClass} />
              {errors.startDate && <p className="mt-1 text-xs text-danger-fg">{errors.startDate.message}</p>}
              <span className="mt-1 block text-xs text-t3">Обязательно для корректного учёта срока займа</span>
            </label>
          )}
        </section>

        {/* Шаг 4. Необязательные детали — спрятаны, чтобы не перегружать экран. */}
        <details className="card card-pad group">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-sm font-medium text-t1 [&::-webkit-details-marker]:hidden">
            Дополнительно
            <span className="flex items-center gap-2 text-xs text-t3">
              необязательно
              <ChevronDown size={16} className="transition-transform group-open:rotate-180" aria-hidden="true" />
            </span>
          </summary>

          <div className="mt-4 space-y-4">
            {type === 'CREDIT_CARD' && (
              <>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-sm text-t2">Льготный период до</span>
                    <input type="date" {...register('gracePeriodEnds')} className={inputClass} />
                  </label>
                  <label className="block">
                    <span className="text-sm text-t2">День пополнения</span>
                    <input type="number" min={1} max={31} {...register('graceReplenishDay')} className={inputClass} />
                    {errors.graceReplenishDay && <p className="mt-1 text-xs text-danger-fg">{errors.graceReplenishDay.message}</p>}
                  </label>
                </div>
                <label className="flex items-start gap-2 text-sm text-t2">
                  <input type="checkbox" {...register('frozen')} className="mt-0.5 h-4 w-4 shrink-0 accent-success" />
                  <span>Цикл заморозки — проценты не начисляются, платёж не обязателен</span>
                </label>
                {frozen && (
                  <label className="block">
                    <span className="text-sm text-t2">Период заморозки, дней</span>
                    <input type="number" min={1} max={365} {...register('freezeCycleDays')} className={inputClass} />
                    {errors.freezeCycleDays && <p className="mt-1 text-xs text-danger-fg">{errors.freezeCycleDays.message}</p>}
                  </label>
                )}
              </>
            )}

            {(type === 'CONSUMER' || type === 'MORTGAGE') && (
              <div className="space-y-3">
                <label className="flex items-start gap-2 text-sm text-t2">
                  <input type="checkbox" {...register('markPastAsPaid')} className="mt-0.5 h-4 w-4 shrink-0 accent-success" />
                  <span>
                    Кредит оформлен раньше — прошедшие платежи считаем внесёнными
                    <span className="mt-0.5 block text-xs text-t3">
                      {startInPast
                        ? 'Дата выдачи в прошлом: график построится целиком, прошедшие платежи отметятся оплаченными, а остаток долга уменьшится на «тело».'
                        : 'Укажите прошедшую дату выдачи, чтобы это сработало.'}
                    </span>
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

            <div className="space-y-3">
              <p className="text-sm font-medium text-t2">История досрочных погашений</p>
              {earlyRepayments.map((er, idx) => (
                <div key={idx} className="flex gap-2">
                  <input
                    type="number"
                    placeholder="Сумма, ₽"
                    value={er.amount}
                    onChange={(e) => {
                      const updated = [...earlyRepayments];
                      updated[idx] = { ...updated[idx], amount: e.target.value };
                      setEarlyRepayments(updated);
                    }}
                    className="flex-1 rounded-control border border-line bg-surface px-3 py-2 text-t1"
                  />
                  <input
                    type="date"
                    value={er.date}
                    onChange={(e) => {
                      const updated = [...earlyRepayments];
                      updated[idx] = { ...updated[idx], date: e.target.value };
                      setEarlyRepayments(updated);
                    }}
                    className="flex-1 rounded-control border border-line bg-surface px-3 py-2 text-t1"
                  />
                  <button
                    type="button"
                    aria-label="Удалить досрочное погашение"
                    onClick={() => setEarlyRepayments(earlyRepayments.filter((_, i) => i !== idx))}
                    className="flex w-11 shrink-0 items-center justify-center rounded-control border border-danger/40 text-critical-fg"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setEarlyRepayments([...earlyRepayments, { amount: '', date: '' }])}
                className="w-full rounded-control border border-line px-3 py-2 text-sm text-t2"
              >
                + Добавить досрочку
              </button>
            </div>
          </div>
        </details>

        {/* Шаг 5. Предпросмотр и сохранение. */}
        {principal !== undefined && Number(principal) > 0 && (
          <section className="card card-pad">
            <p className="section-title">Предпросмотр</p>
            <div className="mt-3 space-y-1 text-sm">
              <p className="flex items-center justify-between gap-3">
                <span className="text-t2">Сумма долга</span>
                <b className="tabular text-t1">{formatMoney(Number(principal))}</b>
              </p>
              <p className="flex items-center justify-between gap-3">
                <span className="text-t2">Тип</span>
                <b className="text-t1">{pass.title}</b>
              </p>
              {monthly > 0 && (
                <p className="flex items-center justify-between gap-3">
                  <span className="text-t2">≈ Ежемесячно</span>
                  <b className="tabular text-t1">{formatMoney(monthly)}</b>
                </p>
              )}
            </div>
            <p className="mt-2 text-xs text-t3">Точный график построится на сервере после сохранения.</p>
          </section>
        )}

        {error && <p className="text-sm text-danger-fg">{error}</p>}

        <div className="flex gap-3">
          <button type="submit" disabled={isSubmitting || mutation.isPending} className="btn btn-primary w-full">
            {mutation.isPending ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-bg/40 border-t-bg" />
                …
              </>
            ) : (
              'Сохранить'
            )}
          </button>
          <button type="button" onClick={() => navigate(-1)} className="btn btn-secondary">
            Отмена
          </button>
        </div>
      </form>
    </div>
  );
}
