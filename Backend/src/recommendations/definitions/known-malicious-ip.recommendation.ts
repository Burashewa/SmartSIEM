import { Recommendation } from '../interfaces/recommendation.interface';
import { RULE_ID_KNOWN_MALICIOUS_IP } from '../../rules/rules.constants';

export const knownMaliciousIpRecommendation: Recommendation = {
  id: 'KNOWN_MALICIOUS_IP_REC',
  ruleId: RULE_ID_KNOWN_MALICIOUS_IP,
  severity: 'critical',
  generate: (alert) => {
    const ip = alert.ip ?? 'unknown';
    return [
      `Block ${ip} immediately at the perimeter firewall or WAF`,
      'Rotate credentials for any account that interacted with this IP',
      'Search logs for lateral movement or data exfiltration from the same source',
      'Replace demo TEST-NET entries: set MALICIOUS_IPS in production with your threat-intel feed',
      'Escalate to incident response if the IP touched production systems',
    ];
  },
};
