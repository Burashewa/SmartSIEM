import { Recommendation } from '../interfaces/recommendation.interface';
import { RULE_ID_FAILED_LOGINS } from '../../rules/rules.constants';

export const bruteForceRecommendation: Recommendation = {
  id: 'BRUTE_FORCE_RECOMMENDATION',
  ruleId: RULE_ID_FAILED_LOGINS,
  severity: 'high',
  generate: () => [
    'Temporarily lock the user account',
    'Block the source IP address',
    'Enable CAPTCHA on login',
    'Monitor further login attempts',
  ],
};
