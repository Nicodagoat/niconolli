import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/layout/Layout';
import DashboardPage from './pages/DashboardPage';
import ClientsPage from './pages/ClientsPage';
import ClientDetailPage from './pages/ClientDetailPage';
import DEASPProjectsPage from './pages/DEASPProjectsPage';
import DEASPProjectDetailPage from './pages/DEASPProjectDetailPage';
import ReportsPage from './pages/ReportsPage';
import SettingsPage from './pages/SettingsPage';
import DEASPPage from './pages/deasp/DEASPPage';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/clients" element={<ClientsPage />} />
        <Route path="/clients/:id" element={<ClientDetailPage />} />
        <Route path="/deasp-projects" element={<DEASPProjectsPage />} />
        <Route path="/deasp-projects/:id" element={<DEASPProjectDetailPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/deasp" element={<DEASPPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
}
