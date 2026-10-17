import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  [
    'rounded-lg px-3 py-2 text-sm font-medium transition',
    isActive ? 'bg-sky-500/15 text-sky-300' : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200',
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
    <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-4 pb-24 pt-6 sm:px-6">
      <header className="mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/15 text-xl font-bold text-sky-400">
            ₽
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-100">Credit Tracker</p>
            <p className="text-xs text-slate-500">{user?.email}</p>
          </div>
        </div>

        <nav className="flex items-center gap-1">
          <NavLink to="/" end className={navLinkClass}>
            Дашборд
          </NavLink>
          <NavLink to="/credits/new" className={navLinkClass}>
            Добавить
          </NavLink>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-lg px-3 py-2 text-sm font-medium text-slate-400 transition hover:bg-slate-800/60 hover:text-rose-300"
          >
            Выйти
          </button>
        </nav>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}
