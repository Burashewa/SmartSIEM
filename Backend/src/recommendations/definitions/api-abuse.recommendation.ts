import { Recommendation } from '../interfaces/recommendation.interface';
import { RULE_ID_API_RATE_LIMIT } from '../../rules/rules.constants';

export const apiAbuseRecommendation: Recommendation = {
  id: 'API_ABUSE_RECOMMENDATION',
  ruleId: RULE_ID_API_RATE_LIMIT,
  severity: 'medium',
  generate: () => [
    'Throttle or block abusive clients',
    'Review API authentication and rate-limit policies',
    'Monitor for spikes in request volume',
    'Audit exposed endpoints for misuse',
  ],
};
