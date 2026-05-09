import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Search,
  Hash,
  Shield,
  AlertTriangle,
  Lock,
  FileCode,
  Zap,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react';
import {
  createRule,
  deleteRule,
  fetchRules,
  reloadRules,
  updateRule,
  type DetectionRule,
  type RuleType,
} from '@/lib/smartsiemApi';

const RULE_TYPES: RuleType[] = ['threshold', 'pattern', 'statistical', 'sequence'];
const SEVERITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'] as const;

type FormState = {
  rule_id: string;
  name: string;
  description: string;
  type: RuleType;
  severity: string;
  event_type: string;
  configText: string;
  status: 'ACTIVE' | 'DISABLED';
};

const EMPTY_FORM: FormState = {
  rule_id: '',
  name: '',
  description: '',
  type: 'pattern',
  severity: 'MEDIUM',
  event_type: '',
  configText: '{}',
  status: 'ACTIVE',
};

function severityIcon(severity?: string) {
  switch ((severity || '').toUpperCase()) {
    case 'CRITICAL':
      return <Shield className="size-4 text-[#ef4444]" />;
    case 'HIGH':
      return <AlertTriangle className="size-4 text-[#f59e0b]" />;
    case 'MEDIUM':
      return <Zap className="size-4 text-[#eab308]" />;
    case 'LOW':
      return <FileCode className="size-4 text-[#3b82f6]" />;
    default:
      return <Shield className="size-4 text-gray-400" />;
  }
}

function severityChip(severity?: string) {
  switch ((severity || '').toUpperCase()) {
    case 'CRITICAL':
      return 'bg-[#ef4444]/20 text-[#ef4444] border-[#ef4444]/30';
    case 'HIGH':
      return 'bg-[#f59e0b]/20 text-[#f59e0b] border-[#f59e0b]/30';
    case 'MEDIUM':
      return 'bg-[#eab308]/20 text-[#eab308] border-[#eab308]/30';
    case 'LOW':
      return 'bg-[#3b82f6]/20 text-[#3b82f6] border-[#3b82f6]/30';
    default:
      return 'bg-gray-700/20 text-gray-400 border-gray-700/30';
  }
}

function timeAgo(timestamp?: string | null) {
  if (!timestamp) return 'Never updated';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return timestamp;
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `${diffHrs} hour${diffHrs > 1 ? 's' : ''} ago`;
  const diffDays = Math.floor(diffHrs / 24);
  return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
}

