import { useState, type FormEvent } from 'react';
import type { SiemRole } from '../api/auth';

interface LoginScreenProps {
  isLoading: boolean;
  error: string | null;
  onSubmit: (username: string, password: string) => Promise<void>;
  onRegister: (username: string, password: string, role: SiemRole) => Promise<void>;
}

export function LoginScreen({ isLoading, error, onSubmit, onRegister }: LoginScreenProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [registerRole, setRegisterRole] = useState<SiemRole>('security_analyst');
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLocalError(null);
    if (mode === 'register') {
      if (password !== confirmPassword) {
        setLocalError('Password confirmation does not match');
        return;
      }
      await onRegister(username, password, registerRole);
      await onSubmit(username, password);
      return;
    }
    await onSubmit(username, password);
  };

  return (
    <div className="h-screen w-screen bg-[#0a0a0f] flex items-center justify-center p-4 dark">
      <div className="w-full p-6 max-w-md bg-[#0f0f17] border border-[#1f1f2e] p-8 shadow-[0_10px_40px_rgba(0,0,0,0.6),0_0_20px_rgba(79,70,229,0.25)]">
        <h1 className="text-2xl text-white mb-2">SmartSIEM Sign In</h1>
        <p className="text-sm text-gray-400 mb-6">
          {mode === 'login'
            ? 'Sign in with your SIEM analyst account to access alerts, logs, and rule controls.'
            : 'Create a new SIEM account and choose role.'}
        </p>
        <div className="mb-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setMode('login')}
            className={`px-3 py-2 text-sm border ${
              mode === 'login'
                ? 'bg-[#4f46e5] border-[#4f46e5] text-white'
                : 'bg-[#1a1a24] border-[#2a2a3a] text-gray-300'
            }`}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => setMode('register')}
            className={`px-3 py-2 text-sm border ${
              mode === 'register'
                ? 'bg-[#4f46e5] border-[#4f46e5] text-white'
                : 'bg-[#1a1a24] border-[#2a2a3a] text-gray-300'
            }`}
          >
            Register
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-2">Username</label>
            <input
              type="text"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="w-full bg-[#1a1a24] border border-[#2a2a3a] px-3 py-2 text-white focus:outline-none focus:border-[#4f46e5]"
              autoComplete="username"
              required
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full bg-[#1a1a24] border border-[#2a2a3a] px-3 py-2 text-white focus:outline-none focus:border-[#4f46e5]"
              autoComplete="current-password"
              required
            />
            {mode === 'register' ? (
              <p className="text-xs text-gray-500 mt-1.5">
                Use at least 8 characters. If registration says the username exists, pick another
                name (the default &quot;admin&quot; is often already taken by the bootstrap account).
              </p>
            ) : null}
          </div>
          {mode === 'register' ? (
            <>
              <div>
                <label className="block text-sm text-gray-400 mb-2">Confirm Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className="w-full bg-[#1a1a24] border border-[#2a2a3a] px-3 py-2 text-white focus:outline-none focus:border-[#4f46e5]"
                  autoComplete="new-password"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">Role</label>
                <select
                  value={registerRole}
                  onChange={(event) => setRegisterRole(event.target.value as SiemRole)}
                  className="w-full bg-[#1a1a24] border border-[#2a2a3a] px-3 py-2 text-white focus:outline-none focus:border-[#4f46e5]"
                >
                  <option value="security_analyst">Security Analyst</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </>
          ) : null}
          {localError || error ? (
            <div className="text-sm text-[#fca5a5] border border-[#7f1d1d] bg-[#2b1115] px-3 py-2">
              {localError ?? error}
            </div>
          ) : null}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-[#4f46e5] hover:bg-[#4338ca] disabled:opacity-50 disabled:cursor-not-allowed text-white py-2.5"
          >
            {isLoading ? (mode === 'login' ? 'Signing in...' : 'Creating account...') : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>
      </div>
    </div>
  );
}
