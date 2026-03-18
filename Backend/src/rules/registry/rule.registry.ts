import { DetectionRule } from '../interfaces/detection-rule.interface';
import { failedLoginRule } from '../definitions/authentication/failed-login.rule';
import { impossibleTravelRule } from '../definitions/authentication/impossible-travel.rule';
import { loginAfterFailuresRule } from '../definitions/authentication/login-after-failures.rule';
import { credentialStuffingRule } from '../definitions/authentication/credential-stuffing.rule';
import { distributedBruteForceRule } from '../definitions/authentication/distributed-brute-force.rule';
import { commandInjectionRule } from '../definitions/web-attacks/command-injection.rule';
import { sqlInjectionRule } from '../definitions/web-attacks/sql-injection.rule';
import { xssRule } from '../definitions/web-attacks/xss.rule';
import { apiRateLimitRule } from '../definitions/api-abuse/api-rate-limit.rule';
import { unauthorizedEndpointRule } from '../definitions/api-abuse/unauthorized-endpoint.rule';
import { directoryScanRule } from '../definitions/reconnaissance/directory-scan.rule';
import { sensitiveFileAccessRule } from '../definitions/reconnaissance/sensitive-file-access.rule';

export const RULE_REGISTRY: DetectionRule[] = [
  failedLoginRule,
  impossibleTravelRule,
  loginAfterFailuresRule,
  credentialStuffingRule,
  distributedBruteForceRule,
  sqlInjectionRule,
  xssRule,
  commandInjectionRule,
  apiRateLimitRule,
  unauthorizedEndpointRule,
  directoryScanRule,
  sensitiveFileAccessRule,
];
