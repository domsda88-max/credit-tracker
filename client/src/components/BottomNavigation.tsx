import { Home, PlusCircle, Settings } from 'lucide-react';
import { NavLink } from 'react-router-dom';

/**
 * Нижняя навигация: ровно три реальных роута из App.tsx.
 * Геометрия — в .tabbar (fixed + safe-area), отступ контента — в .page.
 * Это единственный источник правды: ручных pb-компенсаций больше нет.
 */
const TABS = [
  { name: 'Главная', path: '/', icon: Home, end: true },
  { name: 'Добавить', path: '/credits/new', icon: PlusCircle, end: false },
  { name: 'Настройки', path: '/settings', icon: Settings, end: false },
] as const;

export function BottomNavigation() {
  return (
    <div className="tabbar">
      <nav
        className="flex items-center justify-around rounded-full border border-line/70 bg-surface/95 px-2 backdrop-blur-2xl"
        aria-label="Основная навигация"
      >
        {TABS.map(({ name, path, icon: Icon, end }) => (
          <NavLink
            key={path}
            to={path}
            end={end}
            className={({ isActive }) =>
              [
                'flex h-full min-h-[44px] w-full flex-col items-center justify-center gap-1 rounded-full transition-colors duration-200',
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
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
