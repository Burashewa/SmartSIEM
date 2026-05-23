import { useMemo, useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { DashboardPage } from './components/DashboardPage';
import { LogManagementPage } from './components/LogManagementPage';
// import { AlertsPage } from './components/AlertsPage';
import { DetectionRulesPage } from './components/DetectionRulesPage';
// import { ThreatDetectionPage } from './components/ThreatDetectionPage';
import { AIRecommendationsPage } from './components/AIRecommendationsPage';
import { ReportsPage } from './components/ReportsPage';
import { SettingsPage } from './components/SettingsPage';
import { LoginScreen } from './components/LoginScreen';
import { AlertsAndThreatPage } from './components/Alertsandthreatpage';
import { ThreatIntelligencePage } from './components/Threatintelligencepage ';
import { InvestigationsPage } from './components/Investigationspage';
import {
  clearSession,
  getSession,
  login as loginRequest,
  register as registerRequest,
  logout as logoutRequest,
  type AuthSession,
  type SiemRole,
} from './api/auth';

export default function App() {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [session, setSession] = useState<AuthSession | null>(() => getSession());
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const pageAccess = useMemo<Record<string, SiemRole>>(
    () => ({
      dashboard: 'security_analyst',
      logs: 'security_analyst',
      alerts: 'security_analyst',
      'threat-detection': 'security_analyst',
      'detection-rules': 'security_analyst',
      'ai-recommendations': 'security_analyst',
      reports: 'security_analyst',
      settings: 'security_analyst',
    }),
    [],
  );

  const roleWeight: Record<SiemRole, number> = { security_analyst: 20, admin: 40 };

  const canAccessPage = (page: string): boolean => {
    if (!session) return false;
    const requiredRole = pageAccess[page as keyof typeof pageAccess] ?? 'security_analyst';
    return roleWeight[session.role] >= roleWeight[requiredRole];
  };

  const handleLogin = async (username: string, password: string) => {
    setIsLoggingIn(true);
    setLoginError(null);
    try {
      const nextSession = await loginRequest(username, password);
      setSession(nextSession);
    } catch (error) {
      clearSession();
      const message = error instanceof Error ? error.message : 'Unable to sign in';
      setLoginError(message);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await logoutRequest();
    setSession(null);
    setCurrentPage('dashboard');
  };

  const handleRegister = async (username: string, password: string, role: SiemRole) => {
    setIsLoggingIn(true);
    setLoginError(null);
    try {
      await registerRequest(username, password, role);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to register';
      setLoginError(message);
      throw error;
    } finally {
      setIsLoggingIn(false);
    }
  };

  const renderPage = () => {
    if (!canAccessPage(currentPage)) {
      return (
        <div className="bg-[#0f0f17] border border-[#1f1f2e] p-8">
          <h2 className="text-xl text-white mb-2">Access Restricted</h2>
          <p className="text-sm text-gray-400">
            Your role does not have permission to access this section.
          </p>
        </div>
      );
    }
    switch (currentPage) {
      case 'dashboard':
        return <DashboardPage />;
      case 'logs':
        return <LogManagementPage />;
      // case 'alerts':
      //   return <AlertsPage />;
      case 'threat-intelligence':
        return <ThreatIntelligencePage />; // this layout should be checked later
      case 'detection-rules':
        return <DetectionRulesPage />; // this layout should be checked later
      // case 'threat-detection':
      //   return <ThreatDetectionPage />;
      case 'investigations':
        return <InvestigationsPage />; //this page is currently under development, it has no route yet, but we want to reserve it in the sidebar
      case 'ai-recommendations':
        return <AIRecommendationsPage />;
      case 'reports':
        return <ReportsPage />;
      case 'settings':
        return <SettingsPage />;
      case 'alerts-and-threats':
        return <AlertsAndThreatPage />;
      default:
        return <DashboardPage />;
    }
  };

  if (!session) {
    return (
      <LoginScreen
        isLoading={isLoggingIn}
        error={loginError}
        onSubmit={handleLogin}
        onRegister={handleRegister}
      />
    );
  }

  return (
    <div className="h-screen w-screen bg-[#0a0a0f] text-foreground flex overflow-hidden dark">
      <Sidebar currentPage={currentPage} onNavigate={setCurrentPage} role={session.role} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header username={session.username} role={session.role} onLogout={handleLogout} />
        <main className="flex-1 overflow-auto p-6">
          {renderPage()}
        </main>
      </div>
    </div>
  );
}
