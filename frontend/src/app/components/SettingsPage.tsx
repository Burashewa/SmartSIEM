import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Settings as SettingsIcon,
  Server,
  Key,
  RefreshCw,
  Trash2,
  Plus,
  Copy,
  Eye,
  EyeOff,
  Activity,
  User,
} from 'lucide-react';
import { useAuth } from '@/app/auth/AuthContext';
import * as authApi from '@/lib/collectorAuthApi';
import {
  fetchCollectorHealth,
  fetchCollectorMetrics,
  fetchWorkerHealth,
  fetchWorkerStats,
  type CollectorHealth,
  type CollectorMetrics,
  type WorkerHealth,
  type WorkerStats,
} from '@/lib/smartsiemApi';

type AgentRow = {
  id: string;
  name: string;
  created_at: string;
  last_used_at?: string | null;
  key_stored?: boolean;
};

const POLL_MS = 10_000;

export function SettingsPage() {
  const { state } = useAuth();
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [agentsError, setAgentsError] = useState<string | null>(null);
  const [newAgentName, setNewAgentName] = useState('');
  const [newAgentStore, setNewAgentStore] = useState(false);
  const [createdAgentKeys, setCreatedAgentKeys] = useState<Record<string, string>>({});
  const [lastCreatedAgentId, setLastCreatedAgentId] = useState<string | null>(null);
  const [showNewAPIKeyForm, setShowNewAPIKeyForm] = useState(false);
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());
  const [revealingId, setRevealingId] = useState<string | null>(null);

  const [userProfile, setUserProfile] = useState<authApi.UserPublic | null>(null);
  const [userError, setUserError] = useState<string | null>(null);

  const [collectorHealth, setCollectorHealth] = useState<CollectorHealth | null>(null);
  const [collectorMetrics, setCollectorMetrics] = useState<CollectorMetrics | null>(null);
  const [workerHealth, setWorkerHealth] = useState<WorkerHealth | null>(null);
  const [workerStats, setWorkerStats] = useState<WorkerStats | null>(null);
  const [pipelineError, setPipelineError] = useState<string | null>(null);
  const [pipelineLoading, setPipelineLoading] = useState(false);

  const accessToken = state.status === 'authenticated' ? state.accessToken : null;

  const location = useLocation();

  const refreshPipeline = useCallback(async () => {
    setPipelineLoading(true);
    setPipelineError(null);
    try {
      const [ch, cm, wh, ws] = await Promise.all([
        fetchCollectorHealth(),
        fetchCollectorMetrics(),
        fetchWorkerHealth(),
        fetchWorkerStats(),
      ]);
      setCollectorHealth(ch);
      setCollectorMetrics(cm);
      setWorkerHealth(wh);
      setWorkerStats(ws);
      const any = ch !== null || cm !== null || wh !== null || ws !== null;
      if (!any) {
        setPipelineError(
          'Could not reach collector or detection-worker. Start both services and ensure the Vite dev proxy targets the correct ports (collector 8080, worker 4000).'
        );
      }
    } catch (e) {
      setPipelineError(e instanceof Error ? e.message : 'Failed to load pipeline status');
    } finally {
      setPipelineLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshPipeline();
    const t = window.setInterval(() => void refreshPipeline(), POLL_MS);
    return () => window.clearInterval(t);
  }, [refreshPipeline]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const createParam = params.get('createAgent') || params.get('create');
    if (createParam === '1' || createParam === 'true') {
      setShowNewAPIKeyForm(true);
    }
  }, [location.search]);

  useEffect(() => {
    let cancelled = false;
    async function loadAgents() {
      setAgentsError(null);
      if (!accessToken) {
        setAgents([]);
        return;
      }
      try {
        const list = await authApi.listAgents(accessToken);
        if (cancelled) return;
        setAgents(list);
      } catch (e: unknown) {
        if (cancelled) return;
        setAgentsError(e instanceof Error ? e.message : 'Failed to load agents');
      }
    }
    void loadAgents();
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  useEffect(() => {
    let cancelled = false;
    async function loadUser() {
      setUserError(null);
      if (!accessToken) {
        setUserProfile(null);
        return;
      }
      try {
        const me = await authApi.fetchMe(accessToken);
        if (cancelled) return;
        setUserProfile(me);
      } catch (e: unknown) {
        if (cancelled) return;
        setUserError(e instanceof Error ? e.message : 'Failed to load profile');
      }
    }
    void loadUser();
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  const copyToClipboard = (text: string) => {
    void navigator.clipboard.writeText(text);
  };

  const keyForAgent = (agentId: string) => createdAgentKeys[agentId] ?? null;

  const toggleKeyVisibility = (agentId: string) => {
    setVisibleKeys((prev) => {
      const next = new Set(prev);
      if (next.has(agentId)) next.delete(agentId);
      else next.add(agentId);
      return next;
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl text-white mb-2">Settings</h1>
          <p className="text-gray-400">
            Account, pipeline status, and ingest agents — all data comes from the collector and
            detection-worker APIs.
          </p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-[#4f46e5]/20 border border-[#4f46e5]/30 rounded">
          <SettingsIcon className="size-5 text-[#4f46e5]" />
          <span className="text-sm text-[#4f46e5] font-medium">Live backend</span>
        </div>
      </div>

      {/* Account — GET /auth/me */}
      <div className="bg-[#0f0f17] border border-[#1f1f2e] rounded-lg p-6 space-y-4">
        <h2 className="text-xl text-white flex items-center gap-2">
          <User className="size-5 text-[#4f46e5]" />
          Account
        </h2>
        {!accessToken && (
          <p className="text-sm text-gray-400">
            Sign in to load your profile and manage ingest agents.
          </p>
        )}
        {userError && <p className="text-sm text-amber-400">{userError}</p>}
        {accessToken && userProfile && (
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-gray-500 mb-1">Email</dt>
              <dd className="text-white font-mono">{userProfile.email}</dd>
            </div>
            <div>
              <dt className="text-gray-500 mb-1">User ID</dt>
              <dd className="text-white font-mono break-all">{userProfile.id}</dd>
            </div>
            {userProfile.display_name != null && userProfile.display_name !== '' && (
              <div className="sm:col-span-2">
                <dt className="text-gray-500 mb-1">Display name</dt>
                <dd className="text-white">{userProfile.display_name}</dd>
              </div>
            )}
          </dl>
        )}
      </div>

      {/* Pipeline — collector + worker */}
      <div className="bg-[#0f0f17] border border-[#1f1f2e] rounded-lg p-6 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h2 className="text-xl text-white flex items-center gap-2">
            <Activity className="size-5 text-[#4f46e5]" />
            Pipeline status
          </h2>
          <button
            type="button"
            onClick={() => void refreshPipeline()}
            disabled={pipelineLoading}
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-300 bg-[#1a1a24] border border-[#2a2a3a] hover:border-[#4f46e5] disabled:opacity-50"
          >
            <RefreshCw className={`size-4 ${pipelineLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
        {pipelineError && <p className="text-sm text-amber-400">{pipelineError}</p>}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-[#0a0a0f] border border-[#1f1f2e] rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2 text-white font-medium">
              <Server className="size-4 text-[#6366f1]" />
              SmartSIEM-Collector
            </div>
            <div className="text-sm space-y-1 text-gray-400">
              <p>
                <span className="text-gray-500">HTTP /health:</span>{' '}
                <span className={collectorHealth?.status === 'ok' ? 'text-[#10b981]' : 'text-amber-400'}>
                  {collectorHealth ? collectorHealth.status : 'no response'}
                </span>
              </p>
              {collectorMetrics && (
                <>
                  <p>
                    <span className="text-gray-500">Output:</span>{' '}
                    <span className="text-white font-mono">{collectorMetrics.queue_output}</span>
                  </p>
                  <p>
                    <span className="text-gray-500">Kafka topic:</span>{' '}
                    <span className="text-white font-mono">{collectorMetrics.kafka_topic}</span>
                  </p>
                  <p>
                    <span className="text-gray-500">Ingest auth required:</span>{' '}
                    <span className="text-white">{String(collectorMetrics.require_ingest_auth)}</span>
                  </p>
                  <p>
                    <span className="text-gray-500">Events accepted (process):</span>{' '}
                    <span className="text-white">
                      {(collectorMetrics.counters?.events_total ?? 0).toLocaleString()}
                    </span>
                  </p>
                  <p>
                    <span className="text-gray-500">HTTP requests:</span>{' '}
                    <span className="text-white">
                      {(collectorMetrics.counters?.requests_total ?? 0).toLocaleString()}
                    </span>
                  </p>
                  <p>
                    <span className="text-gray-500">Uptime (s):</span>{' '}
                    <span className="text-white">
                      {Math.floor(collectorMetrics.uptime_seconds ?? 0).toLocaleString()}
                    </span>
                  </p>
                </>
              )}
              {!collectorMetrics && collectorHealth && (
                <p className="text-xs">/metrics unavailable or collector older build.</p>
              )}
            </div>
          </div>

          <div className="bg-[#0a0a0f] border border-[#1f1f2e] rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2 text-white font-medium">
              <Activity className="size-4 text-[#10b981]" />
              Detection-worker
            </div>
            <div className="text-sm space-y-1 text-gray-400">
              <p>
                <span className="text-gray-500">/health status:</span>{' '}
                <span className={workerHealth?.status === 'ok' ? 'text-[#10b981]' : 'text-amber-400'}>
                  {workerHealth?.status ?? 'no response'}
                </span>
              </p>
              {workerHealth && (
                <>
                  <p>
                    <span className="text-gray-500">MongoDB:</span>{' '}
                    <span className={workerHealth.mongodb?.connected ? 'text-[#10b981]' : 'text-amber-400'}>
                      {workerHealth.mongodb?.connected ? 'connected' : 'not connected'}
                    </span>
                  </p>
                  <p>
                    <span className="text-gray-500">Health uptime (s):</span>{' '}
                    <span className="text-white">
                      {Math.floor(workerHealth.uptime ?? 0).toLocaleString()}
                    </span>
                  </p>
                </>
              )}
              {workerStats && (
                <>
                  <p>
                    <span className="text-gray-500">Events processed:</span>{' '}
                    <span className="text-white">{workerStats.totalEventsProcessed.toLocaleString()}</span>
                  </p>
                  <p>
                    <span className="text-gray-500">Alerts generated:</span>{' '}
                    <span className="text-white">{workerStats.totalAlertsGenerated.toLocaleString()}</span>
                  </p>
                  <p>
                    <span className="text-gray-500">Active rules (in memory):</span>{' '}
                    <span className="text-white">{workerStats.activeRules}</span>
                  </p>
                  <p>
                    <span className="text-gray-500">/stats uptime (s):</span>{' '}
                    <span className="text-white">{Math.floor(workerStats.uptime).toLocaleString()}</span>
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Agents — collector /agents */}
      <div className="bg-[#0f0f17] border border-[#1f1f2e] rounded-lg p-6 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-xl text-white mb-2 flex items-center gap-2">
              <Key className="size-5 text-[#4f46e5]" />
              Ingest agents (API keys)
            </h2>
            <p className="text-sm text-gray-400">
              Create agents on the collector; use the API key in the <code className="text-gray-300">Authorization</code> or{' '}
              <code className="text-gray-300">X-API-Key</code> header when <code className="text-gray-300">require_ingest_auth</code> is enabled.
            </p>
          </div>
          {accessToken && (
            <button
              type="button"
              onClick={() => setShowNewAPIKeyForm(!showNewAPIKeyForm)}
              className="flex items-center gap-2 px-4 py-2 bg-[#4f46e5] hover:bg-[#6366f1] text-white rounded transition-colors text-sm font-medium"
            >
              <Plus className="size-4" />
              Create agent
            </button>
          )}
        </div>

        {!accessToken && (
          <p className="text-sm text-gray-400">Sign in to list and create agents.</p>
        )}

        <div className="space-y-3">
          {agentsError && <div className="text-sm text-[#ef4444]">{agentsError}</div>}
          {accessToken && agents.length === 0 && !agentsError && (
            <p className="text-sm text-gray-500">No agents yet. Create one to get an API key.</p>
          )}
          {agents.map((agent) => {
            const rawKey = keyForAgent(agent.id);
            const keyVisible = Boolean(rawKey && visibleKeys.has(agent.id));
            const isStored = Boolean(agent.key_stored);
            const keyDisplay = keyVisible
              ? rawKey
              : rawKey
                ? '•'.repeat(32)
                : isStored
                  ? 'Stored encrypted on server — click Reveal to retrieve'
                  : 'One-time key — only shown once at creation';
            const isRevealing = revealingId === agent.id;
            return (
              <div
                key={agent.id}
                className="bg-[#0a0a0f] border border-[#1f1f2e] rounded-lg p-4 hover:border-[#2a2a3a] transition-colors"
              >
                <div className="flex items-start justify-between mb-3 gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <h3 className="text-white font-medium">{agent.name}</h3>
                      <span
                        className={
                          isStored
                            ? 'text-[10px] uppercase tracking-wide px-2 py-0.5 rounded border border-[#4f46e5]/40 bg-[#4f46e5]/10 text-[#a5b4fc]'
                            : 'text-[10px] uppercase tracking-wide px-2 py-0.5 rounded border border-[#2a2a3a] bg-[#1a1a24] text-gray-400'
                        }
                        title={
                          isStored
                            ? 'Plaintext key is encrypted at rest and can be retrieved by you.'
                            : 'Plaintext was returned once at creation and never persisted.'
                        }
                      >
                        {isStored ? 'Stored (encrypted)' : 'One-time'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mb-3 flex-wrap">
                      <code className="flex-1 min-w-0 bg-[#1a1a24] border border-[#2a2a3a] px-3 py-2 text-sm text-gray-300 font-mono rounded break-all">
                        {keyDisplay}
                      </code>
                      {rawKey && (
                        <>
                          <button
                            type="button"
                            onClick={() => toggleKeyVisibility(agent.id)}
                            className="p-2 text-gray-400 hover:text-white hover:bg-[#1a1a24] rounded transition-colors shrink-0"
                            title={keyVisible ? 'Hide key' : 'Show key'}
                          >
                            {keyVisible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(rawKey)}
                            className="p-2 text-gray-400 hover:text-white hover:bg-[#1a1a24] rounded transition-colors shrink-0"
                            title="Copy key"
                          >
                            <Copy className="size-4" />
                          </button>
                        </>
                      )}
                      {!rawKey && isStored && accessToken && (
                        <button
                          type="button"
                          disabled={isRevealing}
                          onClick={async () => {
                            setRevealingId(agent.id);
                            setAgentsError(null);
                            try {
                              const res = await authApi.revealAgentKey(accessToken, agent.id);
                              setCreatedAgentKeys((prev) => ({ ...prev, [agent.id]: res.api_key }));
                              setVisibleKeys((prev) => {
                                const next = new Set(prev);
                                next.add(agent.id);
                                return next;
                              });
                            } catch (e: unknown) {
                              setAgentsError(e instanceof Error ? e.message : 'Reveal failed');
                            } finally {
                              setRevealingId((cur) => (cur === agent.id ? null : cur));
                            }
                          }}
                          className="px-3 py-1.5 text-xs bg-[#1a1a24] border border-[#4f46e5]/40 text-[#a5b4fc] hover:bg-[#4f46e5]/15 rounded shrink-0 disabled:opacity-50"
                          title="Decrypt and show plaintext key"
                        >
                          {isRevealing ? 'Revealing…' : 'Reveal'}
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-400 flex-wrap">
                      <span>Created: {new Date(agent.created_at).toLocaleString()}</span>
                      <span>·</span>
                      <span>
                        Last used:{' '}
                        {agent.last_used_at ? new Date(agent.last_used_at).toLocaleString() : 'Never'}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!accessToken) return;
                      if (!window.confirm(`Delete agent "${agent.name}"? This cannot be undone.`)) return;
                      try {
                        await authApi.deleteAgent(accessToken, agent.id);
                        setAgents((prev) => prev.filter((a) => a.id !== agent.id));
                        setCreatedAgentKeys((prev) => {
                          const next = { ...prev };
                          delete next[agent.id];
                          return next;
                        });
                        setVisibleKeys((prev) => {
                          const next = new Set(prev);
                          next.delete(agent.id);
                          return next;
                        });
                      } catch (e: unknown) {
                        setAgentsError(e instanceof Error ? e.message : 'Delete failed');
                      }
                    }}
                    className="p-2 text-gray-400 hover:text-[#ef4444] hover:bg-[#ef4444]/10 rounded transition-colors shrink-0"
                    title="Delete agent"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
                <p className="text-xs text-gray-500">
                  {isStored
                    ? 'Plaintext is encrypted with the collector signing secret. Use Reveal to retrieve it.'
                    : 'API key is returned only at creation; copy it immediately — it cannot be retrieved later.'}
                </p>
              </div>
            );
          })}
        </div>

        {showNewAPIKeyForm && accessToken && (
          <div className="bg-[#0a0a0f] border border-[#4f46e5]/30 rounded-lg p-6 space-y-4">
            <h3 className="text-white font-medium">Create agent</h3>
            <div>
              <label className="text-sm text-gray-400 mb-2 block" htmlFor="new-agent-name">
                Agent name
              </label>
              <input
                id="new-agent-name"
                type="text"
                value={newAgentName}
                onChange={(e) => setNewAgentName(e.target.value)}
                placeholder="e.g. production-web-01"
                className="w-full bg-[#1a1a24] border border-[#2a2a3a] px-4 py-2.5 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-[#4f46e5] transition-colors rounded"
              />
            </div>
            <fieldset className="space-y-2">
              <legend className="text-sm text-gray-400 mb-1">Key handling</legend>
              <label className="flex items-start gap-3 cursor-pointer p-3 rounded border border-[#2a2a3a] hover:border-[#4f46e5]/60 bg-[#0a0a0f]">
                <input
                  type="radio"
                  name="agent-key-storage"
                  className="mt-1 accent-[#4f46e5]"
                  checked={!newAgentStore}
                  onChange={() => setNewAgentStore(false)}
                />
                <span className="text-sm">
                  <span className="text-white font-medium block">One-time (recommended)</span>
                  <span className="text-gray-400 text-xs">
                    The plaintext key is shown once at creation and never persisted on the server.
                    Only its hash is stored; you must copy it now.
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-3 cursor-pointer p-3 rounded border border-[#2a2a3a] hover:border-[#4f46e5]/60 bg-[#0a0a0f]">
                <input
                  type="radio"
                  name="agent-key-storage"
                  className="mt-1 accent-[#4f46e5]"
                  checked={newAgentStore}
                  onChange={() => setNewAgentStore(true)}
                />
                <span className="text-sm">
                  <span className="text-white font-medium block">Store encrypted on server</span>
                  <span className="text-gray-400 text-xs">
                    The collector encrypts the key with its signing secret (Fernet) so you can
                    retrieve it later via the Reveal button. Rotating the JWT secret invalidates
                    stored keys.
                  </span>
                </span>
              </label>
            </fieldset>
            <div className="flex items-center gap-3 pt-2 flex-wrap">
              <button
                type="button"
                onClick={async () => {
                  const name = newAgentName.trim();
                  if (!accessToken || !name) return;
                  setAgentsError(null);
                  try {
                    const res = await authApi.createAgent(accessToken, name, {
                      storeEncrypted: newAgentStore,
                    });
                    setCreatedAgentKeys((prev) => ({ ...prev, [res.agent.id]: res.api_key }));
                    setLastCreatedAgentId(res.agent.id);
                    setAgents((prev) => [res.agent, ...prev]);
                    setVisibleKeys(new Set([res.agent.id]));
                    setNewAgentName('');
                    setNewAgentStore(false);
                    setShowNewAPIKeyForm(false);
                  } catch (e: unknown) {
                    setAgentsError(e instanceof Error ? e.message : 'Create failed');
                  }
                }}
                className="px-4 py-2 bg-[#4f46e5] hover:bg-[#6366f1] text-white rounded transition-colors text-sm font-medium"
              >
                Create
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowNewAPIKeyForm(false);
                  setNewAgentStore(false);
                }}
                className="px-4 py-2 bg-[#1a1a24] border border-[#2a2a3a] text-gray-300 hover:text-white rounded transition-colors text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {lastCreatedAgentId && keyForAgent(lastCreatedAgentId) && (
          <div className="bg-[#4f46e5]/10 border border-[#4f46e5]/30 rounded p-4">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="text-xs text-gray-300">
                {agents.find((a) => a.id === lastCreatedAgentId)?.key_stored
                  ? 'Latest created API key — also stored encrypted on the server (use Reveal to retrieve later).'
                  : 'Latest created API key — copy now; it cannot be shown again.'}
              </div>
              <button
                type="button"
                onClick={() => setLastCreatedAgentId(null)}
                className="text-xs text-gray-400 hover:text-white shrink-0"
              >
                Dismiss
              </button>
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-[#1a1a24] border border-[#2a2a3a] px-3 py-2 text-sm text-gray-200 font-mono rounded break-all">
                {keyForAgent(lastCreatedAgentId)}
              </code>
              <button
                type="button"
                onClick={() => copyToClipboard(keyForAgent(lastCreatedAgentId) as string)}
                className="p-2 text-gray-300 hover:text-white hover:bg-[#1a1a24] rounded transition-colors shrink-0"
                title="Copy"
              >
                <Copy className="size-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
