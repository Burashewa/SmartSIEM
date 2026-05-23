import { Recommendation } from '../interfaces/recommendation.interface';
import { RULE_ID_DIRECTORY_SCAN } from '../../rules/rules.constants';

export const directoryScanRecommendation: Recommendation = {
  id: 'DIRECTORY_SCAN_RECOMMENDATION',
  ruleId: RULE_ID_DIRECTORY_SCAN,
  severity: 'medium',
  generate: () => [
    'Tarpit or block the scanning IP address automatically',
    'Verify that directory listing is disabled on all web servers',
    'Ensure sensitive backup/config files are not exposed in public roots',
    'Deploy a WAF rule to block common path enumeration tools',
  ],
};
