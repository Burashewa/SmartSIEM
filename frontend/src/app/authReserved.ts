export const RESERVED_ADMIN_USERNAME = 'admin';

export function isReservedUsername(username: string): boolean {
  return username.trim().toLowerCase() === RESERVED_ADMIN_USERNAME;
}
