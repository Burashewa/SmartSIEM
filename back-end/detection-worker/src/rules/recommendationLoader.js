const config = require('../config');
const { getDb } = require('../storage/mongoWriter');

/** Fallback when no rule-specific playbook exists. */
const GENERIC_RECOMMENDATION = {
  summary: 'Investigate this alert to determine impact and scope.',
  action_steps: [
    'Validate the event context and affected assets.',
    'Correlate with nearby events and other alerts.',
    'Contain and remediate if malicious activity is confirmed.',
  ],
};

const DEFAULT_RECOMMENDATIONS = {
  'rule-auth-bruteforce-60s-5': {
    summary: 'Possible brute force login activity.',
    action_steps: [
      'Block or rate-limit the source IP at the edge.',
      'Force password reset / MFA for the affected account(s).',
      'Review authentication logs for further suspicious activity.',
    ],
  },
  'rule-proc-powershell-encoded': {
    summary: 'Suspicious PowerShell encoded command execution.',
    action_steps: [
      'Isolate the host if activity is unexpected.',
      'Collect the full command line and decode the payload for analysis.',
      'Hunt for persistence mechanisms and follow-on network connections.',
    ],
  },
  'rule-procaccess-lsass': {
    summary: 'Potential credential dumping attempt (LSASS access).',
    action_steps: [
      'Isolate the endpoint immediately.',
      'Collect EDR telemetry and memory artifacts for investigation.',
      'Reset credentials that may be exposed and search for lateral movement.',
    ],
  },
  'rule-dns-entropy-suspicious': {
    summary: 'Suspicious DNS query patterns (possible DGA/C2).',
    action_steps: [
      'Block the domain and investigate related outbound connections.',
      'Check for malware indicators and unusual processes on the host.',
      'Review DNS logs for similar queries across the environment.',
    ],
  },
  'rule-filemod-ransomware-burst': {
    summary: 'High volume file modifications (possible ransomware).',
    action_steps: [
      'Isolate the host to prevent spread.',
      'Disable affected credentials and stop suspicious processes.',
      'Initiate incident response and restore from clean backups if needed.',
    ],
  },
  'seq-001': {
    summary: 'Brute force followed by successful login.',
    action_steps: [
      'Verify the login was legitimate; check geo/IP reputation.',
      'Force password reset and enable MFA.',
      'Review for privilege changes or suspicious sessions.',
    ],
  },
  'seq-002': {
    summary: 'Suspicious PowerShell chain with persistence behavior.',
    action_steps: [
      'Investigate the scheduled task details and creation command.',
      'Isolate the host and collect process/network telemetry.',
      'Search for similar behavior across endpoints.',
    ],
  },
  'ti-001': {
    summary: 'Threat intel match on event data.',
    action_steps: [
      'Block the IOC (IP/domain) and search for related activity.',
      'Inspect affected host(s) for malware and persistence.',
      'Review and scope potential data exfiltration.',
    ],
  },
  'stat-001': {
    summary: 'Statistical anomaly detected in hourly metrics.',
    action_steps: [
      'Validate whether the spike is expected (maintenance, scanning, etc.).',
      'Investigate top talkers/processes and associated events.',
      'Correlate with other alerts and recent changes.',
    ],
  },
};

function deepCloneRecommendations(src) {
  return JSON.parse(JSON.stringify(src));
}

/** In-memory map: rule_id / alert_type -> { summary, action_steps } */
let mergedMap = deepCloneRecommendations(DEFAULT_RECOMMENDATIONS);

function normalizeRecommendationDoc(doc) {
  if (!doc || typeof doc !== 'object') return null;
  if (typeof doc.summary === 'string' && Array.isArray(doc.action_steps)) {
    return {
      summary: doc.summary,
      action_steps: doc.action_steps.map((s) => String(s)),
    };
  }
  if (
    doc.recommendation &&
    typeof doc.recommendation.summary === 'string' &&
    Array.isArray(doc.recommendation.action_steps)
  ) {
    return {
      summary: doc.recommendation.summary,
      action_steps: doc.recommendation.action_steps.map((s) => String(s)),
    };
  }
  return null;
}

function alertTypeKey(doc) {
  return doc.alert_type || doc.rule_id || null;
}

/**
 * Reload all recommendations from MongoDB into memory, overlaying defaults.
 * Match key: document `alert_type` (or `rule_id`) equals detection rule_id / alert rule_id.
 */
async function reloadRecommendations() {
  try {
    const base = deepCloneRecommendations(DEFAULT_RECOMMENDATIONS);
    const db = getDb();
    if (!db) {
      mergedMap = base;
      return;
    }

    const coll = db.collection(config.mongodb.collections.recommendations);
    const docs = await coll.find({}).toArray();
    let overrides = 0;

    for (const doc of docs) {
      const key = alertTypeKey(doc);
      if (!key) continue;
      const rec = normalizeRecommendationDoc(doc);
      if (!rec) continue;
      base[String(key)] = rec;
      overrides += 1;
    }

    mergedMap = base;
    console.log(
      `[recommendations] refreshed map (${overrides} DB override(s), ${Object.keys(mergedMap).length} total keys)`
    );
  } catch (err) {
    console.error('[recommendations] reloadRecommendations error', err);
    mergedMap = deepCloneRecommendations(DEFAULT_RECOMMENDATIONS);
  }
}

function getRecommendationForAlert(ruleId) {
  const id = ruleId != null && ruleId !== '' ? String(ruleId) : '';
  if (!id) return GENERIC_RECOMMENDATION;
  return mergedMap[id] || GENERIC_RECOMMENDATION;
}

module.exports = {
  reloadRecommendations,
  getRecommendationForAlert,
  DEFAULT_RECOMMENDATIONS,
};
