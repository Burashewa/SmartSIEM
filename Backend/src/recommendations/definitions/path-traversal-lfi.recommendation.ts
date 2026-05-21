import { Recommendation } from '../interfaces/recommendation.interface';
import { RULE_ID_PATH_TRAVERSAL_LFI } from '../../rules/rules.constants';

export const pathTraversalLfiRecommendation: Recommendation = {
  id: 'PATH_TRAVERSAL_LFI_RECOMMENDATION',
  ruleId: RULE_ID_PATH_TRAVERSAL_LFI,
  severity: 'high',
  generate: () => [
    'Block or rate-limit the source IP at the WAF or reverse proxy',
    'Validate and canonicalize file paths server-side; reject paths containing ".." sequences',
    'Disable unnecessary URI schemes (file://, php://) in application runtimes',
    'Review access logs for successful reads of /etc/passwd, .env, or web.config',
    'Patch the affected endpoint and add path allow-listing where files are served',
  ],
};
