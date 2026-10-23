import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { extractErrorMessage } from '../api/client';

interface FormValues {
  email: string;
  password: string;
}

export function LoginPage() {
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<FormValues>();

  const onSubmit = async (values: FormValues) => {
    setError(null);
    try {
      await login(values.email, values.password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  };

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center px-4">
      <h1 className="text-2xl font-semibold text-t1">Вход</h1>
      <p className="mt-1 text-sm text-t3">Контроль кредитов и напоминания о платежах</p>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
        <label className="block">
          <span className="text-sm text-t2">Email</span>
          <input
            type="email"
            autoComplete="email"
            {...register('email', { required: true })}
            className="mt-1 w-full rounded-control border border-line bg-surface px-3 py-2.5 text-t1 outline-none transition focus:border-primary"
          />
        </label>

        <label className="block">
          <span className="text-sm text-t2">Пароль</span>
          <input
            type="password"
            autoComplete="current-password"
            {...register('password', { required: true })}
            className="mt-1 w-full rounded-control border border-line bg-surface px-3 py-2.5 text-t1 outline-none transition focus:border-primary"
          />
        </label>

        {error && <p className="text-sm text-danger">{error}</p>}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-control bg-primary py-2.5 font-medium text-white transition hover:bg-primary/90 disabled:opacity-50"
        >
          {isSubmitting ? 'Вхожу…' : 'Войти'}
        </button>
      </form>

      <p className="mt-4 text-sm text-t3">
        Нет аккаунта?{' '}
        <Link to="/register" className="text-primary hover:text-primary">
          Зарегистрироваться
        </Link>
      </p>
    </div>
  );
}
