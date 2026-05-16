import { Recommendation } from '../interfaces/recommendation.interface';
import { RULE_ID_DOS_HIGH_VOLUME } from '../../rules/rules.constants';

export const dosHighVolumeRecommendation: Recommendation = {
  id: 'DOS_HIGH_VOLUME_REC',
  ruleId: RULE_ID_DOS_HIGH_VOLUME,
  severity: 'high',
  generate: (alert) => {
    const ip = alert.ip ?? 'unknown';
    return [
      `Rate-limit or temporarily block ${ip}; enable DDoS scrubbing / CDN protections if public-facing`,
      'Scale or autoscale affected services; confirm health checks and circuit breakers',
      'Inspect application logs for cache miss storms or retry loops amplifying traffic',
      `Tune DOS_HIGH_VOLUME_MIN_EVENTS / WINDOW in rules.constants if noisy in your environment`,
    ];
  },
};
