import { authFetch } from './auth';

export type DailySecurityReportResponse = {
  filePath: string;
  alertCount: number;
  markdown: string;
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

/** POST /api/reports/daily — last 24h of alerts for the signed-in tenant, with recommendations in Markdown. */
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
