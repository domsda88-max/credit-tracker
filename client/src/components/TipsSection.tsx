import { ChevronRight, Lightbulb, BookOpen, Zap, Clock } from 'lucide-react';
import { useState } from 'react';

const TIPS = [
  {
    title: 'Досрочное погашение экономит проценты',
    text: 'Каждый досрочный платеж уменьшает остаток долга, и банк начисляется проценты на меньшую сумму. Даже небольшая сумма поможет.',
    icon: <Zap size={16} className="text-primary-fg" />,
  },
  {
    title: 'Лавина против снежного кома',
    text: 'Лавина — гасите сначала самый дорогой по ставке долг (максимальная экономия). Снежный ком — сначала самый маленький остаток (быстрая мотивация). Выберите свою стратегию.',
    icon: <Lightbulb size={16} className="text-warning-fg" />,
  },
  {
    title: 'Льготный период по кредитной карте',
    text: 'Вносите сумму обновления грейса до указанной даты — и проценты не будут начислены. Пропуск платежа сжигает льготный период.',
    icon: <BookOpen size={16} className="text-success-fg" />,
  },
  {
    title: 'Платите вовремя',
    text: 'Даже одна просрочка может испортить кредитную историю и привести к штрафам. Настройте напоминания в приложении.',
    icon: <Clock size={16} className="text-danger-fg" />,
  },
];

export function TipsSection() {
  const [open, setOpen] = useState(false);
  return (
    <section className="card card-pad border border-primary/30 bg-primary/5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Lightbulb size={20} className="text-warning-fg" />
          <h3 className="text-heading font-semibold text-t1">Советы по финансам</h3>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="rounded-control p-1.5 text-t3 transition hover:bg-surface2"
          aria-expanded={open}
          aria-label="Развернуть советы"
        >
          <ChevronRight size={16} className={`transition-transform ${open ? 'rotate-90' : ''}`} />
        </button>
      </div>
      <div className="space-y-3" style={{ maxHeight: open ? 500 : 0, overflow: 'hidden', transition: 'max-height 300ms ease' }}>
        {TIPS.map((tip, i) => (
          <div key={i} className="flex items-start gap-3 p-3 rounded-control border border-line bg-surface">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control bg-surface2">{tip.icon}</div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-t1">{tip.title}</p>
              <p className="mt-0.5 text-xs text-t3 leading-relaxed">{tip.text}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
