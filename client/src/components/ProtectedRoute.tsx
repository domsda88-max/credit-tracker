import { useEffect, useState, type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';

/** Пускает только авторизованных; сохранённый токен сначала проверяем через /auth/me. */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const token = useAuthStore((state) => state.token);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const restoreSession = useAuthStore((state) => state.restoreSession);
  const [checked, setChecked] = useState(!token);

  useEffect(() => {
    let active = true;
    if (!token) {
      setChecked(true);
      return;
    }

    void restoreSession().finally(() => {
      if (active) setChecked(true);
    });
    return () => {
      active = false;
    };
  }, [token, restoreSession]);

  if (!token) return <Navigate to="/login" replace />;
  // Не редиректим на логин, пока идёт проверка: иначе мигание на каждом reload.
  if (!checked) return <div className="page-stack" aria-busy="true" />;

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
