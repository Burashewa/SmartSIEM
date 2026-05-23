import { Recommendation } from '../interfaces/recommendation.interface';
import { RULE_ID_SQL_INJECTION } from '../../rules/rules.constants';

export const sqlInjectionRecommendation: Recommendation = {
  id: 'SQL_INJECTION_RECOMMENDATION',
  ruleId: RULE_ID_SQL_INJECTION,
  severity: 'critical',
  generate: () => [
    'Block the offending IP address',
    'Review web application firewall rules',
    'Sanitize and parameterize database queries',
    'Inspect affected endpoints for injection payloads',
  ],
};
