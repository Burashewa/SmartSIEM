export const ENDPOINTS = {
  auth: {
    login: '/api/v1/auth/login',
    refresh: '/api/v1/auth/refresh',
    me: '/api/v1/auth/me',
    logout: '/api/v1/auth/logout',
  },
  collector: {
    ingest: '/api/v1/collector/ingest',
  },
  logs: '/api/v1/logs',
  alerts: '/api/v1/alerts',
  incidents: '/api/v1/incidents',
  users: '/api/v1/users',
  rules: '/api/v1/rules',
  reports: '/api/v1/reports',
  settings: '/api/v1/settings',
  agents: '/api/v1/agents',
  dashboard: {
    kpis: '/api/v1/dashboard/kpis',
    chartLogs: '/api/v1/dashboard/chart/logs',
    chartAlerts: '/api/v1/dashboard/chart/alerts',
    geo: '/api/v1/dashboard/geo',
    topSources: '/api/v1/dashboard/top-sources',
  },
  analytics: {
    eventsBySource: '/api/v1/analytics/events/by-source',
    alertsByRule: '/api/v1/analytics/alerts/by-rule',
  },
  ws: '/ws/stream',
} as const;
