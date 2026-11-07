import { Home, Settings } from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import { creditsApi } from '../api/credits';
import { useQuery } from '@tanstack/react-query';

/**
 * Нижняя навигация: ровно два реальных роута.
 * Геометрия — в .tabbar (fixed bottom: 0 + safe-area), отступ контента — в .page.
 * Капсула активного таба строго внутри контейнера таб-бара.
 */
const TABS = [
  { name: 'Главная', path: '/', icon: Home, end: true },
  { name: 'Настройки', path: '/settings', icon: Settings, end: false },
] as const;

interface BadgeProps {
  count: number;
  overdue: boolean;
}

function Badge({ count, overdue }: BadgeProps) {
  if (!count) return null;
  return (
    <span
      aria-label={count === 1 ? '1 платёж в этом месяце' : `${count} платежа в этом месяце`}
      className={`absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold text-bg transition-colors ${
        overdue ? 'bg-danger' : 'bg-primary'
      }`}
    >
      {count > 9 ? '9+' : count}
    </span>
  );
}

export function BottomNavigation() {
  const location = useLocation();
  const { data: summary } = useQuery({
    queryKey: ['summary'],
    queryFn: () => creditsApi.summary(),
    staleTime: 60_000,
  });

  const isDashboard = location.pathname === '/';
  const monthlyPayments = summary?.monthlyPayments ?? 0;
  const overdueCount = summary?.graceReplenishTotal ? 0 : 0; // will be replaced by real overdue check
  const overdue = false; // summary doesn't expose overdue count directly; neutral by default

  return (
    <div className="tabbar">
      <nav
        className="flex items-center justify-around rounded-full border border-line/70 bg-surface/95 px-2.5 backdrop-blur-2xl"
        aria-label="Основная навигация"
      >
        {TABS.map(({ name, path, icon: Icon, end }) => (
          <NavLink
            key={path}
            to={path}
            end={end}
            className={({ isActive }) =>
              [
                'relative flex h-full min-h-[44px] w-full flex-col items-center justify-center gap-1 rounded-full transition-colors duration-200',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
                isActive ? 'bg-primary/10 text-primary' : 'text-t3 hover:bg-surface2/60 hover:text-t1',
              ].join(' ')
            }
          >
            {({ isActive }) => (
              <>
                <Icon
                  size={22}
                  strokeWidth={isActive ? 2.2 : 2}
                  aria-hidden="true"
                  className={`transition-transform duration-200 ${isActive ? 'scale-110' : ''}`}
                />
                <span className={`text-micro ${isActive ? 'font-bold' : 'font-medium'}`}>
                  {name}
                </span>
                {name === 'Главная' && monthlyPayments > 0 && (
                  <Badge count={monthlyPayments} overdue={overdue} />
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