export function DetectionRulesPage() {
  const [rules, setRules] = useState<DetectionRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [busyRuleId, setBusyRuleId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchRules({ includeInactive: true });
      setRules(res.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load rules');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const filteredRules = useMemo(() => {
    const q = searchQuery.toLowerCase();
    if (!q) return rules;
    return rules.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.rule_id.toLowerCase().includes(q) ||
        (r.description || '').toLowerCase().includes(q) ||
        String(r.event_type || '')
          .toLowerCase()
          .includes(q) ||
        String(r.type || '')
          .toLowerCase()
          .includes(q)
    );
  }, [rules, searchQuery]);

  const enabledCount = useMemo(
    () => rules.filter((r) => String(r.status).toUpperCase() === 'ACTIVE').length,
    [rules]
  );

  const toggleRule = async (rule: DetectionRule) => {
    const next = String(rule.status).toUpperCase() === 'ACTIVE' ? 'DISABLED' : 'ACTIVE';
    setBusyRuleId(rule.rule_id);
    try {
      const updated = await updateRule(rule.rule_id, { status: next });
      setRules((prev) => prev.map((r) => (r.rule_id === rule.rule_id ? { ...r, ...updated } : r)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update rule');
    } finally {
      setBusyRuleId(null);
    }
  };

  const removeRule = async (rule: DetectionRule) => {
    if (!window.confirm(`Delete rule "${rule.name}"? This cannot be undone.`)) return;
    setBusyRuleId(rule.rule_id);
    try {
      await deleteRule(rule.rule_id);
      setRules((prev) => prev.filter((r) => r.rule_id !== rule.rule_id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete rule');
    } finally {
      setBusyRuleId(null);
    }
  };

  const submitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    let parsedConfig: Record<string, unknown> = {};
    try {
      parsedConfig = form.configText.trim() ? JSON.parse(form.configText) : {};
      if (parsedConfig === null || typeof parsedConfig !== 'object' || Array.isArray(parsedConfig)) {
        throw new Error('config must be a JSON object');
      }
    } catch (err) {
      setError(err instanceof Error ? `Invalid config JSON: ${err.message}` : 'Invalid config JSON');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        ...(form.rule_id ? { rule_id: form.rule_id } : {}),
        name: form.name,
        description: form.description || undefined,
        type: form.type,
        severity: form.severity,
        event_type: form.event_type || undefined,
        status: form.status,
        config: parsedConfig,
      };
      const created = await createRule(payload);
      setRules((prev) => [created, ...prev]);
      setShowCreate(false);
      setForm(EMPTY_FORM);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create rule');
    } finally {
      setSubmitting(false);
    }
  };

  const triggerReload = async () => {
    try {
      await reloadRules();
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reload rules');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl text-white mb-2">Detection Rules</h1>
          <p className="text-gray-400">
            {enabledCount} of {rules.length} rule{rules.length === 1 ? '' : 's'} active • backed
            by <span className="font-mono text-white">detection_rules</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void triggerReload()}
            className="flex items-center gap-2 text-sm text-gray-300 px-3 py-2 bg-[#1a1a24] hover:bg-[#2a2a3a] border border-[#2a2a3a]"
            disabled={loading}
          >
            <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
            Reload
          </button>
          <button
            onClick={() => {
              setForm(EMPTY_FORM);
              setShowCreate(true);
            }}
            className="flex items-center gap-2 bg-[#4f46e5] hover:bg-[#4338ca] text-white px-3 py-2 text-sm"
          >
            <Plus className="size-4" />
            New Rule
          </button>
        </div>
      </div>

      {error && (
        <div className="text-sm text-amber-400 bg-amber-400/10 border border-amber-400/40 px-3 py-2">
          {error}
        </div>
      )}

      <div className="bg-[#0f0f17] border border-[#1f1f2e] rounded-lg p-6">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-gray-500" />
          <input
            type="text"
            placeholder="Search rules by name, ID, type, event type, or description…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#1a1a24] border border-[#2a2a3a] pl-12 pr-4 py-3 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-[#4f46e5] transition-colors rounded"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard label="Total" value={rules.length} icon={<FileCode className="size-8 text-[#4f46e5]" />} />
        <StatCard
          label="Active"
          value={enabledCount}
          valueClass="text-[#10b981]"
          icon={<Shield className="size-8 text-[#10b981]" />}
        />
        <StatCard
          label="Disabled"
          value={rules.length - enabledCount}
          valueClass="text-[#ef4444]"
          icon={<Lock className="size-8 text-[#ef4444]" />}
        />
        <StatCard
          label="Types"
          value={new Set(rules.map((r) => r.type)).size}
          icon={<Zap className="size-8 text-[#f59e0b]" />}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filteredRules.map((rule) => {
          const enabled = String(rule.status).toUpperCase() === 'ACTIVE';
          return (
            <div
              key={rule.rule_id}
              className={`bg-[#0f0f17] border rounded-lg p-5 transition-all ${
                enabled
                  ? 'border-[#1f1f2e] hover:border-[#4f46e5]/50'
                  : 'border-[#1f1f2e] opacity-60'
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="mt-0.5">{severityIcon(String(rule.severity))}</div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg text-white font-medium mb-1 truncate">{rule.name}</h3>
                    <p className="text-sm text-gray-400 mb-2 line-clamp-2">
                      {rule.description || rule.event_type || 'No description'}
                    </p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs px-2 py-0.5 border rounded ${severityChip(String(rule.severity))}`}>
                        {String(rule.severity || '').toUpperCase()}
                      </span>
                      <span className="text-xs px-2 py-0.5 bg-[#1a1a24] text-gray-400 rounded">
                        {rule.type}
                      </span>
                      {rule.event_type && (
                        <span className="text-xs px-2 py-0.5 bg-[#1a1a24] text-gray-400 rounded font-mono">
                          {rule.event_type}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2 ml-2">
                  <button
                    onClick={() => void toggleRule(rule)}
                    disabled={busyRuleId === rule.rule_id}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50 ${
                      enabled ? 'bg-[#4f46e5]' : 'bg-[#2a2a3a]'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        enabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                  <button
                    onClick={() => void removeRule(rule)}
                    disabled={busyRuleId === rule.rule_id}
                    className="text-gray-500 hover:text-[#ef4444] disabled:opacity-50"
                    title="Delete rule"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-[#1f1f2e] text-xs text-gray-400">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Hash className="size-3.5 flex-shrink-0" />
                    <span className="font-mono truncate">{rule.rule_id}</span>
                  </div>
                </div>
                <div className="text-right whitespace-nowrap">
                  Updated {timeAgo(rule.updated_at || rule.created_at)}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredRules.length === 0 && !loading && (
        <div className="bg-[#0f0f17] border border-[#1f1f2e] rounded-lg p-12 text-center">
          <Search className="size-12 text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg text-white mb-2">No rules found</h3>
          <p className="text-gray-400">
            {rules.length === 0
              ? 'Create the first detection rule to get started.'
              : 'Try adjusting your search query.'}
          </p>
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <form
            onSubmit={submitForm}
            className="w-full max-w-2xl bg-[#0f0f17] border border-[#1f1f2e] p-6 max-h-[90vh] overflow-auto"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl text-white">Create Detection Rule</h3>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Rule ID (optional)">
                <input
                  type="text"
                  placeholder="auto-generated if blank"
                  value={form.rule_id}
                  onChange={(e) => setForm({ ...form, rule_id: e.target.value })}
                  className="w-full bg-[#1a1a24] border border-[#2a2a3a] px-3 py-2 text-sm text-white"
                />
              </Field>
              <Field label="Name *">
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full bg-[#1a1a24] border border-[#2a2a3a] px-3 py-2 text-sm text-white"
                />
              </Field>
              <Field label="Type *">
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value as RuleType })}
                  className="w-full bg-[#1a1a24] border border-[#2a2a3a] px-3 py-2 text-sm text-white"
                >
                  {RULE_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Severity">
                <select
                  value={form.severity}
                  onChange={(e) => setForm({ ...form, severity: e.target.value })}
                  className="w-full bg-[#1a1a24] border border-[#2a2a3a] px-3 py-2 text-sm text-white"
                >
                  {SEVERITIES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Event Type">
                <input
                  type="text"
                  placeholder="AUTH_FAIL, PROC_CREATE, …"
                  value={form.event_type}
                  onChange={(e) => setForm({ ...form, event_type: e.target.value })}
                  className="w-full bg-[#1a1a24] border border-[#2a2a3a] px-3 py-2 text-sm text-white font-mono"
                />
              </Field>
              <Field label="Status">
                <select
                  value={form.status}
                  onChange={(e) =>
                    setForm({ ...form, status: e.target.value as 'ACTIVE' | 'DISABLED' })
                  }
                  className="w-full bg-[#1a1a24] border border-[#2a2a3a] px-3 py-2 text-sm text-white"
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="DISABLED">DISABLED</option>
                </select>
              </Field>
              <Field label="Description" className="md:col-span-2">
                <textarea
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full bg-[#1a1a24] border border-[#2a2a3a] px-3 py-2 text-sm text-white"
                />
              </Field>
              <Field label="Config JSON" className="md:col-span-2">
                <textarea
                  rows={6}
                  value={form.configText}
                  onChange={(e) => setForm({ ...form, configText: e.target.value })}
                  className="w-full bg-[#0a0a0f] border border-[#2a2a3a] px-3 py-2 text-xs text-[#10b981] font-mono"
                  placeholder='{ "window_sec": 60, "threshold": 5, "key_fields": ["source_ip"] }'
                />
              </Field>
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-[#1f1f2e] mt-6">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="px-4 py-2 bg-[#1a1a24] hover:bg-[#2a2a3a] border border-[#2a2a3a] text-white text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 bg-[#4f46e5] hover:bg-[#4338ca] text-white text-sm disabled:opacity-50"
              >
                {submitting ? 'Creating…' : 'Create Rule'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  valueClass,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  valueClass?: string;
}) {
  return (
    <div className="bg-[#0f0f17] border border-[#1f1f2e] rounded-lg p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-400 uppercase mb-1">{label}</p>
          <p className={`text-2xl font-semibold ${valueClass || 'text-white'}`}>
            {value.toLocaleString()}
          </p>
        </div>
        {icon}
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className || ''}`}>
      <span className="block text-xs text-gray-400 uppercase mb-1">{label}</span>
      {children}
    </label>
  );
}
