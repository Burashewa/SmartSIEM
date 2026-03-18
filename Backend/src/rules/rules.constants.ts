export const RULE_ID_FAILED_LOGINS = 'failed-logins-5-in-5m';
export const RULE_ID_IMPOSSIBLE_TRAVELER = 'impossible-traveler';
export const RULE_ID_LOGIN_AFTER_FAILURES = 'login-after-failures';
export const RULE_ID_CREDENTIAL_STUFFING = 'credential-stuffing';
export const RULE_ID_DISTRIBUTED_BRUTE_FORCE = 'distributed-brute-force';
export const RULE_ID_SQL_INJECTION = 'sql-injection-attempt';
export const RULE_ID_XSS = 'xss-attempt';
export const RULE_ID_COMMAND_INJECTION = 'command-injection-attempt';
export const RULE_ID_API_RATE_LIMIT = 'api-rate-limit';
export const RULE_ID_UNAUTHORIZED_ENDPOINT = 'unauthorized-endpoint';
export const RULE_ID_DIRECTORY_SCAN = 'directory-scan';
export const RULE_ID_SENSITIVE_FILE_ACCESS = 'sensitive-file-access';

export const FAILED_LOGIN_EVENT_NAMES = [
  'login_failed',
  'failed_login',
  'auth_failed',
  'auth_login_failed',
  'auth_login_failure',
];

export const FAILED_LOGIN_THRESHOLD = 5;
export const FAILED_LOGIN_WINDOW_MINUTES = 5;

export const LOGIN_SUCCESS_EVENT_NAMES = [
  'login_success',
  'auth_login_success',
  'user_login_success',
  'authentication_success',
];

export const LOGIN_AFTER_FAILURES_LOOKBACK_MINUTES = 10;
export const LOGIN_AFTER_FAILURES_MIN_FAILURES = 3;

export const CREDENTIAL_STUFFING_WINDOW_MINUTES = 10;
export const CREDENTIAL_STUFFING_MIN_UNIQUE_USERS = 10;

export const DISTRIBUTED_BRUTE_FORCE_WINDOW_MINUTES = 15;
export const DISTRIBUTED_BRUTE_FORCE_MIN_UNIQUE_IPS = 8;

export const IMPOSSIBLE_TRAVELER_MAX_LOOKBACK_HOURS = 24;
export const IMPOSSIBLE_TRAVELER_MIN_DISTANCE_KM = 500;
export const IMPOSSIBLE_TRAVELER_MIN_SPEED_KMH = 900;

export const SQL_INJECTION_EVENT_NAMES = [
  'sql_injection',
  'sql_injection_attempt',
  'sql_injection_detected',
];

export const XSS_EVENT_NAMES = ['xss', 'xss_attempt', 'xss_detected'];

export const COMMAND_INJECTION_EVENT_NAMES = [
  'command_injection',
  'command_injection_attempt',
  'command_injection_detected',
];

export const API_RATE_LIMIT_EVENT_NAMES = [
  'api_rate_limit',
  'api_rate_limited',
  'rate_limit_exceeded',
];

export const UNAUTHORIZED_ENDPOINT_EVENT_NAMES = [
  'unauthorized_endpoint',
  'api_unauthorized',
  'endpoint_access_denied',
];

export const DIRECTORY_SCAN_EVENT_NAMES = [
  'directory_scan',
  'dir_scan',
  'path_traversal_probe',
];

export const SENSITIVE_FILE_ACCESS_EVENT_NAMES = [
  'sensitive_file_access',
  'sensitive_file_probe',
  'restricted_file_access',
];
