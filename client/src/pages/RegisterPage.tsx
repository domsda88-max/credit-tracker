import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { extractErrorMessage } from '../api/client';
import { useAuthStore } from '../store/auth';

interface FormValues {
  name: string;
  email: string;
  password: string;
}

export function RegisterPage() {
  const navigate = useNavigate();
  const registerUser = useAuthStore((state) => state.register);
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<FormValues>();

  const onSubmit = async (values: FormValues) => {
    setError(null);
    try {
      await registerUser(values.email, values.password, values.name || undefined);
      navigate('/', { replace: true });
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  };

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center px-4">
      <h1 className="text-2xl font-semibold text-slate-100">Регистрация</h1>
      <p className="mt-1 text-sm text-slate-500">Пароль — минимум 8 символов</p>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
        <label className="block">
          <span className="text-sm text-slate-400">Имя (необязательно)</span>
          <input
            {...register('name')}
            className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-slate-100 outline-none transition focus:border-sky-500"
          />
        </label>

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
            autoComplete="new-password"
            {...register('password', { required: true, minLength: 8 })}
            className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-slate-100 outline-none transition focus:border-sky-500"
          />
        </label>

        {error && <p className="text-sm text-rose-400">{error}</p>}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-xl bg-sky-500 py-2.5 font-medium text-slate-950 transition hover:bg-sky-400 disabled:opacity-50"
        >
          {isSubmitting ? 'Создаю…' : 'Создать аккаунт'}
        </button>
      </form>

      <p className="mt-4 text-sm text-slate-500">
        Уже есть аккаунт?{' '}
        <Link to="/login" className="text-sky-400 hover:text-sky-300">
          Войти
        </Link>
      </p>
    </div>
  );
}
