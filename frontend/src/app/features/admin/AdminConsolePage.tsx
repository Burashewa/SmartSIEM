import { useState } from 'react';
import { RefreshCw, Shield } from 'lucide-react';
import { Toaster } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import OverviewTab from './tabs/OverviewTab';
import UsersTab from './tabs/UsersTab';
import AuditTab from './tabs/AuditTab';

type TabKey = 'overview' | 'users' | 'audit';

export function AdminConsolePage() {
  const [tab, setTab] = useState<TabKey>('overview');
  const [refreshKey, setRefreshKey] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<string>(new Date().toISOString());
  const [spinning, setSpinning] = useState(false);

  const refresh = () => {
    setSpinning(true);
    setRefreshKey((key) => key + 1);
    setLastUpdated(new Date().toISOString());
    window.setTimeout(() => setSpinning(false), 600);
  };

  return (
    <div className="min-h-full bg-[#0a0a0f] text-white">
      <Toaster richColors position="top-right" theme="dark" />
      <header className="border-b border-[#1f1f2e] px-6 py-5">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Shield className="h-6 w-6 text-[#4f46e5]" />
            <div>
              <h1 className="text-xl font-semibold">Admin Console</h1>
              <p className="text-xs text-[#6b7280]">Platform governance and security operations</p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs text-[#6b7280]">
            <span>Updated {new Date(lastUpdated).toLocaleTimeString()}</span>
            <button
              type="button"
              onClick={refresh}
              className="inline-flex items-center gap-1 rounded-md border border-[#1f1f2e] bg-[#0f0f17] px-3 py-2 text-sm text-white hover:border-[#4f46e5]/60"
            >
              <RefreshCw className={`h-4 w-4 ${spinning ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
      </header>

      <Tabs value={tab} onValueChange={(value) => setTab(value as TabKey)} className="mx-auto max-w-7xl">
        <div className="sticky top-0 z-10 border-b border-[#1f1f2e] bg-[#0a0a0f] px-6">
          <TabsList className="h-auto gap-2 bg-transparent p-0">
            {[
              ['overview', 'Overview'],
              ['users', 'Users'],
              ['audit', 'Audit Log'],
            ].map(([key, label]) => (
              <TabsTrigger
                key={key}
                value={key}
                className="rounded-none border-b-2 border-transparent bg-transparent px-3 py-3 text-sm text-[#6b7280] data-[state=active]:border-[#4f46e5] data-[state=active]:bg-transparent data-[state=active]:text-white data-[state=active]:shadow-none"
              >
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <div className="p-6">
          <TabsContent value="overview" className="mt-0">
            <OverviewTab
              refreshKey={refreshKey}
              onGoToAudit={() => setTab('audit')}
              onLoaded={setLastUpdated}
            />
          </TabsContent>
          <TabsContent value="users" className="mt-0">
            <UsersTab refreshKey={refreshKey} />
          </TabsContent>
          <TabsContent value="audit" className="mt-0">
            <AuditTab refreshKey={refreshKey} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
