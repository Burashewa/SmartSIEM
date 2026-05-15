import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import { AppLayout } from '../components/layout/AppLayout';
import { useAuth } from '../hooks/useAuth';
import { LoadingSpinner } from '../components/shared/LoadingSpinner';

const LoginPage = lazy(() => import('../pages/LoginPage'));
const DashboardPage = lazy(() => import('../pages/DashboardPage'));
const LogsPage = lazy(() => import('../pages/LogsPage'));
const AlertsPage = lazy(() => import('../pages/AlertsPage'));
const DetectionRulesPage = lazy(() => import('../pages/DetectionRulesPage'));
const ThreatDetectionPage = lazy(() => import('../pages/ThreatDetectionPage'));
const AIRecommendationsPage = lazy(() => import('../pages/AIRecommendationsPage'));
const AccessControlPage = lazy(() => import('../pages/AccessControlPage'));
const ReportsPage = lazy(() => import('../pages/ReportsPage'));
const UsersPage = lazy(() => import('../pages/UsersPage'));
const SettingsPage = lazy(() => import('../pages/SettingsPage'));
const AgentsPage = lazy(() => import('../pages/AgentsPage'));
const IncidentsPage = lazy(() => import('../pages/IncidentsPage'));

function ProtectedRoute({ children }: { children: JSX.Element }) {
  const { isAuthenticated, user } = useAuth();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  if (!user) {
    return <LoadingSpinner />;
  }
  return children;
}

function PublicRoute({ children }: { children: JSX.Element }) {
  const { isAuthenticated } = useAuth();
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}

function AdminRoute({ children }: { children: JSX.Element }) {
  const { user } = useAuth();
  const role = (user?.role || '').toLowerCase();
  if (role !== 'admin' && role !== 'administrator') {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}

export function AppRoutes() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route
            path="/login"
            element={
              <PublicRoute>
                <LoginPage />
              </PublicRoute>
            }
          />
          <Route path="alerts" element={<AlertsPage />} />
          <Route path="logs" element={<LogsPage />} />
          <Route path="incidents" element={<IncidentsPage />} />
          <Route path="threat-detection" element={<ThreatDetectionPage />} />
          <Route path="detection-rules" element={<DetectionRulesPage />} />
          <Route path="ai-recommendations" element={<AIRecommendationsPage />} />
          <Route
            path="access-control"
            element={
              <AdminRoute>
                <AccessControlPage />
              </AdminRoute>
            }
          />
          <Route path="reports" element={<ReportsPage />} />
          <Route
            path="users"
            element={
              <AdminRoute>
                <UsersPage />
              </AdminRoute>
            }
          />
          <Route path="agents" element={<AgentsPage />} />
          <Route
            path="settings"
            element={
              <AdminRoute>
                <SettingsPage />
              </AdminRoute>
            }
          />
        </Route>
      </Routes>
    </Suspense>
  );
}
