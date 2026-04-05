import { Recommendation } from '../interfaces/recommendation.interface';
import { RULE_ID_CREDENTIAL_STUFFING } from '../../rules/rules.constants';

export const credentialStuffingRecommendation: Recommendation = {
  id: 'CREDENTIAL_STUFFING_RECOMMENDATION',
  ruleId: RULE_ID_CREDENTIAL_STUFFING,
  severity: 'high',
  generate: () => [
    'Block the offending IP address at the WAF or firewall',
    'Implement rate limiting on the login endpoint',
    'Alert users whose accounts were successfully accessed',
    'Enable a CAPTCHA for all login requests from suspicious subnets',
  ],
};
