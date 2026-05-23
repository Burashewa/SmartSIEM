import { Recommendation } from '../interfaces/recommendation.interface';
import { RULE_ID_ERROR_BURST_IP } from '../../rules/rules.constants';

export const errorBurstIpRecommendation: Recommendation = {
  id: 'ERROR_BURST_IP_REC',
  ruleId: RULE_ID_ERROR_BURST_IP,
  severity: 'medium',
  generate: (alert) => {
    const ip = alert.ip ?? 'unknown';
    return [
      `Triage top failing endpoints or services touched from ${ip}`,
      'Check for dependency outages, auth misconfiguration, or a buggy client retrying aggressively',
      `If attack-related, correlate with WAF/IPS and consider temporary IP throttle`,
      `Adjust ERROR_BURST_IP_MIN_EVENTS if this rule is too sensitive for your log volume`,
    ];
  },
};
