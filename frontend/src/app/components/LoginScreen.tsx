import { useEffect, useMemo, useState, type FormEvent } from 'react';
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
import {
  requestPasswordReset,
  resetPassword,
  verifyEmail,
  resendVerificationEmail,
  getVerificationStatus,
  ResendVerificationError,
} from '../api/auth';
import {
  getVerificationResendCooldownRemaining,
  startVerificationResendCooldown,
  syncVerificationResendCooldown,
} from '../verificationResendCooldown';
import { isReservedUsername } from '../authReserved';
import { evaluatePassword } from '../passwordPolicy';
import { PasswordStrengthPanel } from './PasswordStrengthPanel';
import './login-screen.css';

type AuthMode =
  | 'login'
  | 'register'
  | 'forgot'
  | 'reset'
  | 'verify-pending'
  | 'resend-verification';

interface LoginScreenProps {
  isLoading: boolean;
  error: string | null;
  onSubmit: (username: string, password: string) => Promise<void>;
  onRegister: (
    username: string,
    password: string,
    email: string,
  ) => Promise<{ message: string; verificationEmailSent?: boolean }>;
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
  const [resetId, setResetId] = useState('');
  const [resetFromLink, setResetFromLink] = useState(false);
  const [mode, setMode] = useState<AuthMode>('login');
  const [localError, setLocalError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [identifier, setIdentifier] = useState('');
  const [email, setEmail] = useState('');
  const [pendingEmail, setPendingEmail] = useState('');
  const [pendingUsername, setPendingUsername] = useState('');
  const [verifyingEmail, setVerifyingEmail] = useState(false);
  const [checkingVerification, setCheckingVerification] = useState(false);
  const [resendCooldownSec, setResendCooldownSec] = useState(() =>
    getVerificationResendCooldownRemaining(),
  );
  const [resendingVerification, setResendingVerification] = useState(false);

  const passwordValidation = useMemo(() => evaluatePassword(password), [password]);
  const passwordPolicyMet = passwordValidation.valid;
  const confirmPasswordMatches =
    password === confirmPassword && confirmPassword.length > 0;
  const requiresStrongPassword = mode === 'register' || mode === 'reset';
  const usernameReservedForRegister =
    mode === 'register' && isReservedUsername(username);
  const canSubmitNewPassword =
    !requiresStrongPassword ||
    (passwordPolicyMet && confirmPasswordMatches && !usernameReservedForRegister);

  useEffect(() => {
    const tick = () => setResendCooldownSec(getVerificationResendCooldownRemaining());
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const verifyId = params.get('verify')?.trim();
    if (verifyId) {
      setVerifyingEmail(true);
      setMode('login');
      setSuccessMessage(null);
      setLocalError(null);
      verifyEmail(verifyId)
        .then((result) => {
          setSuccessMessage(result.message);
          window.history.replaceState({}, '', '/login');
        })
        .catch((err) => {
          setLocalError(err instanceof Error ? err.message : 'Email verification failed');
          window.history.replaceState({}, '', '/login');
        })
        .finally(() => setVerifyingEmail(false));
      return;
    }

    const id = params.get('reset')?.trim() ?? params.get('resetToken')?.trim();
    if (id) {
      setResetId(id);
      setResetFromLink(true);
      setMode('reset');
      setSuccessMessage(null);
      setLocalError(null);
    }
  }, []);

  const displayError = localError ?? error;

  const clearMessages = () => {
    setLocalError(null);
    setSuccessMessage(null);
  };

  const switchMode = (next: AuthMode) => {
    if (mode === 'verify-pending' && (next === 'login' || next === 'register')) {
      setLocalError('Verify your email first. Open the link we sent, then use "I verified my email".');
      return;
    }
    clearMessages();
    setMode(next);
    if (next !== 'reset') {
      setResetId('');
      setResetFromLink(false);
    }
  };

  const handleResendVerification = async (targetIdentifier: string) => {
    const id = targetIdentifier.trim();
    if (!id) {
      setLocalError('Enter your account email or username');
      return;
    }
    if (resendCooldownSec > 0) {
      return;
    }
    setResendingVerification(true);
    clearMessages();
    try {
      const result = await resendVerificationEmail(id);
      syncVerificationResendCooldown(result.retryAfterSec);
      setResendCooldownSec(getVerificationResendCooldownRemaining());
      setSuccessMessage(
        'If an unverified account exists for that address, a new verification link has been sent.',
      );
    } catch (err) {
      if (err instanceof ResendVerificationError) {
        startVerificationResendCooldown(err.retryAfterSec);
        setResendCooldownSec(getVerificationResendCooldownRemaining());
        setLocalError(err.message);
      } else {
        setLocalError(err instanceof Error ? err.message : 'Could not resend verification email');
      }
    } finally {
      setResendingVerification(false);
    }
  };

  const handleCheckVerification = async () => {
    const identifier = pendingEmail || pendingUsername;
    if (!identifier.trim()) {
      setLocalError('Missing account info. Register again or contact support.');
      return;
    }
    setCheckingVerification(true);
    clearMessages();
    try {
      const status = await getVerificationStatus(identifier.trim());
      if (!status.found) {
        setLocalError('Account not found. Check the email you registered with.');
        return;
      }
      if (!status.verified) {
        setLocalError(
          'Email not verified yet. Open the link in your inbox (check spam), or resend verification.',
        );
        return;
      }
      setSuccessMessage('Email verified! You can sign in now.');
      if (status.username) {
        setUsername(status.username);
      }
      setMode('login');
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Could not check verification status');
    } finally {
      setCheckingVerification(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    clearMessages();

    if (mode === 'forgot') {
      try {
        const result = await requestPasswordReset(identifier.trim());
        setSuccessMessage(
          result.message ||
            'If an account exists for that address, password reset instructions have been sent. Check your inbox and spam folder.',
        );
      } catch (err) {
        setLocalError(err instanceof Error ? err.message : 'Could not request password reset');
      }
      return;
    }

    if (mode === 'reset') {
      if (!resetId.trim()) {
        setLocalError('Reset link is invalid or expired. Request a new password reset email.');
        return;
      }
      if (!passwordPolicyMet) {
        setLocalError(passwordValidation.errors.join('. '));
        return;
      }
      if (password !== confirmPassword) {
        setLocalError('Password confirmation does not match');
        return;
      }
      try {
        const result = await resetPassword(resetId.trim(), password);
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

    if (mode === 'resend-verification') {
      await handleResendVerification(identifier);
      return;
    }

    if (mode === 'register') {
      const trimmedEmail = email.trim();
      if (isReservedUsername(username)) {
        setLocalError(
          'The username "admin" is reserved. Admin accounts cannot be created via registration.',
        );
        return;
      }
      if (!trimmedEmail) {
        setLocalError('Email is required to register as a security analyst');
        return;
      }
      if (!passwordPolicyMet) {
        setLocalError(passwordValidation.errors.join('. '));
        return;
      }
      if (password !== confirmPassword) {
        setLocalError('Password confirmation does not match');
        return;
      }
      try {
        const result = await onRegister(username, password, trimmedEmail);
        setPendingEmail(trimmedEmail);
        setPendingUsername(username.trim().toLowerCase());
        setIdentifier(trimmedEmail);
        setSuccessMessage(result.message);
        if (result.verificationEmailSent) {
          startVerificationResendCooldown();
          setResendCooldownSec(getVerificationResendCooldownRemaining());
        }
        setMode('verify-pending');
        setPassword('');
        setConfirmPassword('');
      } catch (err) {
        setLocalError(err instanceof Error ? err.message : 'Unable to register');
      }
      return;
    }

    await onSubmit(username, password);
  };

  const titleByMode: Record<AuthMode, string> = {
    login: 'Welcome back',
    register: 'Create your account',
    forgot: 'Reset your password',
    reset: resetFromLink
      ? 'Choose a new password for your account'
      : 'Choose a new password',
    'verify-pending': 'Verify your email',
    'resend-verification': 'Resend verification',
  };

  const subtitleByMode: Record<AuthMode, string> = {
    login: verifyingEmail
      ? 'Confirming your email address...'
      : 'Sign in to monitor alerts, logs, and detection rules.',
    register: 'Register as a security analyst. You must verify your email before signing in.',
    forgot: 'Enter your account email. We will send a reset link if the account exists.',
    reset: 'Enter the token from your reset link and a new password.',
    'verify-pending': `We sent a verification link to ${pendingEmail || 'your email'}. Open it, then click below — you cannot sign in until verified.`,
    'resend-verification':
      'Enter your email or username to receive a new verification link.',
  };

  const submitLabel =
    verifyingEmail
      ? 'Verifying...'
      : isLoading
        ? 'Please wait...'
        : mode === 'login'
          ? 'Sign in'
          : mode === 'register'
            ? 'Create account'
            : mode === 'forgot'
              ? 'Email reset link'
              : mode === 'resend-verification'
                ? resendCooldownSec > 0
                  ? `Resend in ${resendCooldownSec}s`
                  : 'Send verification email'
                : 'Update password';

  return (
    <div className="auth-page">
      <div className="auth-page__glow auth-page__glow--tl" aria-hidden />
      <div className="auth-page__glow auth-page__glow--br" aria-hidden />

      <div className="auth-shell">
        <aside className="auth-brand">
          <div>
            <div className="auth-brand__logo">
              {/* <div className="auth-brand__icon">
                <Shield size={28} strokeWidth={1.75} />
              </div> */}
              {/* <div>
                <h1 className="auth-brand__title">SmartSIEM</h1>
                <p className="auth-brand__tagline">Security operations platform</p>
              </div> */}
            </div>
            {/* <p className="auth-brand__lead">
              Unified visibility for logs, alerts, investigations, and AI-assisted response.
            </p> */}
          </div>
        </aside>

        <div className="auth-panel">
          <div className="auth-panel__mobile-logo">
            <Shield size={28} strokeWidth={1.75} />
            <span>SmartSIEM</span>
          </div>

          <h2 className="auth-heading">{titleByMode[mode]}</h2>
          <p className="auth-subheading">{subtitleByMode[mode]}</p>

          {mode === 'verify-pending' ? (
            <div className="auth-verify-pending">
              <button
                type="button"
                className="auth-submit"
                disabled={checkingVerification}
                onClick={() => void handleCheckVerification()}
              >
                {checkingVerification ? 'Checking...' : 'I verified my email'}
              </button>
              <button
                type="button"
                className="auth-link auth-link--block"
                disabled={resendCooldownSec > 0 || resendingVerification}
                onClick={() => void handleResendVerification(pendingEmail || pendingUsername)}
              >
                {resendingVerification
                  ? 'Sending...'
                  : resendCooldownSec > 0
                    ? `Resend verification in ${resendCooldownSec}s`
                    : 'Resend verification email'}
              </button>
            </div>
          ) : null}

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
          ) : mode !== 'verify-pending' ? (
            <button type="button" className="auth-back" onClick={() => switchMode('login')}>
              <ArrowLeft size={16} />
              Back to sign in
            </button>
          ) : null}

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

          {mode !== 'verify-pending' ? (
          <form className="auth-form" onSubmit={handleSubmit}>
            {mode === 'forgot' || mode === 'resend-verification' ? (
              <div className="auth-field">
                <label htmlFor="auth-email">
                  {mode === 'resend-verification' ? 'Email or username' : 'Email address'}
                </label>
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

            {mode === 'reset' && !resetFromLink ? (
              <div className="auth-field">
                <label htmlFor="auth-reset-id">Reset link code</label>
                <input
                  id="auth-reset-id"
                  type="text"
                  className="auth-input auth-input--plain"
                  value={resetId}
                  onChange={(e) => setResetId(e.target.value)}
                  placeholder="Paste the code from your reset email link"
                  required
                />
              </div>
            ) : null}

            {mode === 'reset' && resetFromLink ? (
              <p className="auth-hint">
                You opened a valid reset link. Enter a new password below. All existing sessions will be signed out.
              </p>
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
                {mode === 'register' && usernameReservedForRegister ? (
                  <p className="auth-hint auth-hint--warn">
                    The username &quot;admin&quot; is reserved. Register as a security analyst with a
                    different username.
                  </p>
                ) : null}
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
                {requiresStrongPassword ? (
                  <PasswordStrengthPanel password={password} />
                ) : null}
                {mode === 'register' ? (
                  <p className="auth-hint">
                    Choose a strong password. If the username exists, pick another.
                  </p>
                ) : null}
              </div>
            ) : null}

            {mode === 'register' ? (
              <div className="auth-field">
                <label htmlFor="auth-reg-email">Email address</label>
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
                    required
                  />
                </div>
                <p className="auth-hint">
                  Required. We will send a verification link — you must verify before signing in.
                </p>
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
                {mode === 'register' || mode === 'reset' ? (
                  <p
                    className={`auth-hint auth-hint--confirm ${
                      confirmPassword.length === 0
                        ? ''
                        : confirmPasswordMatches
                          ? 'auth-hint--ok'
                          : 'auth-hint--warn'
                    }`}
                  >
                    {confirmPassword.length === 0
                      ? 'Re-enter your password to confirm.'
                      : confirmPasswordMatches
                        ? 'Passwords match.'
                        : 'Passwords do not match.'}
                  </p>
                ) : null}
              </div>
            ) : null}

            {mode === 'login' ? (
              <div className="auth-row-end">
                <button type="button" className="auth-link" onClick={() => switchMode('forgot')}>
                  Forgot password?
                </button>
                <button
                  type="button"
                  className="auth-link"
                  onClick={() => switchMode('resend-verification')}
                >
                  Resend verification
                </button>
              </div>
            ) : null}

            <button
              type="submit"
              className="auth-submit"
              disabled={
                isLoading ||
                verifyingEmail ||
                resendingVerification ||
                (mode === 'resend-verification' && resendCooldownSec > 0) ||
                (requiresStrongPassword && !canSubmitNewPassword)
              }
            >
              {submitLabel}
            </button>
          </form>
          ) : null}

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
              
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
