export type RecommendationSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface AlertLike {
  ruleId: string;
  severity?: string;
  ip?: string;
  context?: Record<string, unknown>;
}

export interface Recommendation {
  id: string;
  ruleId: string;
  severity: RecommendationSeverity;
  generate: (alert: AlertLike) => string[];
}
