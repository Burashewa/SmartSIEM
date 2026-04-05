import { Recommendation } from '../interfaces/recommendation.interface';
import { RULE_ID_SENSITIVE_FILE_ACCESS } from '../../rules/rules.constants';

export const sensitiveFileAccessRecommendation: Recommendation = {
  id: 'SENSITIVE_FILE_ACCESS_RECOMMENDATION',
  ruleId: RULE_ID_SENSITIVE_FILE_ACCESS,
  severity: 'high',
  generate: () => [
    'Block the IP address making the request',
    'Check file system permissions on the requested sensitive files',
    'Audit web server configurations to restrict access to local file paths',
    'Determine if a successful local file inclusion (LFI) occurred',
  ],
};
