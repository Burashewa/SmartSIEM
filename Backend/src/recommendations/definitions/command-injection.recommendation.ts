import { Recommendation } from '../interfaces/recommendation.interface';
import { RULE_ID_COMMAND_INJECTION } from '../../rules/rules.constants';

export const commandInjectionRecommendation: Recommendation = {
  id: 'COMMAND_INJECTION_RECOMMENDATION',
  ruleId: RULE_ID_COMMAND_INJECTION,
  severity: 'critical',
  generate: () => [
    'Immediately block the source IP address',
    'Audit the underlying server for unauthorized processes or shells',
    'Patch the vulnerable endpoint to properly escape shell arguments',
    'Run a full security scan on the affected host',
  ],
};
