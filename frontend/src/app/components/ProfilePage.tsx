import { useEffect, useState } from 'react';
import { User, Plus, Copy, RotateCw, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../AuthContext';
import { authFetch } from '../api/auth';
import {
  fetchAgents,
  createAgent,
  revealAgentApiKey,
  regenerateAgentApiKey,
  updateAgent,
  type AgentRecord,
  type CreatedAgentRecord,
} from '../api/agents';

export function ProfilePage() {
  const { session, setSession } = useAuth();
  const [username, setUsername] = useState(session?.username ?? '');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Agents
  const [agents, setAgents] = useState<AgentRecord[]>([]);
  const [agentsLoading, setAgentsLoading] = useState(true);
  const [isCreatingAgent, setIsCreatingAgent] = useState(false);
  const [showNewAgentForm, setShowNewAgentForm] = useState(false);
  const [newAgentName, setNewAgentName] = useState('');
  const [newAgentStorageMode, setNewAgentStorageMode] = useState<'one_time' | 'stored'>('one_time');
  const [latestCreatedAgent, setLatestCreatedAgent] = useState<CreatedAgentRecord | null>(null);
  const [revealedKeys, setRevealedKeys] = useState<Record<string, string>>({});
  const [editingAgentId, setEditingAgentId] = useState<string | null>(null);
  const [editNames, setEditNames] = useState<Record<string, string>>({});
  const [editSavingId, setEditSavingId] = useState<string | null>(null);
  const [agentError, setAgentError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      setLoading(true);
      try {
        const res = await authFetch('/api/auth/me');
        if (!alive) return;
        if (!res.ok) throw new Error('Failed to load profile');
        const data = await res.json();
        setUsername((data.username as string) ?? session?.username ?? '');
        setEmail((data.email as string) ?? '');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load profile');
      } finally {
        setLoading(false);
      }
    };
    void load();

    void loadAgents();

    return () => {
      alive = false;
    };
  }, [session]);

  async function loadAgents() {
    setAgentsLoading(true);
    try {
      const next = await fetchAgents();
      setAgents(next);
    } catch (err) {
      // ignore for now; show none
    } finally {
      setAgentsLoading(false);
    }
  }

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await authFetch('/api/auth/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email }),
      });
      if (!res.ok) throw new Error('Failed to save profile');
      const data = await res.json();
      setMessage('Profile updated');
      if (data.username) {
        setSession({ ...session!, username: data.username });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save profile');
    } finally {
      setSaving(false);
      window.setTimeout(() => setMessage(null), 3000);
    }
  };

  const handleCreateAgent = async () => {
    const trimmed = newAgentName.trim();
    if (!trimmed) return;
    setIsCreatingAgent(true);
    try {
      const created = await createAgent(trimmed, newAgentStorageMode === 'stored');
      setLatestCreatedAgent(created);
      setShowNewAgentForm(false);
      setNewAgentName('');
      await loadAgents();
    } catch (err) {
      // ignore errors for now
    } finally {
      setIsCreatingAgent(false);
    }
  };

  const handleReveal = async (agentId: string) => {
    // toggle: hide if already revealed
    if (revealedKeys[agentId]) {
      setRevealedKeys((s) => {
        const next = { ...s };
        delete next[agentId];
        return next;
      });
      return;
    }

    try {
      const revealed = await revealAgentApiKey(agentId);
      setRevealedKeys((s) => ({ ...s, [agentId]: revealed.apiKey }));
    } catch {
      // ignore
    }
  };

  const startEditAgent = (agent: AgentRecord) => {
    setEditingAgentId(agent.agentId);
    setEditNames((s) => ({ ...s, [agent.agentId]: agent.name }));
  };

  const cancelEditAgent = (agentId: string) => {
    setEditingAgentId((cur) => (cur === agentId ? null : cur));
  };

  const saveEditAgent = async (agentId: string) => {
    const newName = (editNames[agentId] ?? '').trim();
    if (!newName) return;
    setAgentError(null);
    setEditSavingId(agentId);
    try {
      const updated = await updateAgent(agentId, { name: newName });
      setAgents((s) => s.map((a) => (a.agentId === agentId ? updated : a)));
      setEditingAgentId(null);
    } catch (err) {
      setAgentError(err instanceof Error ? err.message : 'Failed to update agent');
    } finally {
      setEditSavingId(null);
    }
  };

  const handleRegenerate = async (agentId: string) => {
    try {
      const created = await regenerateAgentApiKey(agentId, false);
      setLatestCreatedAgent(created);
      await loadAgents();
    } catch {
      // ignore
    }
  };

  const initials = (username || '').split(' ').map((s) => s[0]).join('').slice(0,2).toUpperCase() || 'U';

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center gap-6">
        <div className="size-20 rounded-full bg-[#111827] flex items-center justify-center text-3xl text-white font-semibold">{initials}</div>
        <div>
          <h1 className="text-2xl text-white font-semibold">{username}</h1>
          <div className="text-sm text-gray-400">{session?.role}</div>
        </div>

        {agentError && <div className="text-sm text-[#fecaca] mb-3">{agentError}</div>}
      </header>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-[#0a0a0f] border border-[#1f1f2e] rounded-lg p-6">
          <h2 className="text-xl text-white mb-4">Account</h2>
          {loading ? (
            <div className="text-sm text-gray-400">Loading…</div>
          ) : (
            <div className="space-y-4">
              {error && <div className="text-sm text-[#fecaca]">{error}</div>}
              {message && <div className="text-sm text-[#bbf7d0]">{message}</div>}

              <div>
                <label className="text-sm text-gray-400 block mb-1">Username</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-[#1a1a24] border border-[#2a2a3a] px-4 py-2.5 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-[#4f46e5] transition-colors rounded"
                />
              </div>

              <div>
                <label className="text-sm text-gray-400 block mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-[#1a1a24] border border-[#2a2a3a] px-4 py-2.5 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-[#4f46e5] transition-colors rounded"
                />
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => void handleSave()}
                  disabled={saving}
                  className="px-4 py-2 bg-[#4f46e5] hover:bg-[#6366f1] text-white rounded transition-colors text-sm font-medium disabled:opacity-60"
                >
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </div>
          )}
        </div>

        <aside className="bg-[#0a0a0f] border border-[#1f1f2e] rounded-lg p-6">
          <h3 className="text-lg text-white mb-2">Quick Info</h3>
          <div className="text-sm text-gray-400">Role: <span className="text-white ml-1">{session?.role}</span></div>
        </aside>
      </section>

      <section className="bg-[#0a0a0f] border border-[#1f1f2e] rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl text-white">Agents</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => void loadAgents()}
              className="px-3 py-2 bg-[#1a1a24] border border-[#2a2a3a] text-sm text-white rounded"
            >
              <RotateCw className="inline size-4 mr-2" />
              Refresh
            </button>
            <button
              onClick={() => setShowNewAgentForm((s) => !s)}
              className="px-3 py-2 bg-[#4f46e5] hover:bg-[#6366f1] text-white rounded text-sm flex items-center gap-2"
            >
              <Plus className="size-4" /> Create Agent
            </button>
          </div>
        </div>

        {showNewAgentForm && (
          <div className="mb-4 space-y-3">
            <input
              type="text"
              value={newAgentName}
              onChange={(e) => setNewAgentName(e.target.value)}
              placeholder="Agent name (e.g., Web Server)"
              className="w-full bg-[#1a1a24] border border-[#2a2a3a] px-4 py-2.5 text-sm text-white rounded"
            />
            <div className="flex items-center gap-2">
              <label className={`px-3 py-2 rounded ${newAgentStorageMode === 'one_time' ? 'bg-[#10b981]/10 border-[#10b981]' : 'bg-[#12121a] border-[#2a2a3a]'}`}> 
                <input type="radio" name="store" checked={newAgentStorageMode === 'one_time'} onChange={() => setNewAgentStorageMode('one_time')} /> One-time
              </label>
              <label className={`px-3 py-2 rounded ${newAgentStorageMode === 'stored' ? 'bg-[#f59e0b]/10 border-[#f59e0b]' : 'bg-[#12121a] border-[#2a2a3a]'}`}>
                <input type="radio" name="store" checked={newAgentStorageMode === 'stored'} onChange={() => setNewAgentStorageMode('stored')} /> Store encrypted
              </label>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => void handleCreateAgent()} disabled={isCreatingAgent} className="px-3 py-2 bg-[#4f46e5] text-white rounded">
                {isCreatingAgent ? 'Creating…' : 'Create'}
              </button>
            </div>
          </div>
        )}

        {latestCreatedAgent && (
          <div className="mb-4 p-3 bg-[#071023] border border-[#10304a] rounded">
            <div className="text-sm text-white font-medium">New Agent: {latestCreatedAgent.name}</div>
            <div className="text-xs text-gray-400">ID: {latestCreatedAgent.agentId}</div>
            <div className="mt-2 flex gap-2">
              <button onClick={() => navigator.clipboard.writeText(latestCreatedAgent.apiKey)} className="px-3 py-1.5 bg-[#4f46e5] text-white rounded text-sm inline-flex items-center gap-2"><Copy className="size-4" /> Copy Key</button>
            </div>
          </div>
        )}

        <div className="space-y-3">
          {agentsLoading ? (
            <div className="text-sm text-gray-400">Loading agents…</div>
          ) : agents.length === 0 ? (
            <div className="text-sm text-gray-400">No agents yet. Create one above.</div>
          ) : (
            agents.map((a) => (
              <div key={a.agentId} className="flex items-center justify-between p-3 bg-[#071018] border border-[#10202a] rounded">
                <div className="min-w-0">
                  {editingAgentId === a.agentId ? (
                    <div className="space-y-1">
                      <input
                        value={editNames[a.agentId] ?? ''}
                        onChange={(e) => setEditNames((s) => ({ ...s, [a.agentId]: e.target.value }))}
                        className="w-full bg-[#1a1a24] border border-[#2a2a3a] px-3 py-1.5 text-sm text-white rounded"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => void saveEditAgent(a.agentId)}
                          disabled={editSavingId === a.agentId}
                          className="px-2 py-1 bg-[#4f46e5] text-white rounded text-sm disabled:opacity-60"
                        >
                          {editSavingId === a.agentId ? 'Saving…' : 'Save'}
                        </button>
                        <button onClick={() => cancelEditAgent(a.agentId)} className="px-2 py-1 bg-[#1a1a24] border border-[#2a2a3a] text-sm rounded">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="text-sm text-white font-medium truncate">{a.name}</div>
                      <div className="text-xs text-gray-400 truncate">{a.agentId}</div>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {editingAgentId !== a.agentId && (
                    <button onClick={() => startEditAgent(a)} className="px-2 py-1.5 bg-[#1a1a24] border border-[#2a2a3a] text-sm rounded">Edit</button>
                  )}
                  <button onClick={() => handleReveal(a.agentId)} className="px-2 py-1.5 bg-[#1a1a24] border border-[#2a2a3a] text-sm rounded inline-flex items-center gap-2">
                    {revealedKeys[a.agentId] ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    {revealedKeys[a.agentId] ? 'Hide' : 'Reveal'}
                  </button>
                  <button onClick={() => handleRegenerate(a.agentId)} className="px-2 py-1.5 bg-[#1a1a24] border border-[#2a2a3a] text-sm rounded inline-flex items-center gap-2"><RotateCw className="size-4" /> Regenerate</button>
                  {revealedKeys[a.agentId] && (
                    <div className="ml-2 max-w-[28rem] break-words bg-[#071023] px-2 py-1 rounded font-mono text-sm text-[#c4b5fd]">
                      {revealedKeys[a.agentId]}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

export default ProfilePage;
