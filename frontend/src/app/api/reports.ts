import { authFetch } from './auth';

export type ReportAiInsights = {
  ai_executive_summary: string;
  admin_recommendations: string[];
  developer_recommendations: string[];
};

export type DailyReportListItem = {
  date: string;
  fileName: string;
  generatedAt: string | null;
  alertCount: number | null;
  hasAiInsights: boolean;
};

export type DailySecurityReportResponse = {
  filePath: string;
  reportDate: string;
  alertCount: number;
  markdown: string;
  aiInsights: ReportAiInsights | null;
};

export type DailyReportDetail = {
  date: string;
  fileName: string;
  markdown: string;
  alertCount: number | null;
  hasAiInsights: boolean;
};

async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const text = await response.text();
    if (!text) return fallback;
    const body = JSON.parse(text) as { message?: string | string[] };
    if (Array.isArray(body.message)) return body.message.join(' ');
    if (typeof body.message === 'string' && body.message.trim()) return body.message;
  } catch {
    // ignore
  }
  return fallback;
}

/** GET /api/reports/daily/list */
export async function listDailyReports(): Promise<DailyReportListItem[]> {
  const response = await authFetch('/api/reports/daily/list');
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Failed to load reports (${response.status})`));
  }
  const body = (await response.json()) as { reports: DailyReportListItem[] };
  return body.reports ?? [];
}

/** GET /api/reports/daily/:date */
export async function getDailyReport(date: string): Promise<DailyReportDetail> {
  const response = await authFetch(`/api/reports/daily/${encodeURIComponent(date)}`);
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Failed to load report (${response.status})`));
  }
  return response.json() as Promise<DailyReportDetail>;
}

/** POST /api/reports/daily — last 24h of alerts for the signed-in tenant. */
export async function generateDailySecurityReport(): Promise<DailySecurityReportResponse> {
  const response = await authFetch('/api/reports/daily', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Failed to generate report (${response.status})`));
  }
  return response.json() as Promise<DailySecurityReportResponse>;
}
