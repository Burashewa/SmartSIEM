import { useState, type ReactNode } from 'react';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { ProtectedLayout } from './ProtectedLayout';
import { LandingPage } from './LandingPage';
import { DashboardPage } from './components/DashboardPage';
import { LogManagementPage } from './components/LogManagementPage';
import { DetectionRulesPage } from './components/DetectionRulesPage';
import { AIRecommendationsPage } from './components/AIRecommendationsPage';
import { ReportsPage } from './components/ReportsPage';
import { SettingsPage } from './components/SettingsPage';
import { ProfilePage } from './components/ProfilePage';
import { LoginScreen } from './components/LoginScreen';
import { AlertsAndThreatPage } from './components/Alertsandthreatpage';
import { ThreatIntelligencePage } from './components/Threatintelligencepage ';
import { InvestigationsPage } from './components/Investigationspage';
import { DocumentationPage } from './components/DocumentationPage';
import { AdminConsolePage } from './features/admin/AdminConsolePage';
import { RoleRoute } from './RoleRoute';
import {
  clearSession,
  login as loginRequest,
  loginWithGoogle,
  register as registerRequest,
} from './api/auth';
import { ROUTES } from './routes';
import { homePathForRole } from './roleAccess';

const googleClientId = (import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '').trim();
const googleEnabled =
  Boolean(googleClientId) && !googleClientId.includes('your-google-oauth');

function LoginRoute() {
  const { session, setSession } = useAuth();
  const navigate = useNavigate();
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  if (session) {
    return <Navigate to={homePathForRole(session.role)} replace />;
  }

  const finishLogin = async (username: string, password: string) => {
    setIsLoggingIn(true);
    setLoginError(null);
    try {
      const next = await loginRequest(username, password);
      setSession(next);
      navigate(homePathForRole(next.role), { replace: true });
    } catch (error) {
      clearSession();
      setSession(null);
      setLoginError(error instanceof Error ? error.message : 'Unable to sign in');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleGoogleLogin = async (credential: string) => {
    setIsLoggingIn(true);
    setLoginError(null);
    try {
      const next = await loginWithGoogle(credential);
      setSession(next);
      navigate(homePathForRole(next.role), { replace: true });
    } catch (error) {
      clearSession();
      setSession(null);
      setLoginError(error instanceof Error ? error.message : 'Google sign-in failed');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleRegister = async (username: string, password: string, email?: string) => {
    setIsLoggingIn(true);
    setLoginError(null);
    try {
      await registerRequest(username, password, 'security_analyst', email);
      await finishLogin(username, password);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to register';
      setLoginError(message);
      throw error;
    } finally {
      setIsLoggingIn(false);
    }
  };

  const loginUi = (
    <LoginScreen
      isLoading={isLoggingIn}
      error={loginError}
      onSubmit={finishLogin}
      onRegister={handleRegister}
      onGoogleLogin={googleEnabled ? handleGoogleLogin : undefined}
      googleEnabled={googleEnabled}
    />
  );

  if (googleEnabled) {
    return <GoogleOAuthProvider clientId={googleClientId}>{loginUi}</GoogleOAuthProvider>;
  }
  return loginUi;
}

function wrapProtected(element: ReactNode) {
  return <ProtectedLayout>{element}</ProtectedLayout>;
}

function wrapAnalyst(element: ReactNode) {
  return wrapProtected(<RoleRoute allow={['security_analyst']}>{element}</RoleRoute>);
}

function wrapAdmin(element: ReactNode) {
  return wrapProtected(<RoleRoute allow={['admin']}>{element}</RoleRoute>);
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path={ROUTES.landing} element={<LandingPage />} />
      <Route path={ROUTES.docs} element={<DocumentationPage />} />
      <Route path={ROUTES.login} element={<LoginRoute />} />

      <Route path={ROUTES.dashboard} element={wrapAnalyst(<DashboardPage />)} />
      <Route path="/logs" element={wrapAnalyst(<LogManagementPage />)} />
      <Route path="/alerts-and-threats" element={wrapAnalyst(<AlertsAndThreatPage />)} />
      <Route path="/threat-intelligence" element={wrapAnalyst(<ThreatIntelligencePage />)} />
      <Route path="/detection-rules" element={wrapAnalyst(<DetectionRulesPage />)} />
      <Route path="/investigations" element={wrapAnalyst(<InvestigationsPage />)} />
      <Route path="/ai-recommendations" element={wrapAnalyst(<AIRecommendationsPage />)} />
      <Route path="/reports" element={wrapAnalyst(<ReportsPage />)} />
      <Route path="/settings" element={wrapAnalyst(<SettingsPage />)} />
      <Route path="/profile" element={wrapProtected(<ProfilePage />)} />
      <Route path={ROUTES.admin} element={wrapAdmin(<AdminConsolePage />)} />

      <Route path="*" element={<Navigate to={ROUTES.landing} replace />} />
    </Routes>
  );
}
