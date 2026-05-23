import { useEffect, useState, type FormEvent } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import {
  Shield,
  Lock,
  User,
  Mail,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
  Eye,
  EyeOff,
} from 'lucide-react';
import type { SiemRole } from '../api/auth';
import { requestPasswordReset, resetPassword } from '../api/auth';
import './login-screen.css';

type AuthMode = 'login' | 'register' | 'forgot' | 'reset';

interface LoginScreenProps {
  isLoading: boolean;
  error: string | null;
  onSubmit: (username: string, password: string) => Promise<void>;
  onRegister: (username: string, password: string, role: SiemRole, email?: string) => Promise<void>;
  onGoogleLogin?: (credential: string) => Promise<void>;
  googleEnabled?: boolean;
}

export function LoginScreen({
  isLoading,
  error,
  onSubmit,
  onRegister,
  onGoogleLogin,
  googleEnabled = false,
}: LoginScreenProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [registerRole, setRegisterRole] = useState<SiemRole>('security_analyst');
  const [resetToken, setResetToken] = useState('');
  const [mode, setMode] = useState<AuthMode>('login');
  const [localError, setLocalError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [devResetUrl, setDevResetUrl] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [identifier, setIdentifier] = useState('');
  const [email, setEmail] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('resetToken')?.trim();
    if (token) {
      setResetToken(token);
      setMode('reset');
      setSuccessMessage(null);
      setLocalError(null);
    }
  }, []);

  const displayError = localError ?? error;

  const clearMessages = () => {
    setLocalError(null);
    setSuccessMessage(null);
    setDevResetUrl(null);
  };

  const switchMode = (next: AuthMode) => {
    clearMessages();
    setMode(next);
    if (next !== 'reset') {
      setResetToken('');
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    clearMessages();

    if (mode === 'forgot') {
      try {
        const result = await requestPasswordReset(identifier.trim());
        setSuccessMessage(
          result.emailSent
            ? 'Check your email for a password reset link. It may take a minute — also check spam.'
            : result.message,
        );
        setDevResetUrl(result.emailSent ? null : (result.devResetUrl ?? null));
      } catch (err) {
        setLocalError(err instanceof Error ? err.message : 'Could not request password reset');
      }
      return;
    }

    if (mode === 'reset') {
      if (password.length < 8) {
        setLocalError('Password must be at least 8 characters');
        return;
      }
      if (password !== confirmPassword) {
        setLocalError('Password confirmation does not match');
        return;
      }
      try {
        const result = await resetPassword(resetToken.trim(), password);
        setSuccessMessage(result.message);
        switchMode('login');
        setPassword('');
        setConfirmPassword('');
        window.history.replaceState({}, '', '/login');
      } catch (err) {
        setLocalError(err instanceof Error ? err.message : 'Could not reset password');
      }
      return;
    }

    if (mode === 'register') {
      if (password.length < 8) {
        setLocalError('Password must be at least 8 characters');
        return;
      }
      if (password !== confirmPassword) {
        setLocalError('Password confirmation does not match');
        return;
      }
      try {
        await onRegister(username, password, registerRole, email.trim() || undefined);
        await onSubmit(username, password);
      } catch {
        // parent sets error
      }
      return;
    }

    await onSubmit(username, password);
  };

  const titleByMode: Record<AuthMode, string> = {
    login: 'Welcome back',
    register: 'Create your account',
    forgot: 'Reset your password',
    reset: 'Choose a new password',
  };

  const subtitleByMode: Record<AuthMode, string> = {
    login: 'Sign in to monitor alerts, logs, and detection rules.',
    register: 'Join SmartSIEM with a username and secure password.',
    forgot: 'Enter your account email. We will send a reset link if the account exists.',
    reset: 'Enter the token from your reset link and a new password.',
  };

  const submitLabel =
    isLoading
      ? 'Please wait...'
      : mode === 'login'
        ? 'Sign in'
        : mode === 'register'
          ? 'Create account'
          : mode === 'forgot'
            ? 'Email reset link'
            : 'Update password';

  return (
    <div className="auth-page">
      <div className="auth-page__glow auth-page__glow--tl" aria-hidden />
      <div className="auth-page__glow auth-page__glow--br" aria-hidden />

      <div className="auth-shell">
        <aside className="auth-brand">
          <div>
            <div className="auth-brand__logo">
              <div className="auth-brand__icon">
                <Shield size={28} strokeWidth={1.75} />
              </div>
              <div>
                <h1 className="auth-brand__title">SmartSIEM</h1>
                <p className="auth-brand__tagline">Security operations platform</p>
              </div>
            </div>
            <p className="auth-brand__lead">
              Unified visibility for logs, alerts, investigations, and AI-assisted response.
            </p>
          </div>
          <ul className="auth-brand__list">
            <li>Real-time detection and alerting</li>
            <li>Analyst workflows and case management</li>
            <li>Google sign-in and secure password recovery</li>
          </ul>
        </aside>

        <div className="auth-panel">
          <div className="auth-panel__mobile-logo">
            <Shield size={28} strokeWidth={1.75} />
            <span>SmartSIEM</span>
          </div>

          <h2 className="auth-heading">{titleByMode[mode]}</h2>
          <p className="auth-subheading">{subtitleByMode[mode]}</p>

          {mode === 'login' || mode === 'register' ? (
            <div className="auth-tabs">
              <button
                type="button"
                className={`auth-tab ${mode === 'login' ? 'auth-tab--active' : ''}`}
                onClick={() => switchMode('login')}
              >
                Sign in
              </button>
              <button
                type="button"
                className={`auth-tab ${mode === 'register' ? 'auth-tab--active' : ''}`}
                onClick={() => switchMode('register')}
              >
                Register
              </button>
            </div>
          ) : (
            <button type="button" className="auth-back" onClick={() => switchMode('login')}>
              <ArrowLeft size={16} />
              Back to sign in
            </button>
          )}

          {displayError ? (
            <div className="auth-alert auth-alert--error" role="alert">
              <AlertCircle size={20} style={{ flexShrink: 0, marginTop: 2 }} />
              <span>{displayError}</span>
            </div>
          ) : null}

          {successMessage ? (
            <div className="auth-alert auth-alert--success" role="status">
              <CheckCircle2 size={20} style={{ flexShrink: 0, marginTop: 2 }} />
              <span>{successMessage}</span>
            </div>
          ) : null}

          {devResetUrl ? (
            <div className="auth-alert auth-alert--warn">
              <p style={{ margin: '0 0 0.35rem', fontWeight: 600 }}>Development reset link</p>
              <a href={devResetUrl}>{devResetUrl}</a>
            </div>
          ) : null}

          <form className="auth-form" onSubmit={handleSubmit}>
            {mode === 'forgot' ? (
              <div className="auth-field">
                <label htmlFor="auth-email">Email address</label>
                <div className="auth-input-wrap">
                  <Mail />
                  <input
                    id="auth-email"
                    type="email"
                    className="auth-input"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="you@company.com"
                    autoComplete="email"
                    required
                  />
                </div>
              </div>
            ) : null}

            {mode === 'reset' ? (
              <div className="auth-field">
                <label htmlFor="auth-token">Reset token</label>
                <input
                  id="auth-token"
                  type="text"
                  className="auth-input auth-input--plain"
                  value={resetToken}
                  onChange={(e) => setResetToken(e.target.value)}
                  placeholder="Paste token from reset link"
                  required
                />
              </div>
            ) : null}

            {mode === 'login' || mode === 'register' ? (
              <div className="auth-field">
                <label htmlFor="auth-username">Username</label>
                <div className="auth-input-wrap">
                  <User />
                  <input
                    id="auth-username"
                    type="text"
                    className="auth-input"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    autoComplete="username"
                    required
                  />
                </div>
              </div>
            ) : null}

            {mode !== 'forgot' ? (
              <div className="auth-field">
                <label htmlFor="auth-password">
                  {mode === 'reset' ? 'New password' : 'Password'}
                </label>
                <div className="auth-input-wrap">
                  <Lock />
                  <input
                    id="auth-password"
                    type={showPassword ? 'text' : 'password'}
                    className="auth-input auth-input--password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    required
                    minLength={8}
                  />
                  <button
                    type="button"
                    className="auth-toggle-pw"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {mode === 'register' ? (
                  <p className="auth-hint">
                    At least 8 characters. If the username exists, choose another.
                  </p>
                ) : null}
              </div>
            ) : null}

            {mode === 'register' ? (
              <div className="auth-field">
                <label htmlFor="auth-reg-email">
                  Email <span>(for password recovery)</span>
                </label>
                <div className="auth-input-wrap">
                  <Mail />
                  <input
                    id="auth-reg-email"
                    type="email"
                    className="auth-input"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    autoComplete="email"
                  />
                </div>
                <p className="auth-hint">Recommended so you can receive password reset emails.</p>
              </div>
            ) : null}

            {mode === 'register' || mode === 'reset' ? (
              <div className="auth-field">
                <label htmlFor="auth-confirm">Confirm password</label>
                <div className="auth-input-wrap">
                  <Lock />
                  <input
                    id="auth-confirm"
                    type={showPassword ? 'text' : 'password'}
                    className="auth-input"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                    required
                    minLength={8}
                  />
                </div>
              </div>
            ) : null}

            {mode === 'register' ? (
              <div className="auth-field">
                <label htmlFor="auth-role">Role</label>
                <select
                  id="auth-role"
                  className="auth-input auth-input--plain auth-select"
                  value={registerRole}
                  onChange={(e) => setRegisterRole(e.target.value as SiemRole)}
                >
                  <option value="security_analyst">Security Analyst</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            ) : null}

            {mode === 'login' ? (
              <div className="auth-row-end">
                <button type="button" className="auth-link" onClick={() => switchMode('forgot')}>
                  Forgot password?
                </button>
              </div>
            ) : null}

            <button type="submit" className="auth-submit" disabled={isLoading}>
              {submitLabel}
            </button>
          </form>

          {googleEnabled && onGoogleLogin && (mode === 'login' || mode === 'register') ? (
            <>
              <div className="auth-divider">or continue with</div>
              <div className="auth-google-wrap">
                <GoogleLogin
                  onSuccess={async (response) => {
                    clearMessages();
                    if (!response.credential) {
                      setLocalError('Google did not return a sign-in token');
                      return;
                    }
                    try {
                      await onGoogleLogin(response.credential);
                    } catch (err) {
                      setLocalError(
                        err instanceof Error ? err.message : 'Google sign-in failed',
                      );
                    }
                  }}
                  onError={() => setLocalError('Google sign-in was cancelled or failed')}
                  theme="filled_black"
                  size="large"
                  text={mode === 'register' ? 'signup_with' : 'signin_with'}
                  shape="rectangular"
                />
              </div>
            </>
          ) : null}

          {!googleEnabled && (mode === 'login' || mode === 'register') ? (
            <p className="auth-google-hint">
              Google sign-in: set <code>VITE_GOOGLE_CLIENT_ID</code> in .env
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
