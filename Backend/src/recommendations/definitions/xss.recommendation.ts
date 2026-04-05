import { Recommendation } from '../interfaces/recommendation.interface';
import { RULE_ID_XSS } from '../../rules/rules.constants';

export const xssRecommendation: Recommendation = {
  id: 'XSS_RECOMMENDATION',
  ruleId: RULE_ID_XSS,
  severity: 'high',
  generate: () => [
    'Ensure strict Content Security Policy (CSP) headers are active',
    'Verify input sanitization on the vulnerable endpoint',
    'Block the source IP if attacks persist',
    'Check application logs to confirm if the XSS payload was stored or reflected',
  ],
};
