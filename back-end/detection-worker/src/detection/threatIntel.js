
const fs = require('fs/promises');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');

const DEFAULT_IOCS = {
  ips: ['203.0.113.10', '198.51.100.23', '192.0.2.77'],
  domains: ['malicious-example.com', 'bad-domain.test', 'cnc.example.net'],
};

class ThreatIntelDetector {
  constructor() {
    this.maliciousIPs = new Set(DEFAULT_IOCS.ips);
    this.maliciousDomains = new Set(DEFAULT_IOCS.domains.map((d) => String(d).toLowerCase()));
  }

  async loadFromFile(filePath) {
    try {
      const raw = await fs.readFile(filePath, 'utf8');
      const parsed = JSON.parse(raw);
      const ips = Array.isArray(parsed?.ips) ? parsed.ips : [];
      const domains = Array.isArray(parsed?.domains) ? parsed.domains : [];

      this.maliciousIPs = new Set(ips.map((ip) => String(ip)));
      this.maliciousDomains = new Set(domains.map((d) => String(d).toLowerCase()));
      console.log(
        `[threat-intel] loaded ${this.maliciousIPs.size} IPs and ${this.maliciousDomains.size} domains from file`
      );
    } catch (err) {
      console.error('[threat-intel] loadFromFile error', err);
    }
  }

  async loadFromRedis(redisClient) {
    try {
      if (!redisClient) return;
      // Optional: project can implement later.
      console.log('[threat-intel] loadFromRedis not implemented; using existing sets');
    } catch (err) {
      console.error('[threat-intel] loadFromRedis error', err);
    }
  }

  async refresh() {
    try {
      const filePath =
        config?.worker?.iocFilePath ||
        config?.threatIntel?.filePath ||
        process.env.IOC_FILE_PATH;

      if (!filePath) {
        console.log('[threat-intel] using static default IOCs');
        return;
      }

      await this.loadFromFile(filePath);
    } catch (err) {
      console.error('[threat-intel] refresh error; keeping existing sets', err);
    }
  }

  checkEvent(event) {
    try {
      if (!event) return null;

      const nowIso = new Date().toISOString();

      if (event.source_ip && this.maliciousIPs.has(String(event.source_ip))) {
        return {
          alert_id: uuidv4(),
          rule_id: 'ti-001',
          rule_name: 'Threat Intel Match',
          severity: 'HIGH',
          event_type: event.event_type || 'THREAT_INTEL',
          trigger_time: nowIso,
          source_ip: event.source_ip,
          user_id: event.user_id,
          description: `Threat intel match: source IP ${event.source_ip} is in known-bad IOC list`,
          linked_events: [],
          recommendation: null,
          status: 'NEW',
        };
      }

      const rawData = event.raw_data && typeof event.raw_data === 'object' ? event.raw_data : {};
      const candidateDomains = [
        rawData.domain,
        rawData.destination,
        rawData.dest_domain,
        rawData.query,
        rawData.hostname,
      ]
        .filter(Boolean)
        .map((d) => String(d).toLowerCase());

      for (const domain of candidateDomains) {
        if (this.maliciousDomains.has(domain)) {
          return {
            alert_id: uuidv4(),
            rule_id: 'ti-001',
            rule_name: 'Threat Intel Match',
            severity: 'HIGH',
            event_type: event.event_type || 'THREAT_INTEL',
            trigger_time: nowIso,
            source_ip: event.source_ip,
            user_id: event.user_id,
            description: `Threat intel match: domain ${domain} is in known-bad IOC list`,
            linked_events: [],
            recommendation: null,
            status: 'NEW',
          };
        }
      }

      return null;
    } catch (err) {
      console.error('[threat-intel] checkEvent error', err);
      return null;
    }
  }
}

module.exports = { DEFAULT_IOCS, ThreatIntelDetector };


