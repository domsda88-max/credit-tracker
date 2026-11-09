import { useGamification } from '../hooks/useGamification';
import { BadgeUnlocked } from '../components/BadgeUnlocked';
import { formatMoney } from '../utils/format';

export function AchievementsPage() {
  const {
    state,
    badges,
    unlockedBadges,
    lockedBadges,
    currentLevel,
    addBadge,
    incrementStreak,
    recordPayment,
    recordEarlyRepayment,
    hasBadge,
  } = useGamification();

  const progress = Math.min(100, Math.round((state.badges.length / Object.keys(badges).length) * 100));

  return (
    <section className="space-y-6 animate-fade-up">
      <header className="card p-6 border border-primary/30 bg-primary/5">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-surface">
            <span className="text-3xl">{currentLevel.icon}</span>
          </div>
          <div>
            <p className="text-micro uppercase tracking-[0.04em] text-t3">Ваш уровень</p>
            <p className="text-heading font-bold text-t1">{currentLevel.title}</p>
          </div>
        </div>

        <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-surface2">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary to-success transition-[width] duration-700 ease-app"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="mt-2 flex justify-between text-micro text-t3">
          <span>{state.badges.length} из {Object.keys(badges).length} достижений</span>
          <span>{progress}% прогресса</span>
        </div>
      </header>

      <section className="card p-6">
        <div className="flex items-baseline justify-between gap-2 mb-6">
          <h2 className="text-heading font-semibold text-t1">Ваши достижения</h2>
          <span className="tabular text-sm font-semibold text-t1">{state.badges.length}</span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {unlockedBadges.map((badge) => (
            <div
              key={badge.id}
              className="p-4 rounded-card border border-success/20 bg-success/5 flex items-start gap-3"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control bg-success/15 text-success-fg">
                <span className="text-xl">{badge.icon}</span>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-t1">{badge.title}</p>
                <p className="mt-0.5 text-xs text-t3">{badge.description}</p>
                <p className="mt-1 text-[10px] text-success-fg/80">Разблокировано</p>
              </div>
            </div>
          ))}
        </div>

        {lockedBadges.length > 0 && (
          <div className="mt-6">
            <h3 className="text-micro uppercase tracking-[0.04em] text-t3">Скоро</h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mt-3">
              {lockedBadges.map((badge) => (
                <div
                  key={badge.id}
                  className="p-4 rounded-card border border-line/40 bg-surface2/60 flex items-start gap-3 opacity-60"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control bg-surface text-t3">
                    <span className="text-xl">{badge.icon}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-t2">{badge.title}</p>
                    <p className="mt-0.5 text-xs text-t3">{badge.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="card p-6 border border-warning/20 bg-warning/5">
        <div className="flex items-baseline justify-between gap-2 mb-4">
          <h3 className="text-heading font-semibold text-t1">Статистика активности</h3>
        </div>
        <div className="grid gap-4 sm:grid-cols-4">
          <div className="p-4 rounded-control border border-line bg-surface">
            <p className="text-micro uppercase tracking-[0.04em] text-t3">Платежей отмечено</p>
            <p className="tabular mt-0.5 text-t1">{state.totalPayments}</p>
          </div>
          <div className="p-4 rounded-control border border-line bg-surface">
            <p className="text-micro uppercase tracking-[0.04em] text-t3">Досрочных погашений</p>
            <p className="tabular mt-0.5 text-t1">{state.totalEarlyRepayments}</p>
          </div>
          <div className="p-4 rounded-control border border-line bg-surface">
            <p className="text-micro uppercase tracking-[0.04em] text-t3">Серия дней</p>
            <p className="tabular mt-0.5 font-semibold text-primary-fg">{state.streakDays} дн.</p>
          </div>
          <div className="p-4 rounded-control border border-line bg-surface">
            <p className="text-micro uppercase tracking-[0.04em] text-t3">Достижений</p>
            <p className="tabular mt-0.5 text-t1">{state.badges.length}</p>
          </div>
        </div>
      </section>

      <section className="card p-6 border border-primary/30 bg-primary/5">
        <h3 className="text-micro uppercase tracking-[0.04em] text-t3 mb-4">Как получать достижения</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="p-3 rounded-control border border-line bg-surface/50">
            <p className="text-xs text-t3">💳 Первый кредит</p>
            <p className="mt-1 text-[10px] text-t3">Добавьте любой долг в приложение</p>
          </div>
          <div className="p-3 rounded-control border border-line bg-surface/50">
            <p className="text-xs text-t3">⚡ Досрочное погашение</p>
            <p className="mt-1 text-[10px] text-t3">Внесите досрочный платеж по любому кредиту</p>
          </div>
          <div className="p-3 rounded-control border border-line bg-surface/50">
            <p className="text-xs text-t3">🎯 Вехи погашения</p>
            <p className="mt-1 text-[10px] text-t3">Закройте 25%, 50%, 75% или 100% долга</p>
          </div>
        </div>
      </section>
    </section>
  );
}
