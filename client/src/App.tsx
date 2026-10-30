import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { SkeletonList } from './components/Skeleton';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';

const AddCreditPage = lazy(() => import('./pages/AddCreditPage').then((m) => ({ default: m.AddCreditPage })));
const AppSettingsPage = lazy(() => import('./pages/AppSettingsPage').then((m) => ({ default: m.AppSettingsPage })));
const CreditDetailPage = lazy(() => import('./pages/CreditDetailPage').then((m) => ({ default: m.CreditDetailPage })));
const DashboardPage = lazy(() => import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage })));

export function App() {
  return (
    <ErrorBoundary>
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
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/app-settings" element={<AppSettingsPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}