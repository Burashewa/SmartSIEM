import { type FormEvent, useState } from 'react';
import { useAuthStore } from '../../store/authStore';

interface LoginPageProps {
  onSuccess: () => void;
}

export function LoginPage({ onSuccess }: LoginPageProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const login = useAuthStore((state) => state.login);
  const loading = useAuthStore((state) => state.isLoading);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    try {
      await login(username, password);
      onSuccess();
    } catch {
      setError('Login failed. Check credentials.');
    }
  };

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-[#0a0a0f] dark">
      <form onSubmit={submit} className="w-full max-w-md bg-[#0f0f17] border border-[#1f1f2e] p-8 space-y-4">
        <h1 className="text-2xl text-white font-medium">SmartSIEM Login</h1>
        <p className="text-sm text-gray-400">Use backend admin credentials to continue.</p>
        <input
          className="w-full bg-[#1a1a24] border border-[#2a2a3a] px-3 py-2 text-sm text-white"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Username"
        />
        <input
          type="password"
          className="w-full bg-[#1a1a24] border border-[#2a2a3a] px-3 py-2 text-sm text-white"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
        />
        {error ? <p className="text-sm text-[#ef4444]">{error}</p> : null}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[#4f46e5] hover:bg-[#4338ca] text-white py-2 text-sm disabled:opacity-70"
        >
          {loading ? 'Signing in...' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
