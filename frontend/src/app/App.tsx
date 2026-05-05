import { useMemo, useState } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Sidebar } from "./components/Sidebar";
import { Header } from "./components/Header";
import { DashboardPage } from "./components/DashboardPage";
import { LogManagementPage } from "./components/LogManagementPage";
import { AlertsPage } from "./components/AlertsPage";
import { DetectionRulesPage } from "./components/DetectionRulesPage";
import { ThreatDetectionPage } from "./components/ThreatDetectionPage";
import { AIRecommendationsPage } from "./components/AIRecommendationsPage";
import { AccessControlPage } from "./components/AccessControlPage";
import { ReportsPage } from "./components/ReportsPage";
import { SettingsPage } from "./components/SettingsPage";
import { UserManagementPage } from "./components/UserManagementPage";

// landing page
import { Hero } from "./components/Hero";
import { Features } from "./components/Features";
import { HowItWorks } from "./components/HowItWorks";
import { DeveloperIntegration } from "./components/DeveloperIntegration";
import { Documentation } from "./components/Documentation";
import { CTA } from "./components/CTA";
import { Footer } from "./components/Footer";
import { DocumentationPage } from "./components/DocumentationPage";
function LandingPage() {
  return (
    <>
      <Hero />
      <Features />
      <HowItWorks />
      <DeveloperIntegration />
      <Documentation />
      <CTA />
      <Footer />
    </>
  );
}

function useCurrentPageFromPath() {
  const { pathname } = useLocation();

  return useMemo(() => {
    if (pathname === "/" || pathname.toLowerCase() === "/landingpage") {
      return "landing";
    }
    return pathname.replace(/^\//, "") || "landing";
  }, [pathname]);
}

export default function App() {
  const currentPage = useCurrentPageFromPath();
  const [systemStatus, setSystemStatus] = useState<"healthy" | "critical">(
    "healthy",
  );

  return (
    <Routes>
      {/* Landing page: no sidebar/header layout */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/LandingPage" element={<Navigate to="/" replace />} />
      <Route path="/docs" element={<DocumentationPage />} />

      {/* App shell routes: sidebar + header */}
      <Route
        path="/*"
        element={
          <div className="h-screen w-screen bg-[#0a0a0f] text-foreground flex overflow-hidden dark">
            <Sidebar currentPage={currentPage} />
            <div className="flex-1 flex flex-col overflow-hidden">
              <Header systemStatus={systemStatus} />
              <main className="flex-1 overflow-auto p-6 bg-[#0a0a0f]">
                <Routes>
                  <Route
                    path="dashboard"
                    element={<DashboardPage onSystemStatus={setSystemStatus} />}
                  />
                  <Route path="logs" element={<LogManagementPage />} />
                  <Route path="alerts" element={<AlertsPage />} />
                  <Route
                    path="detection-rules"
                    element={<DetectionRulesPage />}
                  />
                  <Route
                    path="threat-detection"
                    element={<ThreatDetectionPage />}
                  />
                  <Route
                    path="ai-recommendations"
                    element={<AIRecommendationsPage />}
                  />
                  <Route
                    path="access-control"
                    element={<AccessControlPage />}
                  />
                  <Route path="reports" element={<ReportsPage />} />
                  <Route path="users" element={<UserManagementPage />} />
                  <Route path="settings" element={<SettingsPage />} />

                  <Route path="*" element={<Navigate to="/dashboard" replace />} />
                </Routes>
              </main>
            </div>
          </div>
        }
      />
    </Routes>
  );
}