export const BOOTSTRAP_ADMIN_USERNAME = 'admin';
export const BOOTSTRAP_ADMIN_PASSWORD_DEFAULT = 'Admin@pass1';

/** Usernames that cannot be used for self-registration. */
export const RESERVED_USERNAMES = [BOOTSTRAP_ADMIN_USERNAME] as const;

export function isReservedUsername(username: string): boolean {
  const normalized = username.trim().toLowerCase();
  return RESERVED_USERNAMES.some((reserved) => reserved === normalized);
}
