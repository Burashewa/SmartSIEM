
const { v4: uuidv4 } = require('uuid');

class RingBuffer {
  constructor(capacity = 168) {
    this.capacity = Number.isFinite(capacity) && capacity > 0 ? capacity : 168;
    this.buffer = new Array(this.capacity);
    this.head = 0;
    this.count = 0;
  }

  push(value) {
    const n = Number(value);
    this.buffer[this.head] = Number.isFinite(n) ? n : 0;
    this.head = (this.head + 1) % this.capacity;
    this.count = Math.min(this.capacity, this.count + 1);
  }

  getValues() {
    const values = [];
    for (let i = 0; i < this.capacity; i += 1) {
      const v = this.buffer[i];
      if (v !== undefined) values.push(v);
    }
    return values;
  }

  isFull() {
    return this.count >= this.capacity;
  }

  mean() {
    const values = this.getValues();
    if (values.length === 0) return 0;
    let sum = 0;
    for (const v of values) sum += v;
    return sum / values.length;
  }

  stddev() {
    const values = this.getValues();
    if (values.length < 2) return 0;
    const m = this.mean();
    let varianceSum = 0;
    for (const v of values) {
      const d = v - m;
      varianceSum += d * d;
    }
    const variance = varianceSum / values.length; // population stddev
    return Math.sqrt(variance);
  }
}

class StatisticalDetector {
  constructor() {
    this.buffers = new Map();
  }

  addDataPoint(entityKey, value) {
    try {
      if (!entityKey) return;
      const key = String(entityKey);
      let buf = this.buffers.get(key);
      if (!buf) {
        buf = new RingBuffer(168);
        this.buffers.set(key, buf);
      }
      buf.push(value);
    } catch (err) {
      console.error('[statistics] addDataPoint error', err);
    }
  }

  checkAnomaly(entityKey, currentValue) {
    try {
      const key = String(entityKey ?? '');
      const buf = this.buffers.get(key);
      if (!buf || !buf.isFull()) return null;

      const mean = buf.mean();
      const stddev = buf.stddev();
      if (!Number.isFinite(stddev) || stddev === 0) return null;

      const cur = Number(currentValue);
      if (!Number.isFinite(cur)) return null;

      const zScore = (cur - mean) / stddev;
      if (zScore > 3.0) {
        const nowIso = new Date().toISOString();
        return {
          alert_id: uuidv4(),
          rule_id: 'stat-001',
          rule_name: 'Statistical Anomaly Detected',
          severity: 'MEDIUM',
          event_type: 'ANOMALY',
          trigger_time: nowIso,
          source_ip: key,
          description: `Statistical anomaly: value ${cur} exceeds baseline mean ${mean.toFixed(
            2
          )} by ${zScore.toFixed(2)} standard deviations`,
          linked_events: [],
          recommendation: null,
          status: 'NEW',
        };
      }

      return null;
    } catch (err) {
      console.error('[statistics] checkAnomaly error', err);
      return null;
    }
  }

  recordHourlyMetrics(metricsMap) {
    try {
      if (!metricsMap || typeof metricsMap !== 'object') return;
      for (const [entityKey, metrics] of Object.entries(metricsMap)) {
        const count = metrics?.count;
        this.addDataPoint(entityKey, count);
      }
    } catch (err) {
      console.error('[statistics] recordHourlyMetrics error', err);
    }
  }
}

module.exports = { RingBuffer, StatisticalDetector };


