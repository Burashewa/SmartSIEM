/**
 * Maps SmartSIEM collector Kafka payloads (OCSF-style nested JSON from
 * NormalizedLog.to_json_dict() + enrichment) into the flat fields the
 * detection engine expects (event_type, source_ip, raw_data, etc.).
 */

const FAILED_LOGIN_EVENT_NAMES = [
  'login_failed',
  'failed_login',
  'auth_failed',
  'auth_login_failed',
  'auth_login_failure',
];

const SUCCESS_LOGIN_EVENT_NAMES = ['login_success', 'auth_success', 'auth_login_success'];

const EVENT_TYPE_BY_NAME = {
  auth_fail: 'AUTH_FAIL',
  auth_success: 'AUTH_SUCCESS',
  proc_create: 'PROC_CREATE',
  proc_access: 'PROC_ACCESS',
  dns_query: 'DNS_QUERY',
  file_modify: 'FILE_MODIFY',
  net_conn: 'NET_CONN',
  task_create: 'TASK_CREATE',
};

/**
 * @param {unknown} msg
 * @returns {boolean}
 */
function isCollectorOcsfPayload(msg) {
  if (!msg || typeof msg !== 'object' || Array.isArray(msg)) return false;
  const o = /** @type {Record<string, unknown>} */ (msg);
  if (!('event' in o) || typeof o.event !== 'object' || o.event === null || Array.isArray(o.event)) {
    return false;
  }
  const ev = /** @type {Record<string, unknown>} */ (o.event);
  if (!('type' in ev)) return false;
  // Collector pipeline always sets raw_log (string) on OCSFEvent; legacy test events use raw_data instead.
  if (!('raw_log' in o)) return false;
  return true;
}

/**
 * @param {unknown} v
 * @returns {string | undefined}
 */
function strOrUndef(v) {
  if (v === undefined || v === null) return undefined;
  const s = String(v).trim();
  return s === '' ? undefined : s;
}

/**
 * Derive executable name from OCSF process.command_line when name is absent.
 * @param {string | undefined} cmd
 * @returns {string | undefined}
 */
