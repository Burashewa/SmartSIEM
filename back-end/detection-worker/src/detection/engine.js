const { v4: uuidv4 } = require('uuid');
const config = require('../config');

const { SlidingWindowDetector } = require('./slidingWindow');
const { SequenceDetector } = require('./sequence');
const { StatisticalDetector } = require('./statistics');
const { ThreatIntelDetector } = require('./threatIntel');

const { getCurrentRules } = require('../rules/ruleLoader');
const { getRecommendationForAlert } = require('../rules/recommendationLoader');
const { sendAlert } = require('../kafka/producer');
const { batchWriteLogs, batchWriteAlerts } = require('../storage/mongoWriter');

/**
 * Build a RegExp from rule config; supports inline `(?i)` used in default rules (not valid in JS literals).
 * @param {string} pattern
 * @returns {RegExp | null}
 */
function compileRulePattern(pattern) {
  if (!pattern || typeof pattern !== 'string') return null;
  let body = pattern;
  let flags = '';
  if (body.startsWith('(?i)')) {
    body = body.slice(4);
    flags += 'i';
  }
  try {
    return new RegExp(body, flags);
  } catch {
    return null;
  }
}

function shannonEntropy(str) {
  const s = String(str ?? '');
  if (!s) return 0;
  const counts = new Map();
  for (const ch of s) counts.set(ch, (counts.get(ch) || 0) + 1);
  const len = s.length;
  let entropy = 0;
  for (const c of counts.values()) {
    const p = c / len;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

class DetectionEngine {
  constructor() {
    this.slidingWindowDetector = new SlidingWindowDetector();
    this.sequenceDetector = new SequenceDetector();
    this.statisticalDetector = new StatisticalDetector();
    this.threatIntelDetector = new ThreatIntelDetector();

    this.logBatch = [];
    this.alertQueue = [];
    this.hourlyMetrics = {};

    this.totalProcessed = 0;
    this.totalAlerts = 0;

    /** In-memory counters for the current stats aggregation window (flushed every statsIntervalMs). */
    this.currentIntervalStats = this._createEmptyIntervalStats();

    /** Prevents overlapping flushBatches runs; coalesces extra flush requests. */
    this._flushInProgress = false;
    this._flushEnqueued = false;

    this._flushTimer = setInterval(() => {
      void this.flushBatches();
    }, config.worker.flushIntervalMs);
  }

  _batchSizeThreshold() {
    return Math.max(1, config.worker.batchSize);
  }

  async _maybeFlushByBatchSize() {
    const n = this._batchSizeThreshold();
    if (this.logBatch.length >= n || this.alertQueue.length >= n) {
      await this.flushBatches();
    }
  }

  _createEmptyIntervalStats() {
    return {
      total_logs: 0,
      total_alerts: 0,
      alerts_by_severity: {},
      source_ip_counts: {},
      event_type_counts: {},
    };
  }

  _recordLogForInterval(event) {
    const s = this.currentIntervalStats;
    s.total_logs += 1;
    const ip = event?.source_ip;
    if (ip) {
      const k = String(ip);
      s.source_ip_counts[k] = (s.source_ip_counts[k] || 0) + 1;
    }
    const et = event?.event_type;
    if (et) {
      const t = String(et);
      s.event_type_counts[t] = (s.event_type_counts[t] || 0) + 1;
    }
  }

  _recordAlertForInterval(alert) {
    if (!alert) return;
    const s = this.currentIntervalStats;
    s.total_alerts += 1;
    const sev = String(alert.severity || 'UNKNOWN').toUpperCase();
    s.alerts_by_severity[sev] = (s.alerts_by_severity[sev] || 0) + 1;
  }

  /**
   * Atomically take the current interval counters and reset for the next window.
   * @returns {object} snapshot suitable for statsAggregator
   */
  consumeIntervalStatsSnapshot() {
    const prev = this.currentIntervalStats;
    this.currentIntervalStats = this._createEmptyIntervalStats();
    return prev;
  }

  async flushBatches() {
    if (this._flushInProgress) {
      this._flushEnqueued = true;
      return;
    }
    this._flushInProgress = true;
    this._flushEnqueued = false;

    try {
      const logsToWrite = this.logBatch;
      const alertsToWrite = this.alertQueue;

      this.logBatch = [];
      this.alertQueue = [];

      try {
        if (logsToWrite.length > 0) await batchWriteLogs(logsToWrite);
      } catch (err) {
        console.error('[engine] flush log batch error', err);
      }

      try {
        if (alertsToWrite.length > 0) await batchWriteAlerts(alertsToWrite);
      } catch (err) {
        console.error('[engine] flush alert batch error', err);
      }
    } finally {
      this._flushInProgress = false;
      const n = this._batchSizeThreshold();
      if (this._flushEnqueued) {
        this._flushEnqueued = false;
        void this.flushBatches();
      } else if (this.logBatch.length >= n || this.alertQueue.length >= n) {
        void this.flushBatches();
      }
    }
  }

  attachRecommendation(alert, rule) {
    try {
      const ruleId = rule?.rule_id || alert?.rule_id;
      alert.recommendation = getRecommendationForAlert(ruleId);
      return alert;
    } catch (err) {
      console.error('[engine] attachRecommendation error', err);
      return alert;
    }
  }

  async processEvent(event) {
    try {
      this.totalProcessed += 1;
      this._recordLogForInterval(event);
      this.logBatch.push({ ...(event || {}) });
      await this._maybeFlushByBatchSize();

      const rules = getCurrentRules() || [];

      const handleAlert = (alert, rule) => {
        if (!alert) return;

        this.attachRecommendation(alert, rule);
        this.alertQueue.push(alert);
        this._recordAlertForInterval(alert);
        try {
          // Fire-and-forget; acceptable if delivery fails.
          sendAlert(alert);
        } catch (err) {
          console.error('[engine] sendAlert error', err);
        }
        this.totalAlerts += 1;

        const n = this._batchSizeThreshold();
        if (this.alertQueue.length >= n || this.logBatch.length >= n) {
          void this.flushBatches();
        }
      };

      for (const rule of rules) {
        if (!rule || rule.status !== 'ACTIVE') continue;

        if (rule.type === 'threshold') {
          const alert = this.slidingWindowDetector.evaluate(event, rule);
          handleAlert(alert, rule);
          continue;
        }

        if (rule.type === 'pattern') {
          try {
            const field = rule?.config?.field;
            const pattern = rule?.config?.pattern;
            const value = field ? event?.raw_data?.[field] : undefined;
            if (field && pattern && value !== undefined && value !== null) {
              const re = compileRulePattern(pattern);
              if (re && re.test(String(value))) {
                const nowIso = new Date().toISOString();
                const alert = {
                  alert_id: uuidv4(),
                  rule_id: rule.rule_id,
                  rule_name: rule.name,
                  severity: rule.severity,
                  event_type: rule.event_type,
                  trigger_time: nowIso,
                  source_ip: event?.source_ip,
                  user_id: event?.user_id,
                  description: `Pattern matched for rule ${rule.rule_id} on field ${field}`,
                  linked_events: [],
                  recommendation: null,
                  status: 'NEW',
                };
                handleAlert(alert, rule);
              }
            }
          } catch (err) {
            console.error('[engine] pattern rule error', err);
          }
          continue;
        }

        if (rule.type === 'statistical') {
          try {
            const field = rule?.config?.field;
            const entropyGt = Number(rule?.config?.entropy_gt);
            const lengthGt = Number(rule?.config?.length_gt);
            const domainValue = field ? event?.raw_data?.[field] : undefined;

            if (field && domainValue) {
              const domain = String(domainValue);
              const entropy = shannonEntropy(domain);
              const lenOk = Number.isFinite(lengthGt) ? domain.length > lengthGt : true;
              const entOk = Number.isFinite(entropyGt) ? entropy > entropyGt : false;

              if (lenOk && entOk) {
                const nowIso = new Date().toISOString();
                const alert = {
                  alert_id: uuidv4(),
                  rule_id: rule.rule_id,
                  rule_name: rule.name,
                  severity: rule.severity,
                  event_type: rule.event_type,
                  trigger_time: nowIso,
                  source_ip: event?.source_ip,
                  user_id: event?.user_id,
                  description: `Statistical rule triggered: domain entropy ${entropy.toFixed(
                    2
                  )} (len=${domain.length}) exceeds thresholds`,
                  linked_events: [],
                  recommendation: null,
                  status: 'NEW',
                };
                handleAlert(alert, rule);
              }
            }
          } catch (err) {
            console.error('[engine] statistical rule error', err);
          }
          continue;
        }

        // 'sequence' rules are handled by the SequenceDetector (built-ins) below.
      }

      // Sequence detector (built-in).
      const seqAlert = this.sequenceDetector.evaluate(event);
      handleAlert(seqAlert, { rule_id: seqAlert?.rule_id });

      // Threat intel detector.
      const tiAlert = this.threatIntelDetector.checkEvent(event);
      handleAlert(tiAlert, { rule_id: tiAlert?.rule_id });

      // Update hourly metrics (by source_ip).
      const ip = event?.source_ip;
      if (ip) {
        const k = String(ip);
        this.hourlyMetrics[k] = (this.hourlyMetrics[k] || 0) + 1;
      }
    } catch (err) {
      console.error('[engine] processEvent error', err);
    }
  }

  async runHourlyStats() {
    try {
      const metrics = this.hourlyMetrics || {};
      this.hourlyMetrics = {};

      for (const [key, count] of Object.entries(metrics)) {
        this.statisticalDetector.addDataPoint(key, count);
        const alert = this.statisticalDetector.checkAnomaly(key, count);
        if (alert) {
          this.attachRecommendation(alert, { rule_id: alert.rule_id });
          this.alertQueue.push(alert);
          this._recordAlertForInterval(alert);
          try {
            sendAlert(alert);
          } catch (err) {
            console.error('[engine] sendAlert error (hourly)', err);
          }
          this.totalAlerts += 1;
          await this._maybeFlushByBatchSize();
        }
      }
    } catch (err) {
      console.error('[engine] runHourlyStats error', err);
    }
  }

  cleanup() {
    try {
      this.slidingWindowDetector.cleanup();
    } catch (err) {
      console.error('[engine] sliding window cleanup error', err);
    }

    try {
      this.sequenceDetector.cleanup();
    } catch (err) {
      console.error('[engine] sequence cleanup error', err);
    }
  }

  async shutdown() {
    try {
      if (this._flushTimer) clearInterval(this._flushTimer);
      this._flushTimer = null;
      await this.flushBatches();
    } catch (err) {
      console.error('[engine] shutdown error', err);
    }
  }
}

module.exports = { DetectionEngine };
