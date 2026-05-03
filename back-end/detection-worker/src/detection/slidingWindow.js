
const { v4: uuidv4 } = require('uuid');

class SlidingWindowDetector {
  constructor() {
    this.windows = new Map();
  }

  evaluate(event, rule) {
    try {
      const keyFields = rule?.config?.key_fields;
      const windowSec = rule?.config?.window_sec;
      const threshold = rule?.config?.threshold;

      if (!event || !rule || !Array.isArray(keyFields) || keyFields.length === 0) return null;
      if (!Number.isFinite(windowSec) || !Number.isFinite(threshold)) return null;

      const keyParts = [];
      for (const field of keyFields) {
        const value = event?.[field];
        if (value === undefined || value === null || value === '') return null; // skip rule if missing
        keyParts.push(String(value));
      }

      const compositeKey = `${rule.rule_id}:${keyParts.join(':')}`;
      const arr = this.windows.get(compositeKey) || [];

      const eventDate = event.timestamp instanceof Date ? event.timestamp : new Date(event.timestamp);
      if (Number.isNaN(eventDate.getTime())) return null;

      arr.push(eventDate);

      const nowMs = Date.now();
      const cutoffMs = nowMs - windowSec * 1000;
      while (arr.length > 0 && arr[0].getTime() < cutoffMs) arr.shift();

      this.windows.set(compositeKey, arr);

      if (arr.length >= threshold) {
        const nowIso = new Date(nowMs).toISOString();
        const sourceIp = event?.source_ip;

        const alert = {
          alert_id: uuidv4(),
          rule_id: rule.rule_id,
          rule_name: rule.name,
          severity: rule.severity,
          event_type: rule.event_type,
          trigger_time: nowIso,
          source_ip: sourceIp,
          user_id: event?.user_id,
          description: `Threshold exceeded: ${threshold} ${rule.event_type} events from ${sourceIp} in ${windowSec} seconds`,
          linked_events: [],
          recommendation: null,
          status: 'NEW',
        };

        // Avoid immediate re-triggering on the same key.
        this.windows.delete(compositeKey);
        return alert;
      }

      return null;
    } catch (err) {
      console.error('[sliding-window] evaluate error', err);
      return null;
    }
  }

  cleanup() {
    try {
      const nowMs = Date.now();
      const staleCutoffMs = nowMs - 10 * 60 * 1000;
      let removed = 0;

      for (const [key, timestamps] of this.windows.entries()) {
        const last = Array.isArray(timestamps) ? timestamps[timestamps.length - 1] : undefined;
        const lastMs = last instanceof Date ? last.getTime() : NaN;
        if (!Number.isFinite(lastMs) || lastMs < staleCutoffMs) {
          this.windows.delete(key);
          removed += 1;
        }
      }

      console.log(`[sliding-window] cleanup removed ${removed} entries`);
      return removed;
    } catch (err) {
      console.error('[sliding-window] cleanup error', err);
      return 0;
    }
  }
}

module.exports = { SlidingWindowDetector };


