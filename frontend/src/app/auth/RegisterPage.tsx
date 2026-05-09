import type { FormEvent } from 'react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';

export function RegisterPage() {
  const { register } = useAuth();
  const nav = useNavigate();

  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await register(email, password, displayName || undefined);
      nav('/dashboard', { replace: true });
    } catch (e: any) {
      setErr(e?.message || 'Registration failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-[#0f0f17] border border-[#1f1f2e] rounded-lg p-6">
        <h1 className="text-2xl font-semibold mb-2">Create account</h1>
        <p className="text-sm text-gray-400 mb-6">Register to start managing your agents.</p>

        {err && <div className="mb-4 text-sm text-[#ef4444]">{err}</div>}

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="text-sm text-gray-400 mb-2 block">Display name (optional)</label>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              type="text"
              className="w-full bg-[#1a1a24] border border-[#2a2a3a] px-4 py-2.5 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-[#4f46e5] transition-colors rounded"
              placeholder="SOC Analyst"
            />
          </div>
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
              autoComplete="new-password"
              className="w-full bg-[#1a1a24] border border-[#2a2a3a] px-4 py-2.5 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-[#4f46e5] transition-colors rounded"
              placeholder="At least 8 characters"
              minLength={8}
              required
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="w-full px-4 py-2.5 bg-[#4f46e5] hover:bg-[#6366f1] disabled:opacity-60 text-white rounded transition-colors text-sm font-medium"
          >
            {busy ? 'Creating…' : 'Create account'}
          </button>
        </form>

        <div className="mt-6 text-sm text-gray-400">
          Already have an account?{' '}
          <Link to="/login" className="text-[#6366f1] hover:underline">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}

