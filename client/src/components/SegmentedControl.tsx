interface Option<T extends string> { value: T; label: string; }
interface Props<T extends string> {
  value: T;
  options: Option<T>[];
  onChange: (value: T) => void;
  ariaLabel?: string;
}
export function SegmentedControl<T extends string>({ value, options, onChange, ariaLabel }: Props<T>) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="flex rounded-control border border-line bg-surface2/40 p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`flex-1 rounded-[10px] px-3 py-2 text-sm font-medium transition ${
            value === o.value ? 'bg-primary text-white' : 'text-t2 hover:text-t1'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}