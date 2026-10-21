import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  [
    'flex flex-col items-center gap-0.5 rounded-lg px-3 py-1.5 text-xs font-medium transition',
    isActive ? 'bg-sky-500/15 text-sky-300' : 'text-slate-400 active:bg-slate-800/60',
  ].join(' ');

export function Layout() {
  const navigate = useNavigate();
  const logout = useAuthStore((state) => state.logout);
  const user = useAuthStore((state) => state.user);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    // h-full + overflow-hidden: экран не двигается, скроллится только <main>
    <div className="mx-auto flex h-full w-full max-w-3xl flex-col overflow-hidden px-4 sm:px-6">
      <header className="flex shrink-0 items-center justify-between gap-3 pb-3 pt-[max(1rem,env(safe-area-inset-top))]">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-500/15 text-xl font-bold text-sky-400">
            ₽
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-100">Credit Tracker</p>
            <p className="truncate text-xs text-slate-500">{user?.email}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="shrink-0 rounded-lg px-2.5 py-2 text-sm font-medium text-slate-400 transition active:bg-slate-800/60"
        >
          Выйти
        </button>
      </header>

      {/* Единственная прокручиваемая область приложения */}
      <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-2 [-webkit-overflow-scrolling:touch]">
        <Outlet />
      </main>

      <nav className="flex shrink-0 items-center justify-center gap-2 border-t border-slate-800 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2">
        <NavLink to="/" end className={navLinkClass}>
          <span className="text-base leading-none">📊</span>
          Обзор
        </NavLink>
        <NavLink to="/credits/new" className={navLinkClass}>
          <span className="text-base leading-none">➕</span>
          Добавить
        </NavLink>
      </nav>
    </div>
  );
}