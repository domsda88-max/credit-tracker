import type { PaymentScheduleItem } from '../types';
import { formatMoneyShort } from '../utils/format';

interface Props {
  schedule: PaymentScheduleItem[];
  principal: number | string;
  outstanding: number | string;
}

/**
 * График динамики долга: как уменьшается остаток от первоначальной суммы до нуля.
 * Просили в отзывах конкурентов (AlmostZero: «нет таймлайна с прошлым балансом»).
 * Рисуем чистым SVG — без тяжёлых библиотек.
 */
export function BalanceChart({ schedule, principal, outstanding }: Props) {
  if (schedule.length === 0) return null;

  const start = Number(principal);
  const current = Math.max(0, Number(outstanding));

  // Точки: начало, затем остаток после каждого платежа.
  const points: number[] = [start];
  let left = start;
  for (const item of schedule) {
    left = Math.max(0, left - Number(item.principalPart));
    points.push(left);
  }

  const width = 100;
  const height = 32;
  const max = Math.max(...points, 1);
  const step = width / (points.length - 1);

  const path = points
    .map((value, i) => {
      const x = i * step;
      const y = height - (value / max) * height;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');

  const areaPath = `${path} L${width},${height} L0,${height} Z`;

  // Индекс точки «сейчас» — первый непогашенный платёж.
  const firstPending = schedule.findIndex((item) => item.status !== 'PAID');
  const currentIndex = firstPending === -1 ? points.length - 1 : firstPending + 1;

  return (
    <div className="rounded-card border border-line bg-surface/80 p-4">
      <div className="flex items-baseline justify-between">
        <h2 className="font-medium text-t1">Динамика долга</h2>
        <p className="text-xs text-t3">
          {formatMoneyShort(start)} → 0
        </p>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="mt-3 h-24 w-full"
        role="img"
        aria-label="График уменьшения долга"
      >
        <defs>
          <linearGradient id="debtFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#debtFill)" />
        <path d={path} fill="none" stroke="#38bdf8" strokeWidth="0.8" vectorEffect="non-scaling-stroke" />
        <circle
          cx={(currentIndex * step).toFixed(2)}
          cy={(height - (points[currentIndex] / max) * height).toFixed(2)}
          r="1.6"
          fill="#f8fafc"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      <div className="mt-1 flex justify-between text-xs text-t3">
        <span>старт</span>
        <span>сейчас · остаток {formatMoneyShort(current)}</span>
        <span>ноль</span>
      </div>
    </div>
  );
}
