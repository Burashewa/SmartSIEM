import { Recommendation } from '../interfaces/recommendation.interface';
import { apiAbuseRecommendation } from '../definitions/api-abuse.recommendation';
import { bruteForceRecommendation } from '../definitions/brute-force.recommendation';
import { sqlInjectionRecommendation } from '../definitions/sql-injection.recommendation';
import { impossibleTravelRecommendation } from '../definitions/impossible-travel.recommendation';
import { loginAfterFailuresRecommendation } from '../definitions/login-after-failures.recommendation';
import { credentialStuffingRecommendation } from '../definitions/credential-stuffing.recommendation';
import { distributedBruteForceRecommendation } from '../definitions/distributed-brute-force.recommendation';
import { xssRecommendation } from '../definitions/xss.recommendation';
import { commandInjectionRecommendation } from '../definitions/command-injection.recommendation';
import { pathTraversalLfiRecommendation } from '../definitions/path-traversal-lfi.recommendation';
import { unauthorizedEndpointRecommendation } from '../definitions/unauthorized-endpoint.recommendation';
import { directoryScanRecommendation } from '../definitions/directory-scan.recommendation';
import { sensitiveFileAccessRecommendation } from '../definitions/sensitive-file-access.recommendation';
import { knownMaliciousIpRecommendation } from '../definitions/known-malicious-ip.recommendation';
import { dosHighVolumeRecommendation } from '../definitions/dos-high-volume.recommendation';
import { errorBurstIpRecommendation } from '../definitions/error-burst-ip.recommendation';

export const RecommendationRegistry: Recommendation[] = [
  bruteForceRecommendation,
  sqlInjectionRecommendation,
  apiAbuseRecommendation,
  impossibleTravelRecommendation,
  loginAfterFailuresRecommendation,
  credentialStuffingRecommendation,
  distributedBruteForceRecommendation,
  xssRecommendation,
  commandInjectionRecommendation,
  pathTraversalLfiRecommendation,
  unauthorizedEndpointRecommendation,
  directoryScanRecommendation,
  sensitiveFileAccessRecommendation,
  knownMaliciousIpRecommendation,
  dosHighVolumeRecommendation,
  errorBurstIpRecommendation,
];
