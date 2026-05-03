
const config = require('../config');
const { getDb } = require('../storage/mongoWriter');
const { reloadRecommendations } = require('./recommendationLoader');

const DEFAULT_RULES = [
  {
    rule_id: 'rule-auth-bruteforce-60s-5',
    name: 'Brute force login threshold',
    type: 'threshold',
    severity: 'HIGH',
    event_type: 'AUTH_FAIL',
    config: { window_sec: 60, threshold: 5, key_fields: ['source_ip', 'username'] },
    status: 'ACTIVE',
  },
  {
    rule_id: 'rule-proc-powershell-encoded',
    name: 'PowerShell encoded command detection',
    type: 'pattern',
    severity: 'HIGH',
    event_type: 'PROC_CREATE',
    config: {
      field: 'command_line',
      pattern: '(?i)\\b(powershell|pwsh)\\b.*\\b(-enc|-encodedcommand)\\b',
    },
    status: 'ACTIVE',
  },
  {
    rule_id: 'rule-procaccess-lsass',
    name: 'LSASS memory access alert',
    type: 'pattern',
    severity: 'CRITICAL',
    event_type: 'PROC_ACCESS',
    config: {
      field: 'target_process',
      pattern: '(?i)\\blsass\\.exe\\b',
    },
    status: 'ACTIVE',
  },
  {
    rule_id: 'rule-dns-entropy-suspicious',
    name: 'Suspicious DNS entropy',
    type: 'statistical',
    severity: 'MEDIUM',
    event_type: 'DNS_QUERY',
    config: { entropy_gt: 3.5, length_gt: 25, field: 'query' },
    status: 'ACTIVE',
  },
  {
    rule_id: 'rule-filemod-ransomware-burst',
    name: 'Ransomware file activity burst',
    type: 'threshold',
    severity: 'CRITICAL',
    event_type: 'FILE_MODIFY',
    config: { window_sec: 300, threshold: 100, key_fields: ['username'] },
    status: 'ACTIVE',
  },
];

let currentRules = [];

async function loadRules() {
  try {
    const db = getDb();
    if (!db) return DEFAULT_RULES;

    const rulesCollection = config.mongodb.collections.rules;
    const rules = await db
      .collection(rulesCollection)
      .find({ status: 'ACTIVE' })
      .toArray();

    if (!Array.isArray(rules) || rules.length === 0) return DEFAULT_RULES;
    return rules;
  } catch (err) {
    console.error('[rules] loadRules error; using defaults', err);
    return DEFAULT_RULES;
  }
}

async function reloadRules() {
  try {
    const rules = await loadRules();
    currentRules = Array.isArray(rules) ? rules : DEFAULT_RULES;
    console.log(`[rules] loaded ${currentRules.length} rules`);
    await reloadRecommendations();
    return currentRules;
  } catch (err) {
    console.error('[rules] reloadRules error', err);
    currentRules = DEFAULT_RULES;
    try {
      await reloadRecommendations();
    } catch {
      // ignore
    }
    return currentRules;
  }
}

function getCurrentRules() {
  return currentRules;
}

// Populate on startup and refresh periodically.
void reloadRules();
setInterval(() => {
  void reloadRules();
}, Math.max(1, config.worker.ruleReloadIntervalSec) * 1000);

module.exports = {
  loadRules,
  reloadRules,
  getCurrentRules,
};


