import type { FormEvent } from 'react';
import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';

export function LoginPage() {
  const { login, state } = useAuth();
  const nav = useNavigate();
  const loc = useLocation() as any;
  const from = loc?.state?.from || '/dashboard';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (state.status === 'authenticated') {
    nav(from, { replace: true });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await login(email, password);
      nav(from, { replace: true });
    } catch (e: any) {
      setErr(e?.message || 'Login failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-[#0f0f17] border border-[#1f1f2e] rounded-lg p-6">
        <h1 className="text-2xl font-semibold mb-2">Sign in</h1>
        <p className="text-sm text-gray-400 mb-6">Access your SmartSIEM workspace.</p>

        {err && <div className="mb-4 text-sm text-[#ef4444]">{err}</div>}

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="text-sm text-gray-400 mb-2 block">Email</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              autoComplete="email"
              className="w-full bg-[#1a1a24] border border-[#2a2a3a] px-4 py-2.5 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-[#4f46e5] transition-colors rounded"
              placeholder="you@company.com"
              required
            />
          </div>
          <div>
            <label className="text-sm text-gray-400 mb-2 block">Password</label>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              autoComplete="current-password"
              className="w-full bg-[#1a1a24] border border-[#2a2a3a] px-4 py-2.5 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-[#4f46e5] transition-colors rounded"
              placeholder="••••••••"
              required
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="w-full px-4 py-2.5 bg-[#4f46e5] hover:bg-[#6366f1] disabled:opacity-60 text-white rounded transition-colors text-sm font-medium"
          >
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div className="mt-6 text-sm text-gray-400">
          No account?{' '}
          <Link to="/register" className="text-[#6366f1] hover:underline">
            Create one
          </Link>
        </div>
      </div>
    </div>
  );
}

