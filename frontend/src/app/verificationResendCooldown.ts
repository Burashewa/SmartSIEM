const STORAGE_KEY = 'smartsiem.verifyResendUntil';
export const VERIFICATION_RESEND_COOLDOWN_SEC = 60;

export function getVerificationResendCooldownRemaining(): number {
  if (typeof window === 'undefined') return 0;
  const until = Number(window.localStorage.getItem(STORAGE_KEY) ?? 0);
  return Math.max(0, Math.ceil((until - Date.now()) / 1000));
}

export function startVerificationResendCooldown(
  seconds = VERIFICATION_RESEND_COOLDOWN_SEC,
): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, String(Date.now() + seconds * 1000));
}

export function syncVerificationResendCooldown(retryAfterSec?: number): void {
  const remaining = getVerificationResendCooldownRemaining();
  const next = retryAfterSec ?? VERIFICATION_RESEND_COOLDOWN_SEC;
  if (remaining <= 0) {
    startVerificationResendCooldown(next);
  }
}
