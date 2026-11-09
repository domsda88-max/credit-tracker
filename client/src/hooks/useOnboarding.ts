const STORAGE_KEY = 'credit-tracker-onboarded';

export function useOnboarding(): boolean {
  if (typeof localStorage === 'undefined') return false;
  try {
    return localStorage.getItem(STORAGE_KEY) !== '1';
  } catch {
    return false;
  }
}
