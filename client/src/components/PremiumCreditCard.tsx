import { CreditCard as CardIcon, MoreVertical } from 'lucide-react';
import { Link } from 'react-router-dom';

type Props = {
  id: string;
  name: string;
  bankName: string;
  rate: number;
  outstanding: number;
  initial: number;
  nextPaymentDate: string;
  nextPaymentAmount: number;
};

export function PremiumCreditCard({ id, name, bankName, rate, outstanding, initial, nextPaymentDate, nextPaymentAmount }: Props) {
  const paidPercent = Math.min(100, Math.max(0, ((initial - outstanding) / initial) * 100));

  const money = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });

  return (
    <Link
      to={`/credits/${id}`}
      className="block relative overflow-hidden rounded-card bg-surface p-6
                 shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-line/40
                 transition-transform duration-300 hover:scale-[1.01] active:scale-[0.99]"
    >
      {/* Декоративный фон-градиент (использует primary с прозрачностью) */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 blur-3xl rounded-full -mr-20 -mt-20 pointer-events-none" />

      <div className="flex justify-between items-start mb-6 relative z-10">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-surface2 text-t1">
            <CardIcon size={20} strokeWidth={2} />
          </div>
          <div>
            <h3 className="text-t1 font-semibold text-lg leading-tight">{name}</h3>
            <p className="text-t3 text-micro">{bankName} · {rate}%</p>
          </div>
        </div>
        <button className="text-t3 hover:text-t1 transition-colors p-1" aria-label="Меню" onClick={(e) => e.preventDefault()}>
          <MoreVertical size={20} />
        </button>
      </div>

      <div className="mb-6 relative z-10">
        <p className="text-t3 text-micro uppercase tracking-widest mb-1">Остаток долга</p>
        <p className="text-t1 text-4xl font-bold tracking-tight tabular-nums">
          {money.format(outstanding)} ₽
        </p>
      </div>

      <div className="relative z-10">
        <div className="flex justify-between text-micro text-t3 mb-2">
          <span>Выплачено {Math.round(paidPercent)}%</span>
          <span>из {money.format(initial)} ₽</span>
        </div>
        {/* Прогресс-бар */}
        <div className="h-2 w-full bg-surface2 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-1000 ease-out shadow-[0_0_8px_rgba(59,130,246,0.6)]"
            style={{ width: `${paidPercent}%` }}
          />
        </div>
      </div>

      <div className="mt-5 pt-4 border-t border-line/50 flex justify-between items-center relative z-10">
        <div>
          <p className="text-t3 text-micro mb-0.5">Ближайший платёж</p>
          <p className="text-t1 text-sm font-medium tabular-nums">
            {money.format(nextPaymentAmount)} ₽
          </p>
        </div>
        <div className="text-right">
          <p className="text-t3 text-micro mb-0.5">Дата</p>
          <p className="text-t1 text-sm font-medium">{nextPaymentDate}</p>
        </div>
      </div>
    </Link>
  );
}