import { Fragment, useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { adminApi, AUDIT_ACTIONS, type AuditResponse } from '../api/adminApi';
import { cardCls, ErrorBanner, mutedText, OutcomeBadge, relTime, SkeletonRow } from '../components/shared';

type Preset = '24h' | '7d' | 'custom';

const inputCls =
  'w-full rounded-md border border-[#1f1f2e] bg-[#0a0a0f] px-3 py-2 text-sm text-white placeholder:text-[#6b7280] focus:border-[#4f46e5] focus:outline-none';

export default function AuditTab({ refreshKey }: { refreshKey: number }) {
  const [username, setUsername] = useState('');
  const [action, setAction] = useState('');
  const [preset, setPreset] = useState<Preset>('24h');
  const [since, setSince] = useState('');
  const [until, setUntil] = useState('');
  const [offset, setOffset] = useState(0);
  const limit = 25;
  const [data, setData] = useState<AuditResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const params: Parameters<typeof adminApi.getAuditLog>[0] = { limit, offset };
    if (username) params.username = username;
    if (action) params.action = action;
    if (preset === '24h') params.since = new Date(Date.now() - 24 * 3600_000).toISOString();
    else if (preset === '7d') params.since = new Date(Date.now() - 7 * 24 * 3600_000).toISOString();
    else {
      if (since) params.since = new Date(since).toISOString();
      if (until) params.until = new Date(until).toISOString();
    }
    adminApi
      .getAuditLog(params)
      .then(setData)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load audit log'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, offset, refreshKey]);

  const apply = () => {
    setOffset(0);
    setVersion((value) => value + 1);
  };

  const clear = () => {
    setUsername('');
    setAction('');
    setPreset('24h');
    setSince('');
    setUntil('');
    setOffset(0);
    setVersion((value) => value + 1);
  };

  if (error) return <ErrorBanner error={error} onRetry={apply} />;

  return (
    <div className="space-y-4">
      <div className={`${cardCls} space-y-3 p-4`}>
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[180px] flex-1">
            <label className={`mb-1 block text-xs ${mutedText}`}>Username</label>
            <input value={username} onChange={(e) => setUsername(e.target.value)} className={inputCls} placeholder="any" />
          </div>
          <div className="min-w-[200px] flex-1">
            <label className={`mb-1 block text-xs ${mutedText}`}>Action</label>
            <select value={action} onChange={(e) => setAction(e.target.value)} className={inputCls}>
              <option value="">All actions</option>
              {AUDIT_ACTIONS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-1">
            {(['24h', '7d', 'custom'] as Preset[]).map((item) => (
              <button
                type="button"
                key={item}
                onClick={() => setPreset(item)}
                className={`rounded-md border px-3 py-2 text-xs ${preset === item ? 'border-[#4f46e5] bg-[#4f46e5]/20 text-white' : 'border-[#1f1f2e] text-[#9ca3af] hover:bg-[#1a1a24]'}`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
        {preset === 'custom' && (
          <div className="flex flex-wrap gap-2">
            <div>
              <label className={`mb-1 block text-xs ${mutedText}`}>Since</label>
              <input type="datetime-local" value={since} onChange={(e) => setSince(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={`mb-1 block text-xs ${mutedText}`}>Until</label>
              <input type="datetime-local" value={until} onChange={(e) => setUntil(e.target.value)} className={inputCls} />
            </div>
          </div>
        )}
        <div className="flex gap-2">
          <button type="button" onClick={apply} className="rounded-md bg-[#4f46e5] px-3 py-2 text-sm font-medium text-white hover:bg-[#4338ca]">
            Apply
          </button>
          <button type="button" onClick={clear} className="rounded-md px-3 py-2 text-sm text-[#9ca3af] hover:text-white">
            Clear
          </button>
        </div>
      </div>

      <div className={`${cardCls} overflow-hidden`}>
        <table className="w-full text-sm">
          <thead className={`${mutedText} text-left text-xs uppercase`}>
            <tr className="border-b border-[#1f1f2e]">
              <th className="w-8 px-2 py-3" />
              <th className="px-4 py-3 font-medium">Time</th>
              <th className="px-4 py-3 font-medium">Username</th>
              <th className="px-4 py-3 font-medium">Action</th>
              <th className="px-4 py-3 font-medium">Outcome</th>
              <th className="px-4 py-3 font-medium">Reason</th>
              <th className="px-4 py-3 font-medium">Source IP</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={7} className="p-4">
                  <SkeletonRow cols={6} />
                  <SkeletonRow cols={6} />
                  <SkeletonRow cols={6} />
                </td>
              </tr>
            )}
            {!loading && data?.entries.length === 0 && (
              <tr>
                <td colSpan={7} className={`p-8 text-center ${mutedText}`}>
                  No audit entries match.
                </td>
              </tr>
            )}
            {!loading &&
              data?.entries.map((entry, index) => {
                const key = entry.id ?? `${entry.timestamp}-${entry.username}-${index}`;
                const open = expanded === key;
                return (
                  <Fragment key={key}>
                    <tr onClick={() => setExpanded(open ? null : key)} className="cursor-pointer border-b border-[#1f1f2e] hover:bg-[#1a1a24]">
                      <td className="px-2 py-3 text-[#6b7280]">
                        <ChevronDown className={`h-4 w-4 transition ${open ? 'rotate-180' : ''}`} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-white">{new Date(entry.timestamp).toLocaleString()}</div>
                        <div className={`text-xs ${mutedText}`}>{relTime(entry.timestamp)}</div>
                      </td>
                      <td className="px-4 py-3 font-mono text-white">{entry.username}</td>
                      <td className="px-4 py-3 text-white">{entry.action}</td>
                      <td className="px-4 py-3">
                        <OutcomeBadge outcome={entry.outcome} />
                      </td>
                      <td className={`px-4 py-3 ${mutedText}`}>{entry.reason || '-'}</td>
                      <td className={`px-4 py-3 ${mutedText}`}>{entry.sourceIp || '-'}</td>
                    </tr>
                    {open && (
                      <tr className="border-b border-[#1f1f2e] bg-[#0a0a0f]">
                        <td colSpan={7} className="p-4">
                          <pre className="overflow-x-auto rounded-md border border-[#1f1f2e] bg-black/40 p-3 text-xs text-[#a5b4fc]">
                            {JSON.stringify(entry.metadata ?? {}, null, 2)}
                          </pre>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
          </tbody>
        </table>

        {data && (
          <div className="flex items-center justify-between border-t border-[#1f1f2e] p-3 text-xs">
            <span className={mutedText}>
              Showing {data.entries.length === 0 ? 0 : data.offset + 1}-{data.offset + data.entries.length} of {data.total}
            </span>
            <div className="flex gap-2">
              <button type="button" disabled={offset === 0} onClick={() => setOffset((value) => Math.max(0, value - limit))} className="rounded border border-[#1f1f2e] px-3 py-1 text-white hover:bg-[#1a1a24] disabled:opacity-40">
                Previous
              </button>
              <button type="button" disabled={data.offset + data.entries.length >= data.total} onClick={() => setOffset((value) => value + limit)} className="rounded border border-[#1f1f2e] px-3 py-1 text-white hover:bg-[#1a1a24] disabled:opacity-40">
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
