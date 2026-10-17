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
      <h1 className="text-2xl font-semibold text-slate-100">Вход</h1>
      <p className="mt-1 text-sm text-slate-500">Контроль кредитов и напоминания о платежах</p>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
        <label className="block">
          <span className="text-sm text-slate-400">Email</span>
          <input
            type="email"
            autoComplete="email"
            {...register('email', { required: true })}
            className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-slate-100 outline-none transition focus:border-sky-500"
          />
        </label>

        <label className="block">
          <span className="text-sm text-slate-400">Пароль</span>
          <input
            type="password"
            autoComplete="current-password"
            {...register('password', { required: true })}
            className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-slate-100 outline-none transition focus:border-sky-500"
          />
        </label>

        {error && <p className="text-sm text-rose-400">{error}</p>}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-xl bg-sky-500 py-2.5 font-medium text-slate-950 transition hover:bg-sky-400 disabled:opacity-50"
        >
          {isSubmitting ? 'Вхожу…' : 'Войти'}
        </button>
      </form>

      <p className="mt-4 text-sm text-slate-500">
        Нет аккаунта?{' '}
        <Link to="/register" className="text-sky-400 hover:text-sky-300">
          Зарегистрироваться
        </Link>
      </p>
    </div>
  );
}
