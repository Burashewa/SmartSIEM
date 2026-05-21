import { authFetch } from './auth';

export type ReportAiChatRole = 'user' | 'assistant';

export type ReportAiChatHistoryItem = {
  role: ReportAiChatRole;
  content: string;
};

export type ReportAiChatResponse = {
  answer: string;
  reportDate: string | null;
  hasReportContext: boolean;
  suggestedPrompts: string[];
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

export async function sendReportAiChatMessage(
  message: string,
  options?: {
    reportDate?: string;
    history?: ReportAiChatHistoryItem[];
  },
): Promise<ReportAiChatResponse> {
  const response = await authFetch('/api/reports/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      reportDate: options?.reportDate,
      history: options?.history,
    }),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `AI assistant failed (${response.status})`));
  }

  return response.json() as Promise<ReportAiChatResponse>;
}
