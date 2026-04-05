import { Recommendation } from '../interfaces/recommendation.interface';
import { RULE_ID_UNAUTHORIZED_ENDPOINT } from '../../rules/rules.constants';

export const unauthorizedEndpointRecommendation: Recommendation = {
  id: 'UNAUTHORIZED_ENDPOINT_RECOMMENDATION',
  ruleId: RULE_ID_UNAUTHORIZED_ENDPOINT,
  severity: 'medium',
  generate: () => [
    'Review RBAC policies for the affected endpoint',
    'Audit the user\'s token to verify expiration and claims',
    'Determine if the user was attempting privilege escalation',
    'Return a generic 403 Forbidden without leaking resource existence',
  ],
};
