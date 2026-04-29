export const SIEM_ROLES = ['security_analyst', 'admin'] as const;

export type SiemRole = (typeof SIEM_ROLES)[number];

/** Map pre-migration or unknown roles to the current two-role model. */
export function normalizeLegacyRole(role: string | undefined): SiemRole {
  if (role === 'admin' || role === 'security_analyst') return role;
  return 'security_analyst';
}

export interface AuthJwtPayload {
  sub: string;
  username: string;
  role: SiemRole;
  sid: string;
  type: 'access' | 'refresh';
}
