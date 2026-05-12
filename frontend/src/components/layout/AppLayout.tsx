import { Outlet, useLocation } from 'react-router-dom';

import { Header } from '../../app/components/Header';
import { Sidebar } from '../../app/components/Sidebar';
import { useNotificationStore } from '../../store/notificationStore';

export function AppLayout() {
  const location = useLocation();
  const alertCount = useNotificationStore((state) => state.liveAlertCount);
  const currentPage = location.pathname.replace('/', '') || 'dashboard';

  return (
    <div className="h-screen w-screen bg-[#0a0a0f] text-foreground flex overflow-hidden dark">
      <Sidebar currentPage={currentPage} onNavigate={() => void 0} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header systemStatus={alertCount > 0 ? 'critical' : 'healthy'} />
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
