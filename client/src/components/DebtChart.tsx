import { useMemo } from 'react';

type Props = {
  data: { date: string; amount: number }[];
};

export function DebtChart({ data }: Props) {
  const W = 400;
  const H = 160;
  const padX = 12;
  const padY = 12;

  const { line, area, points } = useMemo(() => {
    if (!data || data.length === 0) return { line: '', area: '', points: [] as { x: number; y: number; d: string; v: number }[] };
    const vals = data.map((x) => x.amount);
    const minV = Math.min(...vals);
    const maxV = Math.max(...vals);
    const span = Math.max(1, maxV - minV);
    const step = (W - padX * 2) / Math.max(1, data.length - 1);

    const pts = data.map((d, i) => ({
      x: padX + i * step,
      y: padY + (H - padY * 2) * ((maxV - d.amount) / span),
      d: d.date,
      v: d.amount,
    }));

    const l = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
    const a = `${l} L ${pts[pts.length - 1].x.toFixed(1)} ${H - padY} L ${pts[0].x.toFixed(1)} ${H - padY} Z`;
    return { line: l, area: a, points: pts };
  }, [data]);

  return (
    <div className="w-full rounded-card bg-surface p-4 border border-line/40 shadow-sm">
      <h3 className="text-t1 font-semibold text-sm mb-4 ml-2">Динамика долга</h3>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-48" role="img" aria-label="График динамики долга">
        <defs>
          <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgb(var(--c-primary))" stopOpacity="0.35" />
            <stop offset="100%" stopColor="rgb(var(--c-primary))" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((t) => (
          <line
            key={t}
            x1={padX}
            x2={W - padX}
            y1={padY + (H - padY * 2) * t}
            y2={padY + (H - padY * 2) * t}
            stroke="rgb(var(--c-line))"
            strokeDasharray="4 4"
            opacity={0.5}
          />
        ))}
        {area && <path d={area} fill="url(#chartFill)" />}
        {line && <path d={line} fill="none" stroke="rgb(var(--c-primary))" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />}
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={3.5} fill="rgb(var(--c-primary))" stroke="rgb(var(--c-surface))" strokeWidth={2} />
        ))}
        {points.length > 0 && (
          <>
            <text x={points[0].x} y={H - 2} fontSize={9} textAnchor="start" fill="rgb(var(--c-t3))">{points[0].d}</text>
            <text x={points[points.length - 1].x} y={H - 2} fontSize={9} textAnchor="end" fill="rgb(var(--c-t3))">{points[points.length - 1].d}</text>
          </>
        )}
      </svg>
    </div>
  );
}