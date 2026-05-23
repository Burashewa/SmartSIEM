/** Sidebar page id ↔ URL path (always `/${id}`). */
export const APP_PAGE_IDS = [
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

export type AppPageId = (typeof APP_PAGE_IDS)[number];

export const ROUTES = {
  landing: '/',
  login: '/login',
  docs: '/docs',
  dashboard: '/dashboard',
} as const;

export function pageIdToPath(pageId: string): string {
  return `/${pageId}`;
}

export function pathnameToPageId(pathname: string): AppPageId {
  const segment = pathname.replace(/^\/+/, '').split('/')[0] || 'dashboard';
  if ((APP_PAGE_IDS as readonly string[]).includes(segment)) {
    return segment as AppPageId;
  }
  return 'dashboard';
}

export function isAppPath(pathname: string): boolean {
  const segment = pathname.replace(/^\/+/, '').split('/')[0];
  return (APP_PAGE_IDS as readonly string[]).includes(segment);
}
