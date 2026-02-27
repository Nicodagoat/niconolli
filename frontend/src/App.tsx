import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/layout/Layout';
import AuthGuard from './components/layout/AuthGuard';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ClientsPage from './pages/ClientsPage';
import ClientDetailPage from './pages/ClientDetailPage';
import SMEProjectsPage from './pages/SMEProjectsPage';
import SMEProjectDetailPage from './pages/SMEProjectDetailPage';
import DEASPProjectsPage from './pages/DEASPProjectsPage';
import DEASPProjectDetailPage from './pages/DEASPProjectDetailPage';
import ReportsPage from './pages/ReportsPage';
import SettingsPage from './pages/SettingsPage';
import DEASPPage from './pages/deasp/DEASPPage';
import { useStore } from './store';

export default function App() {
  const isAuthenticated = useStore((s) => s.isAuthenticated);

  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={
        isAuthenticated ? <Navigate to="/dashboard" replace /> : <LoginPage />
      } />

      {/* Protected */}
      <Route element={
        <AuthGuard>
          <Layout />
        </AuthGuard>
      }>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />

        {/* SME Module */}
        <Route path="/sme-projects" element={<SMEProjectsPage />} />
        <Route path="/sme-projects/:id" element={<SMEProjectDetailPage />} />

        {/* DEASP Module */}
        <Route path="/clients" element={<ClientsPage />} />
        <Route path="/clients/:id" element={<ClientDetailPage />} />
        <Route path="/deasp-projects" element={<DEASPProjectsPage />} />
        <Route path="/deasp-projects/:id" element={<DEASPProjectDetailPage />} />
        <Route path="/deasp" element={<DEASPPage />} />

        {/* Shared */}
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
