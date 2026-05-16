export const RULE_ID_FAILED_LOGINS = 'failed-logins-5-in-5m';
export const RULE_ID_IMPOSSIBLE_TRAVELER = 'impossible-traveler';
/** Same user, different resolved country between recent logs within a window (IP → country; any event with user+IP). */
export const RULE_ID_IMPOSSIBLE_TRAVEL_COUNTRY_IP = 'impossible-travel-country-ip';
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
export const RULE_ID_KNOWN_MALICIOUS_IP = 'known-malicious-ip';
export const RULE_ID_DOS_HIGH_VOLUME = 'dos-high-volume-ip';
export const RULE_ID_ERROR_BURST_IP = 'error-burst-ip';

export const FAILED_LOGIN_EVENT_NAMES = [
  'login_failed',
  'failed_login',
  'auth_failed',
  'auth_login_failed',
  'auth_login_failure',
  'AUTH_FAIL'
];

/** Fast brute-force: this many failures from one IP within the burst window. */
export const FAILED_LOGIN_THRESHOLD = 5;
/** Sliding window for burst detection (wider than 5m so spaced attempts still count). */
export const FAILED_LOGIN_WINDOW_MINUTES = 15;

/**
 * When failed attempts in the burst window reach this count, alert severity is escalated to `critical`.
 * Must be >= {@link FAILED_LOGIN_THRESHOLD} to avoid every first firing being critical.
 */
export const FAILED_LOGIN_BURST_CRITICAL_MIN = 10;

/** Low-and-slow password guessing: more failures over a longer horizon. */
export const FAILED_LOGIN_SLOW_THRESHOLD = 10;
export const FAILED_LOGIN_SLOW_WINDOW_MINUTES = 60;

/** Very rapid guessing: fewer attempts in a short span. */
export const FAILED_LOGIN_RAPID_THRESHOLD = 3;
export const FAILED_LOGIN_RAPID_WINDOW_MINUTES = 2;

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

/** Lookback for comparing the latest prior log (same user) by resolved country from IP. */
export const IMPOSSIBLE_TRAVEL_COUNTRY_IP_WINDOW_MINUTES = 120;

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

/** Count of **all** logs from one IP in this window triggers suspected volumetric DoS / flood. */
export const DOS_HIGH_VOLUME_WINDOW_MINUTES = 5;
export const DOS_HIGH_VOLUME_MIN_EVENTS = 400;

/** Many high-severity / error-level events from one IP in a short window. */
export const ERROR_BURST_IP_WINDOW_MINUTES = 15;
export const ERROR_BURST_IP_MIN_EVENTS = 80;
