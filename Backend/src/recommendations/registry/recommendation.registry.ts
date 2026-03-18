import { Recommendation } from '../interfaces/recommendation.interface';
import { apiAbuseRecommendation } from '../definitions/api-abuse.recommendation';
import { bruteForceRecommendation } from '../definitions/brute-force.recommendation';
import { sqlInjectionRecommendation } from '../definitions/sql-injection.recommendation';

export const RecommendationRegistry: Recommendation[] = [
  bruteForceRecommendation,
  sqlInjectionRecommendation,
  apiAbuseRecommendation,
];
