import { ArrowRight, CheckCircle2, Zap, Clock } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const STORAGE_KEY = 'credit-tracker-onboarded';

const SLIDES = [
  {
    title: 'Контролируйте свои долги',
    text: 'Добавляйте кредиты, рассрочки, кредитные карты и займы — всё в одном месте.',
    icon: <Zap size={32} className="text-primary-fg" />,
  },
  {
    title: 'Не пропускайте платежи',
    text: 'Получайте напоминания за 3, 2, 1 день и в день платежа. Просрочка под контролем.',
    icon: <Clock size={32} className="text-warning-fg" />,
  },
  {
    title: 'Закрывайте долги быстрее',
    text: 'Вносите досрочные платежи и смотрите, сколько процентов сэкономите и сколько месяцев сократите.',
    icon: <ArrowRight size={32} className="text-success-fg" />,
  },
];

export function Onboarding() {
  const [index, setIndex] = useState(0);
  const navigate = useNavigate();

  const isLast = index === SLIDES.length - 1;

  const finish = () => {
    try {
      localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      /* ignore */
    }
    navigate('/', { replace: true });
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-bg p-6">
      <div className="max-w-md w-full space-y-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary-fg mb-4">
          {SLIDES[index].icon}
        </div>
        <h2 className="text-2xl font-bold text-t1 text-center">{SLIDES[index].title}</h2>
        <p className="text-t3 text-center">{SLIDES[index].text}</p>

        <div className="flex justify-center gap-1">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={`h-1.5 w-3 rounded-full transition-colors ${
                i <= index ? 'bg-primary' : 'bg-line'
              }`}
            />
          ))}
        </div>

        <div className="mt-8 space-y-3">
          {isLast ? (
            <button
              type="button"
              onClick={finish}
              className="w-full rounded-control bg-primary px-6 py-3 font-semibold text-bg transition hover:bg-primary/90"
            >
              Начать пользоваться <CheckCircle2 size={18} className="ml-1" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setIndex((i) => i + 1)}
              className="w-full rounded-control border border-line px-6 py-3 font-semibold text-t1 transition hover:bg-surface2"
            >
              Далее <ArrowRight size={18} className="ml-1" />
            </button>
          )}
          {!isLast && (
            <button
              type="button"
              onClick={finish}
              className="w-full text-sm text-t3 hover:text-t1 transition underline"
            >
              Пропустить введение
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function useOnboarding(): boolean {
  if (typeof localStorage === 'undefined') return false;
  try {
    return localStorage.getItem(STORAGE_KEY) !== '1';
  } catch {
    return false;
  }
}
