import { Recommendation } from '../interfaces/recommendation.interface';
import { RULE_ID_IMPOSSIBLE_TRAVELER } from '../../rules/rules.constants';

export const impossibleTravelRecommendation: Recommendation = {
  id: 'IMPOSSIBLE_TRAVEL_RECOMMENDATION',
  ruleId: RULE_ID_IMPOSSIBLE_TRAVELER,
  severity: 'critical',
  generate: () => [
    'Require immediate multi-factor authentication (MFA) step-up',
    'Verify login activity with the user',
    'Review active sessions for this user and revoke suspicious ones',
    'Investigate potential credential compromise',
  ],
};
