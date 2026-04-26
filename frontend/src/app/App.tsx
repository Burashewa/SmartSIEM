import { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { DashboardPage } from './components/DashboardPage';
import { LogManagementPage } from './components/LogManagementPage';
import { AlertsPage } from './components/AlertsPage';
import { DetectionRulesPage } from './components/DetectionRulesPage';
import { ThreatDetectionPage } from './components/ThreatDetectionPage';
import { AIRecommendationsPage } from './components/AIRecommendationsPage';
import { AccessControlPage } from './components/AccessControlPage';
import { ReportsPage } from './components/ReportsPage';
import { SettingsPage } from './components/SettingsPage';
import { UserManagementPage } from './components/UserManagementPage';

export default function App() {
  const [currentPage, setCurrentPage] = useState('dashboard');

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <DashboardPage />;
      case 'logs':
        return <LogManagementPage />;
      case 'alerts':
        return <AlertsPage />;
      case 'detection-rules':
        return <DetectionRulesPage />;
      case 'threat-detection':
        return <ThreatDetectionPage />;
      case 'ai-recommendations':
        return <AIRecommendationsPage />;
      case 'access-control':
        return <AccessControlPage />;
      case 'reports':
        return <ReportsPage />;
      case 'settings':
        return <SettingsPage />;
      case 'users':
        return <UserManagementPage />;
      default:
        return <DashboardPage />;
    }
  };

  return (
    <div className="h-screen w-screen bg-[#0a0a0f] text-foreground flex overflow-hidden dark">
      <Sidebar currentPage={currentPage} onNavigate={setCurrentPage} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto p-6">
          {renderPage()}
        </main>
      </div>
    </div>
  );
}
