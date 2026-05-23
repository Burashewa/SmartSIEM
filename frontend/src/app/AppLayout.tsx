import { useLocation, useNavigate } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import type { AuthSession } from './api/auth';
import { pathnameToPageId, ROUTES } from './routes';

interface AppLayoutProps {
  session: AuthSession;
  onLogout: () => Promise<void>;
  children: React.ReactNode;
}

export function AppLayout({ session, onLogout, children }: AppLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const currentPage = pathnameToPageId(location.pathname, session.role);

  const handleLogout = async () => {
    await onLogout();
    navigate(ROUTES.login, { replace: true });
  };

  return (
    <div className="h-screen w-screen bg-[#0a0a0f] text-foreground flex overflow-hidden dark">
      <Sidebar
        currentPage={currentPage}
        onNavigate={(pageId) => navigate(`/${pageId}`)}
        role={session.role}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header username={session.username} role={session.role} onLogout={handleLogout} />
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}
