import { useState, type ReactNode } from 'react';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { ProtectedLayout } from './ProtectedLayout';
import { LandingPage } from './LandingPage';
import { DashboardPage } from './components/DashboardPage';
import { LogManagementPage } from './components/LogManagementPage';
import { DetectionRulesPage } from './components/DetectionRulesPage';
import { AIRecommendationsPage } from './components/AIRecommendationsPage';
import { ReportsPage } from './components/ReportsPage';
import { SettingsPage } from './components/SettingsPage';
import { LoginScreen } from './components/LoginScreen';
import { AlertsAndThreatPage } from './components/Alertsandthreatpage';
import { ThreatIntelligencePage } from './components/Threatintelligencepage ';
import { InvestigationsPage } from './components/Investigationspage';
import { DocumentationPage } from './components/DocumentationPage';
import {
  clearSession,
  login as loginRequest,
  loginWithGoogle,
  register as registerRequest,
  type SiemRole,
} from './api/auth';
import { ROUTES } from './routes';

const googleClientId = (import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '').trim();
const googleEnabled =
  Boolean(googleClientId) && !googleClientId.includes('your-google-oauth');

function LoginRoute() {
  const { session, setSession } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const from = (location.state as { from?: string } | null)?.from;
  const redirectTo =
    from && from.startsWith('/') && from !== ROUTES.login && from !== ROUTES.landing
      ? from
      : ROUTES.dashboard;

  if (session) {
    return <Navigate to={redirectTo} replace />;
  }

  const finishLogin = async (username: string, password: string) => {
    setIsLoggingIn(true);
    setLoginError(null);
    try {
      const next = await loginRequest(username, password);
      setSession(next);
      navigate(redirectTo, { replace: true });
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
      navigate(redirectTo, { replace: true });
    } catch (error) {
      clearSession();
      setSession(null);
      setLoginError(error instanceof Error ? error.message : 'Google sign-in failed');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleRegister = async (
    username: string,
    password: string,
    role: SiemRole,
    email?: string,
  ) => {
    setIsLoggingIn(true);
    setLoginError(null);
    try {
      await registerRequest(username, password, role, email);
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

export function AppRoutes() {
  return (
    <Routes>
      <Route path={ROUTES.landing} element={<LandingPage />} />
      <Route path={ROUTES.docs} element={<DocumentationPage />} />
      <Route path={ROUTES.login} element={<LoginRoute />} />

      <Route path={ROUTES.dashboard} element={wrapProtected(<DashboardPage />)} />
      <Route path="/logs" element={wrapProtected(<LogManagementPage />)} />
      <Route path="/alerts-and-threats" element={wrapProtected(<AlertsAndThreatPage />)} />
      <Route path="/threat-intelligence" element={wrapProtected(<ThreatIntelligencePage />)} />
      <Route path="/detection-rules" element={wrapProtected(<DetectionRulesPage />)} />
      <Route path="/investigations" element={wrapProtected(<InvestigationsPage />)} />
      <Route path="/ai-recommendations" element={wrapProtected(<AIRecommendationsPage />)} />
      <Route path="/reports" element={wrapProtected(<ReportsPage />)} />
      <Route path="/settings" element={wrapProtected(<SettingsPage />)} />

      <Route path="*" element={<Navigate to={ROUTES.landing} replace />} />
    </Routes>
  );
}
