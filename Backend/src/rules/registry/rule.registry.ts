import { DetectionRule } from '../interfaces/detection-rule.interface';
import { failedLoginRule } from '../definitions/authentication/failed-login.rule';
import { impossibleTravelRule } from '../definitions/authentication/impossible-travel.rule';
import { impossibleTravelCountryIpRule } from '../definitions/authentication/impossible-travel-country-ip.rule';
import { loginAfterFailuresRule } from '../definitions/authentication/login-after-failures.rule';
import { credentialStuffingRule } from '../definitions/authentication/credential-stuffing.rule';
import { distributedBruteForceRule } from '../definitions/authentication/distributed-brute-force.rule';
import { commandInjectionRule } from '../definitions/web-attacks/command-injection.rule';
import { sqlInjectionRule } from '../definitions/web-attacks/sql-injection.rule';
import { xssRule } from '../definitions/web-attacks/xss.rule';
import { pathTraversalLfiRule } from '../definitions/web-attacks/path-traversal-lfi.rule';
import { apiRateLimitRule } from '../definitions/api-abuse/api-rate-limit.rule';
import { unauthorizedEndpointRule } from '../definitions/api-abuse/unauthorized-endpoint.rule';
import { directoryScanRule } from '../definitions/reconnaissance/directory-scan.rule';
import { sensitiveFileAccessRule } from '../definitions/reconnaissance/sensitive-file-access.rule';
import { knownMaliciousIpRule } from '../definitions/network/known-malicious-ip.rule';
import { dosHighVolumeRule } from '../definitions/network/dos-high-volume.rule';
import { errorBurstIpRule } from '../definitions/network/error-burst-ip.rule';

export const RULE_REGISTRY: DetectionRule[] = [
  failedLoginRule,
  impossibleTravelRule,
  impossibleTravelCountryIpRule,
  loginAfterFailuresRule,
  credentialStuffingRule,
  distributedBruteForceRule,
  sqlInjectionRule,
  xssRule,
  pathTraversalLfiRule,
  commandInjectionRule,
  apiRateLimitRule,
  unauthorizedEndpointRule,
  directoryScanRule,
  sensitiveFileAccessRule,
  knownMaliciousIpRule,
  dosHighVolumeRule,
  errorBurstIpRule,
];
