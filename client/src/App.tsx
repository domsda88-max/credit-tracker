import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AddCreditPage } from './pages/AddCreditPage';
import { AppSettingsPage } from './pages/AppSettingsPage';
import { CreditDetailPage } from './pages/CreditDetailPage';
import { DashboardPage } from './pages/DashboardPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { SettingsPage } from './pages/SettingsPage';

export function App() {
  return (
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
  );
}
