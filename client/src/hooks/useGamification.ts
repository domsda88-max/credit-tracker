import { useState, useCallback, useMemo } from 'react';

/**
 * Система достижений (bейджи) и уровней для геймификации погашения долгов.
 * Состояние хранится в localStorage (клиентская часть).
 */

export type BadgeId =
  | 'first_credit'
  | 'payment_on_time'
  | 'streak_3'
  | 'streak_7'
  | 'streak_30'
  | 'milestone_25'
  | 'milestone_50'
  | 'milestone_75'
  | 'milestone_100'
  | 'early_repayment'
  | 'no_overdue_month'
  | 'credit_card_grace'
  | 'debt_free';

export interface Badge {
  id: BadgeId;
  title: string;
  description: string;
  icon: string;
  color: 'primary' | 'success' | 'warning' | 'danger';
}

export const BADGES: Record<BadgeId, Badge> = {
  first_credit: {
    id: 'first_credit',
    title: 'Первый шаг',
    description: 'Добавили первый кредит в учёт',
    icon: '💳',
    color: 'primary',
  },
  payment_on_time: {
    id: 'payment_on_time',
    title: 'Платеж вовремя',
    description: 'Отметили платёж без просрочки',
    icon: '✅',
    color: 'success',
  },
  streak_3: {
    id: 'streak_3',
    title: 'Серия 3 дня',
    description: 'Три дня подряд без просроченных платежей',
    icon: '🔥',
    color: 'warning',
  },
  streak_7: {
    id: 'streak_7',
    title: 'Серия неделя',
    description: '7 дней подряд без просроченных платежей',
    icon: '🔥',
    color: 'warning',
  },
  streak_30: {
    id: 'streak_30',
    title: 'Серия месяц',
    description: '30 дней подряд без просроченных платежей',
    icon: '🏆',
    color: 'success',
  },
  milestone_25: {
    id: 'milestone_25',
    title: 'Четверть пути',
    description: 'Погасили 25% от первоначальной суммы долга',
    icon: '🥉',
    color: 'warning',
  },
  milestone_50: {
    id: 'milestone_50',
    title: 'Половина пути',
    description: 'Погасили 50% от первоначальной суммы долга',
    icon: '🥈',
    color: 'warning',
  },
  milestone_75: {
    id: 'milestone_75',
    title: 'Три четверти',
    description: 'Погасили 75% от первоначальной суммы долга',
    icon: '🥇',
    color: 'success',
  },
  milestone_100: {
    id: 'milestone_100',
    title: 'Кредит закрыт',
    description: 'Полностью погасили кредит',
    icon: '🎉',
    color: 'success',
  },
  early_repayment: {
    id: 'early_repayment',
    title: 'Досрочно!',
    description: 'Внесли досрочное погашение',
    icon: '⚡',
    color: 'primary',
  },
  no_overdue_month: {
    id: 'no_overdue_month',
    title: 'Без просрочек месяц',
    description: 'Целый месяц без единой просрочки',
    icon: '📅',
    color: 'success',
  },
  credit_card_grace: {
    id: 'credit_card_grace',
    title: 'Грейс под контролем',
    description: 'Обновили льготный период по кредитной карте',
    icon: '🧊',
    color: 'primary',
  },
  debt_free: {
    id: 'debt_free',
    title: 'Финансовая свобода',
    description: 'Все кредиты погашены',
    icon: '🏆',
    color: 'success',
  },
};

export type LevelId = 'novice' | 'controller' | 'guerrilla' | 'debt_free';

export interface Level {
  id: LevelId;
  title: string;
  minBadges: number;
  icon: string;
}

export const LEVELS: Record<LevelId, Level> = {
  novice: { id: 'novice', title: 'Новичок', minBadges: 0, icon: '🌱' },
  controller: { id: 'controller', title: 'Контролирующий долг', minBadges: 3, icon: '📊' },
  guerrilla: { id: 'guerrilla', title: 'Финансовый guerrilla', minBadges: 6, icon: '⚔️' },
  debt_free: { id: 'debt_free', title: 'Долгосвободен', minBadges: 10, icon: '🏆' },
};

export interface GamificationState {
  badges: BadgeId[];
  streakDays: number;
  lastActivityDate: string | null;
  totalPayments: number;
  totalEarlyRepayments: number;
  updatedAt: number;
}

const STORAGE_KEY = 'credit-tracker-gamification';

const DEFAULT_STATE: GamificationState = {
  badges: [],
  streakDays: 0,
  lastActivityDate: null,
  totalPayments: 0,
  totalEarlyRepayments: 0,
  updatedAt: Date.now(),
};

function loadState(): GamificationState {
  if (typeof localStorage === 'undefined') return DEFAULT_STATE;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    return { ...DEFAULT_STATE, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_STATE;
  }
}

function saveState(state: GamificationState): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function useGamification() {
  const [state, setState] = useState<GamificationState>(loadState);

  const addBadge = useCallback((badgeId: BadgeId) => {
    setState((prev) => {
      if (prev.badges.includes(badgeId)) return prev;
      const next = {
        ...prev,
        badges: [...prev.badges, badgeId],
        updatedAt: Date.now(),
      };
      saveState(next);
      return next;
    });
  }, []);

  const incrementStreak = useCallback(() => {
    setState((prev) => {
      const today = new Date().toISOString().slice(0, 10);
      const nextStreak = prev.lastActivityDate === today ? prev.streakDays : prev.streakDays + 1;
      const next = {
        ...prev,
        streakDays: nextStreak,
        lastActivityDate: today,
        updatedAt: Date.now(),
      };
      saveState(next);
      return next;
    });
  }, []);

  const recordPayment = useCallback(() => {
    setState((prev) => {
      const next = {
        ...prev,
        totalPayments: prev.totalPayments + 1,
        updatedAt: Date.now(),
      };
      saveState(next);
      return next;
    });
  }, []);

  const recordEarlyRepayment = useCallback(() => {
    setState((prev) => {
      const next = {
        ...prev,
        totalEarlyRepayments: prev.totalEarlyRepayments + 1,
        updatedAt: Date.now(),
      };
      saveState(next);
      return next;
    });
  }, []);

  const currentLevel = useMemo(() => {
    const sorted = Object.values(LEVELS).sort((a, b) => b.minBadges - a.minBadges);
    return sorted.find((l) => state.badges.length >= l.minBadges) ?? LEVELS.novice;
  }, [state.badges.length]);

  const unlockedBadges = state.badges.map((id) => BADGES[id]);
  const lockedBadges = Object.values(BADGES).filter((b) => !state.badges.includes(b.id));

  return {
    state,
    badges: BADGES,
    unlockedBadges,
    lockedBadges,
    currentLevel,
    addBadge,
    incrementStreak,
    recordPayment,
    recordEarlyRepayment,
    hasBadge: (id: BadgeId) => state.badges.includes(id),
  };
}