function processNameFromCommandLine(cmd) {
  if (!cmd || typeof cmd !== 'string') return undefined;
  const part = cmd.trim().split(/\s+/)[0];
  if (!part) return undefined;
  return part.replace(/^["']|["']$/g, '');
}

/**
 * Build raw_data for pattern/statistics rules: JSON raw_log, process/network facets, message.
 * @param {Record<string, unknown>} collector
 * @returns {Record<string, unknown>}
 */
function buildRawData(collector) {
  const proc =
    collector.process && typeof collector.process === 'object' && !Array.isArray(collector.process)
      ? /** @type {Record<string, unknown>} */ (collector.process)
      : {};
  const net =
    collector.network && typeof collector.network === 'object' && !Array.isArray(collector.network)
      ? /** @type {Record<string, unknown>} */ (collector.network)
      : {};

  /** @type {Record<string, unknown>} */
  let base = {};
  const rl = collector.raw_log;

  if (rl != null && typeof rl === 'object' && !Array.isArray(rl)) {
    base = { .../** @type {Record<string, unknown>} */ (rl) };
  } else if (typeof rl === 'string') {
    const t = rl.trim();
    if (t.startsWith('{')) {
      try {
        const parsed = JSON.parse(rl);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          base = { ...parsed };
        } else {
          base = { raw_log: rl };
        }
      } catch {
        base = { raw_log: rl };
      }
    } else if (t !== '') {
      base = { raw_log: rl };
    }
  }

  const msg = collector.message;
  if (typeof msg === 'string' && msg.trim() !== '' && base.message == null) {
    base.message = msg;
  }
  if (collector.payload && typeof collector.payload === 'object' && !Array.isArray(collector.payload)) {
    base = { .../** @type {Record<string, unknown>} */ (collector.payload), ...base };
  }
  if (collector.metadata && typeof collector.metadata === 'object' && !Array.isArray(collector.metadata)) {
    base.metadata = /** @type {Record<string, unknown>} */ (collector.metadata);
  }

  for (const [k, v] of Object.entries(proc)) {
    if (v != null && base[k] == null) base[k] = v;
  }
  for (const [k, v] of Object.entries(net)) {
    if (v != null && base[k] == null) base[k] = v;
  }

  return base;
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function canonicalToken(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
}

/**
 * @param {Record<string, unknown>} collector
 * @param {Record<string, unknown>} ev
 * @returns {string | undefined}
 */
function deriveEventType(collector, ev) {
  const explicitType = strOrUndef(collector.event_type);
  if (explicitType) return explicitType;

  const eventName = canonicalToken(ev.type || collector.event_name || collector.event);
  const action = canonicalToken(ev.action || collector.action);
  const status = canonicalToken(ev.outcome || collector.status);

  if (FAILED_LOGIN_EVENT_NAMES.includes(eventName)) return 'AUTH_FAIL';
  if (SUCCESS_LOGIN_EVENT_NAMES.includes(eventName)) return 'AUTH_SUCCESS';

  const authish = eventName.includes('auth') || eventName.includes('login') || action.includes('login');
  if (authish && ['failed', 'failure', 'error', 'denied', 'rejected'].includes(status)) return 'AUTH_FAIL';
  if (authish && ['success', 'ok', 'passed', 'accepted'].includes(status)) return 'AUTH_SUCCESS';

  if (EVENT_TYPE_BY_NAME[eventName]) return EVENT_TYPE_BY_NAME[eventName];
  if (EVENT_TYPE_BY_NAME[action]) return EVENT_TYPE_BY_NAME[action];
  if (eventName) return eventName.toUpperCase();
  return undefined;
}

/**
 * @param {Record<string, unknown>} collector
 * @returns {Record<string, unknown>}
 */
function mapCollectorOcsfToDetectionEvent(collector) {
  const ev =
    collector.event && typeof collector.event === 'object' && !Array.isArray(collector.event)
      ? /** @type {Record<string, unknown>} */ (collector.event)
      : {};
  const src =
    collector.source && typeof collector.source === 'object' && !Array.isArray(collector.source)
      ? /** @type {Record<string, unknown>} */ (collector.source)
      : {};
  const usr =
    collector.user && typeof collector.user === 'object' && !Array.isArray(collector.user)
      ? /** @type {Record<string, unknown>} */ (collector.user)
      : {};
  const proc =
    collector.process && typeof collector.process === 'object' && !Array.isArray(collector.process)
      ? /** @type {Record<string, unknown>} */ (collector.process)
      : {};

  const userName = strOrUndef(collector.username) || strOrUndef(usr.name) || strOrUndef(collector.user);
  const domain = strOrUndef(usr.domain);
  const userFromMiddleware = strOrUndef(collector.userId) || strOrUndef(collector.user_id);
  const userId =
    userFromMiddleware ||
    (userName && domain ? `${domain}\\${userName}` : userName || domain || undefined);

  const cmdLine = strOrUndef(proc.command_line);
  const processName =
    strOrUndef(proc.name) ||
    (proc.file &&
    typeof proc.file === 'object' &&
    proc.file !== null &&
    !Array.isArray(proc.file)
      ? strOrUndef(/** @type {Record<string, unknown>} */ (proc.file).name)
      : undefined) ||
    processNameFromCommandLine(cmdLine);

  const rawData = buildRawData(collector);

  return {
    ...collector,
    timestamp: collector.timestamp,
    event_type: deriveEventType(collector, ev),
    source_ip: strOrUndef(src.ip) || strOrUndef(collector.ip),
    user_id: userId,
    username: userName,
    process_name: processName,
    raw_data: rawData,
  };
}

/**
 * Normalize a Kafka JSON value for the detection pipeline.
 * @param {unknown} parsed
 * @returns {Record<string, unknown> | null}
 */
function normalizeInboundKafkaMessage(parsed) {
  if (parsed == null) return null;
  if (typeof parsed !== 'object' || Array.isArray(parsed)) {
    return /** @type {Record<string, unknown> | null} */ (parsed);
  }
  if (isCollectorOcsfPayload(parsed)) {
    return /** @type {Record<string, unknown>} */ (
      mapCollectorOcsfToDetectionEvent(/** @type {Record<string, unknown>} */ (parsed))
    );
  }
  return /** @type {Record<string, unknown>} */ (parsed);
}

module.exports = {
  FAILED_LOGIN_EVENT_NAMES,
  normalizeInboundKafkaMessage,
  isCollectorOcsfPayload,
};
