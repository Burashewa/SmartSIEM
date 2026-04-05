import { Recommendation } from '../interfaces/recommendation.interface';
import { RULE_ID_DISTRIBUTED_BRUTE_FORCE } from '../../rules/rules.constants';

export const distributedBruteForceRecommendation: Recommendation = {
  id: 'DISTRIBUTED_BRUTE_FORCE_RECOMMENDATION',
  ruleId: RULE_ID_DISTRIBUTED_BRUTE_FORCE,
  severity: 'high',
  generate: () => [
    'Lock the targeted user account temporarily to prevent breach',
    'Deploy behavioral bot protection on the authentication endpoint',
    'Analyze the IP subnet patterns and block malicious ASNs',
    'Force MFA enrollment for the targeted user',
  ],
};
