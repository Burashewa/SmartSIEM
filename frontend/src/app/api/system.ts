export interface SystemStatusResponse {
  generatedAt: string;
  ingestionRate: {
    eps: number;
    windowSeconds: number;
    logsLastMinute: number;
  };
  database: {
    connected: boolean;
    state: 'disconnected' | 'connected' | 'connecting' | 'disconnecting';
    provider: string;
  };
  systemStatus: {
    status: 'healthy' | 'critical';
    activeAlerts: number;
    criticalThreats: number;
  };
}

export async function fetchSystemStatus(): Promise<SystemStatusResponse> {
  const response = await fetch('/api/system/status');

  if (!response.ok) {
    throw new Error(`Failed to load system status (${response.status})`);
  }

  return response.json() as Promise<SystemStatusResponse>;
}
