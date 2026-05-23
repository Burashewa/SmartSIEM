export {
  ANALYST_PAGE_IDS,
  ADMIN_PAGE_IDS,
  APP_PAGE_IDS,
  canRoleAccessPage,
  homePathForRole,
  isAppPath,
  pathnameToPageId,
  type AnalystPageId,
  type AdminPageId,
  type AppPageId,
} from './roleAccess';

export const ROUTES = {
  landing: '/',
  login: '/login',
  docs: '/docs',
  dashboard: '/dashboard',
  admin: '/admin',
} as const;

export function pageIdToPath(pageId: string): string {
  return `/${pageId}`;
}
