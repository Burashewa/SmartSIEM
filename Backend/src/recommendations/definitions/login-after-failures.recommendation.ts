import { Recommendation } from '../interfaces/recommendation.interface';
import { RULE_ID_LOGIN_AFTER_FAILURES } from '../../rules/rules.constants';

export const loginAfterFailuresRecommendation: Recommendation = {
  id: 'LOGIN_AFTER_FAILURES_RECOMMENDATION',
  ruleId: RULE_ID_LOGIN_AFTER_FAILURES,
  severity: 'high',
  generate: () => [
    'Force a password reset for this user immediately',
    'Review recent actions performed by the user',
    'Check if MFA is enabled for this account and enforce it if not',
    'Isolate the user\'s active session for monitoring',
  ],
};
