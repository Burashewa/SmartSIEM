import { authFetch } from './auth';

export interface AlertAssistantSummary {
  id: string;
  title: string;
  severity: string;
  status: string;
  sourceIp: string;
  triggeredAt: string;
}

export interface AlertAssistantResponse {
  answer: string;
  matchedAlert?: AlertAssistantSummary;
  recommendations: string[];
  suggestedPrompts: string[];
}

export async function sendAlertAssistantMessage(
  message: string,
  alertId?: string,
): Promise<AlertAssistantResponse> {
  const response = await authFetch('/api/alert-assistant/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, alertId }),
  });

  if (!response.ok) {
    throw new Error(`Alert assistant failed (${response.status})`);
  }

  return response.json() as Promise<AlertAssistantResponse>;
}
