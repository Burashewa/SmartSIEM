import { DetectionRule } from '../../interfaces/detection-rule.interface';
import {
  DOS_HIGH_VOLUME_MIN_EVENTS,
  DOS_HIGH_VOLUME_WINDOW_MINUTES,
  RULE_ID_DOS_HIGH_VOLUME,
} from '../../rules.constants';

export const dosHighVolumeRule: DetectionRule = {
  id: RULE_ID_DOS_HIGH_VOLUME,
  name: 'Suspected DoS / traffic flood (single IP)',
  description:
    'Detects very high log volume from one IPv4 address in a short window, consistent with volumetric DoS or aggressive scanning.',
  severity: 'high',
  tags: ['dos', 'network', 'availability'],
  matches: (log) => Boolean(log.ip?.trim()),
  async evaluate(log, context): Promise<void> {
    if (!log.ip) return;

    const windowStart = new Date(
      log.timestamp.getTime() - DOS_HIGH_VOLUME_WINDOW_MINUTES * 60 * 1000,
    );

    const count = await context.logModel.countDocuments({
      ip: log.ip,
      timestamp: { $gte: windowStart, $lte: log.timestamp },
    });

    if (count < DOS_HIGH_VOLUME_MIN_EVENTS) return;

    await context.emitAlert(
      {
        ruleId: RULE_ID_DOS_HIGH_VOLUME,
        message: `Possible DoS / flood: ${count} logs from ${log.ip} within ${DOS_HIGH_VOLUME_WINDOW_MINUTES} minutes`,
        severity: 'high',
        ip: log.ip,
        triggeredAt: new Date(),
        context: {
          event: log.event,
          source: log.source,
          windowMinutes: DOS_HIGH_VOLUME_WINDOW_MINUTES,
          logCount: count,
          threshold: DOS_HIGH_VOLUME_MIN_EVENTS,
        },
      },
      log,
    );
    context.logger.warn(`DoS volume alert: ip=${log.ip}, count=${count}`);
  },
};
