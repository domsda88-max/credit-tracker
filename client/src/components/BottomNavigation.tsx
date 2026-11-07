import { Home, Settings } from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

/**
 * Нижняя навигация: ровно два реальных роута.
 * Геометрия — в .tabbar (fixed bottom: 0 + safe-area), отступ контента — в .page.
 * Капсула активного таба строго внутри контейнера таб-бара.
 */
const TABS = [
  { name: 'Главная', path: '/', icon: Home },
  { name: 'Настройки', path: '/settings', icon: Settings },
] as const;

export function BottomNavigation() {
  const location = useLocation();

  return (
    <div className="tabbar">
      <nav
        className="flex items-center justify-around rounded-full border border-line/70 bg-surface/95 px-2.5 backdrop-blur-2xl"
        aria-label="Основная навигация"
      >
        {TABS.map(({ name, path, icon: Icon }) => (
          <NavLink
            key={path}
            to={path}
            end={path === '/'}
            aria-label={name}
            className={({ isActive }) =>
              [
                'relative flex h-full min-h-[44px] w-full items-center justify-center rounded-full transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
                isActive ? 'bg-accent/15 text-accent' : 'text-t3 hover:bg-surface2/60 hover:text-t1',
              ].join(' ')
            }
          >
            <Icon
              size={24}
              strokeWidth={2}
              aria-hidden="true"
              className="transition-transform duration-200"
            />
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
