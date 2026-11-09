import { lazy, Suspense, useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import ScrollToTop from './components/ScrollToTop';import { SkeletonList } from './components/Skeleton';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { trackScreen, useAnalytics } from './hooks/useAnalytics';

const AddCreditPage = lazy(() => import('./pages/AddCreditPage').then((m) => ({ default: m.AddCreditPage })));
const CsvImportPage = lazy(() => import('./pages/CsvImportPage').then((m) => ({ default: m.CsvImportPage })));
const CreditDetailPage = lazy(() => import('./pages/CreditDetailPage').then((m) => ({ default: m.CreditDetailPage })));
const DashboardPage = lazy(() => import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage })));
const FreedomPage = lazy(() => import('./pages/FreedomPage').then((m) => ({ default: m.FreedomPage })));
const AchievementsPage = lazy(() => import('./pages/AchievementsPage').then((m) => ({ default: m.AchievementsPage })));

export function App() {
  const location = useLocation();
  const { track } = useAnalytics();

  useEffect(() => {
    trackScreen(track, location.pathname);
  }, [track, location.pathname]);
  return (
    <ErrorBoundary>
      <ScrollToTop />
      <Suspense fallback={<SkeletonList count={3} />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<DashboardPage />} />
            <Route path="/credits/new" element={<AddCreditPage />} />
            <Route path="/credits/:id" element={<CreditDetailPage />} />
            <Route path="/stats" element={<FreedomPage />} />
            <Route path="/achievements" element={<AchievementsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/import" element={<CsvImportPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}