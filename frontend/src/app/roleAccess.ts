import type { SiemRole } from './api/auth';

/** SOC operations — security analysts only. */
export const ANALYST_PAGE_IDS = [
  'dashboard',
  'logs',
  'alerts-and-threats',
  'threat-intelligence',
  'detection-rules',
  'ai-recommendations',
  'investigations',
  'reports',
  'settings',
] as const;

/** Platform governance — administrators only. */
export const ADMIN_PAGE_IDS = ['admin'] as const;

export type AnalystPageId = (typeof ANALYST_PAGE_IDS)[number];
export type AdminPageId = (typeof ADMIN_PAGE_IDS)[number];
export type AppPageId = AnalystPageId | AdminPageId;

export const APP_PAGE_IDS = [...ANALYST_PAGE_IDS, ...ADMIN_PAGE_IDS] as const;

const PAGE_ROLES: Record<AppPageId, readonly SiemRole[]> = {
  dashboard: ['security_analyst'],
  logs: ['security_analyst'],
  'alerts-and-threats': ['security_analyst'],
  'threat-intelligence': ['security_analyst'],
  'detection-rules': ['security_analyst'],
  'ai-recommendations': ['security_analyst'],
  investigations: ['security_analyst'],
  reports: ['security_analyst'],
  settings: ['security_analyst'],
  admin: ['admin'],
};

export function homePathForRole(role: SiemRole): string {
  return role === 'admin' ? '/admin' : '/dashboard';
}

export function canRoleAccessPage(role: SiemRole, pageId: string): boolean {
  const allowed = PAGE_ROLES[pageId as AppPageId];
  return Boolean(allowed?.includes(role));
}

export function pathnameToPageId(pathname: string, role: SiemRole): AppPageId {
  const segment = pathname.replace(/^\/+/, '').split('/')[0] || '';
  if ((APP_PAGE_IDS as readonly string[]).includes(segment) && canRoleAccessPage(role, segment)) {
    return segment as AppPageId;
  }
  return role === 'admin' ? 'admin' : 'dashboard';
}

export function isAppPath(pathname: string, role: SiemRole): boolean {
  const segment = pathname.replace(/^\/+/, '').split('/')[0];
  return canRoleAccessPage(role, segment);
}
