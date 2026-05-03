import { Injectable } from '@nestjs/common';
import { AlertResponse, AlertsService } from '../alerts/alerts.service';
import { AuthJwtPayload } from '../auth/auth.types';
import { RecommendationsService } from '../recommendations/recommendations.service';

interface ChatRequest {
  message?: string;
  alertId?: string;
}

interface AlertSummary {
  id: string;
  title: string;
  severity: string;
  status: string;
  sourceIp: string;
  triggeredAt: string;
}

interface ChatResponse {
  answer: string;
  matchedAlert?: AlertSummary;
  recommendations: string[];
  suggestedPrompts: string[];
}

@Injectable()
export class AlertAssistantService {
  constructor(
    private readonly alertsService: AlertsService,
    private readonly recommendationsService: RecommendationsService,
  ) {}

  async chat(user: AuthJwtPayload, request: ChatRequest): Promise<ChatResponse> {
    const alerts = await this.alertsService.list(user);
    const message = (request.message ?? '').trim();
    const matchedAlert = this.pickAlert(alerts, message, request.alertId);

    if (!matchedAlert) {
      return {
        answer:
          'I could not find an alert to analyze yet. Ingest logs or open the Alerts page, then ask me about a specific alert, source IP, severity, or rule name.',
        recommendations: [],
        suggestedPrompts: [
          'Which alert should I handle first?',
          'Show me critical alert recommendations',
          'How should I triage open alerts?',
        ],
      };
    }

    const recommendations = this.getRecommendations(matchedAlert);
    const summary = this.summarizeAlert(matchedAlert);
    const intent = this.detectIntent(message);
    const answer = this.buildAnswer(summary, recommendations, intent);

    return {
      answer,
      matchedAlert: summary,
      recommendations,
      suggestedPrompts: this.buildSuggestedPrompts(summary),
    };
  }

  private pickAlert(alerts: AlertResponse[], message: string, alertId?: string): AlertResponse | undefined {
    if (alerts.length === 0) return undefined;
    const normalizedMessage = message.toLowerCase();

    if (alertId) {
      const byId = alerts.find((alert) => this.getAlertId(alert) === alertId);
      if (byId) return byId;
    }

    const byText = alerts.find((alert) => {
      const id = this.getAlertId(alert).toLowerCase();
      const ruleId = (alert.ruleId ?? '').toLowerCase();
      const ip = (alert.ip ?? '').toLowerCase();
      return (
        (id && normalizedMessage.includes(id)) ||
        (ruleId && normalizedMessage.includes(ruleId)) ||
        (ip && normalizedMessage.includes(ip))
      );
    });
    if (byText) return byText;

    const severity = ['critical', 'high', 'medium', 'low'].find((item) =>
      normalizedMessage.includes(item),
    );
    if (severity) {
      const bySeverity = alerts.find(
        (alert) => alert.severity?.toLowerCase() === severity && alert.status !== 'resolved',
      );
      if (bySeverity) return bySeverity;
    }

    return [...alerts].sort((left, right) => {
      const severityDelta = this.severityScore(right.severity) - this.severityScore(left.severity);
      if (severityDelta !== 0) return severityDelta;
      return this.readTime(right.triggeredAt) - this.readTime(left.triggeredAt);
    })[0];
  }

  private getRecommendations(alert: AlertResponse): string[] {
    const generated = this.recommendationsService.getRecommendations({
      ruleId: alert.ruleId ?? 'unknown-rule',
      severity: alert.severity,
      ip: alert.ip,
      context: alert.context,
    });

    if (generated.length > 0) return generated;

    return [
      'Validate the alert against raw logs and confirm whether the source activity is expected.',
      'Contain the source or affected asset if the behavior is active or repeated.',
      'Collect source IP, user, endpoint, timestamp, and rule context before closing the incident.',
      'Add a suppression or tuning rule only after confirming this is benign recurring behavior.',
    ];
  }

  private detectIntent(message: string): 'triage' | 'containment' | 'explain' | 'general' {
    const normalized = message.toLowerCase();
    if (/(triage|priority|first|urgent)/.test(normalized)) return 'triage';
    if (/(contain|block|isolate|respond|action|fix)/.test(normalized)) return 'containment';
    if (/(why|explain|meaning|what is|what does)/.test(normalized)) return 'explain';
    return 'general';
  }

  private buildAnswer(
    alert: AlertSummary,
    recommendations: string[],
    intent: 'triage' | 'containment' | 'explain' | 'general',
  ): string {
    const topActions = recommendations.slice(0, 4).map((item, index) => `${index + 1}. ${item}`);
    const header = `${alert.severity.toUpperCase()} alert: ${alert.title}`;
    const context = `Source ${alert.sourceIp}, status ${alert.status}, triggered ${alert.triggeredAt}.`;

    if (intent === 'explain') {
      return `${header}\n${context}\n\nThis alert indicates behavior matching the ${alert.title} detection rule. Treat it as suspicious until the raw logs prove it is expected activity.\n\nRecommended checks:\n${topActions.join('\n')}`;
    }

    if (intent === 'containment') {
      return `${header}\n${context}\n\nRecommended response:\n${topActions.join('\n')}\n\nAfter containment, document the evidence and update the alert status.`;
    }

    if (intent === 'triage') {
      return `${header}\n${context}\n\nTriage priority: ${this.priorityLabel(alert.severity)}. Start with evidence validation, then decide whether to contain the source or tune the rule.\n\nNext steps:\n${topActions.join('\n')}`;
    }

    return `${header}\n${context}\n\nHere is what I recommend:\n${topActions.join('\n')}`;
  }

  private summarizeAlert(alert: AlertResponse): AlertSummary {
    const ruleId = alert.ruleId ?? 'unknown-rule';
    return {
      id: this.getAlertId(alert),
      title: this.humanizeRule(ruleId),
      severity: alert.severity ?? 'low',
      status: alert.status ?? 'open',
      sourceIp: alert.ip ?? 'Unknown',
      triggeredAt: new Date(alert.triggeredAt ?? Date.now()).toISOString(),
    };
  }

  private buildSuggestedPrompts(alert: AlertSummary): string[] {
    return [
      `How do I contain ${alert.title}?`,
      `Explain alert ${alert.id}`,
      `What should I check for source ${alert.sourceIp}?`,
    ];
  }

  private priorityLabel(severity: string): string {
    switch (severity.toLowerCase()) {
      case 'critical':
        return 'immediate';
      case 'high':
        return 'high';
      case 'medium':
        return 'normal';
      default:
        return 'low';
    }
  }

  private severityScore(severity: string | undefined): number {
    switch (severity?.toLowerCase()) {
      case 'critical':
        return 4;
      case 'high':
        return 3;
      case 'medium':
        return 2;
      case 'low':
        return 1;
      default:
        return 0;
    }
  }

  private humanizeRule(ruleId: string): string {
    return ruleId
      .replace(/[-_]+/g, ' ')
      .split(' ')
      .filter(Boolean)
      .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
      .join(' ');
  }

  private readTime(value: unknown): number {
    const time = new Date(value instanceof Date || typeof value === 'string' ? value : 0).getTime();
    return Number.isFinite(time) ? time : 0;
  }

  private getAlertId(alert: AlertResponse): string {
    return String(alert._id ?? alert.id ?? 'unknown-alert');
  }
}
