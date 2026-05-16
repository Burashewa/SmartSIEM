import { Log } from '../../../logs/log.schema';
import { DetectionRule } from '../../interfaces/detection-rule.interface';
import {
  ERROR_BURST_IP_MIN_EVENTS,
  ERROR_BURST_IP_WINDOW_MINUTES,
  RULE_ID_ERROR_BURST_IP,
} from '../../rules.constants';

function isErrorLikeLog(log: Log): boolean {
  const sev = (log.severity ?? '').toLowerCase();
  if (sev === 'high' || sev === 'critical') return true;
  const lv = (log.level ?? '').toLowerCase();
  return lv === 'error' || lv === 'fatal' || lv === 'critical';
}

export const errorBurstIpRule: DetectionRule = {
  id: RULE_ID_ERROR_BURST_IP,
  name: 'Error / failure burst from single IP',
  description:
    'Many high-severity or error-level log lines from one IP in a short period — misconfiguration, abuse, or attack noise.',
  severity: 'medium',
  tags: ['errors', 'stability', 'investigation'],
  matches: (log) => Boolean(log.ip?.trim()) && isErrorLikeLog(log),
  async evaluate(log, context): Promise<void> {
    if (!log.ip) return;

    const windowStart = new Date(log.timestamp.getTime() - ERROR_BURST_IP_WINDOW_MINUTES * 60 * 1000);

    const count = await context.logModel.countDocuments({
      ip: log.ip,
      timestamp: { $gte: windowStart, $lte: log.timestamp },
      $or: [
        { severity: { $in: ['high', 'critical', 'HIGH', 'CRITICAL'] } },
        { level: { $in: ['error', 'fatal', 'critical', 'ERROR', 'FATAL', 'CRITICAL'] } },
      ],
    });

    if (count < ERROR_BURST_IP_MIN_EVENTS) return;

    await context.emitAlert(
      {
        ruleId: RULE_ID_ERROR_BURST_IP,
        message: `Error-heavy traffic: ${count} error/critical entries from ${log.ip} in ${ERROR_BURST_IP_WINDOW_MINUTES} minutes`,
        severity: 'medium',
        ip: log.ip,
        triggeredAt: new Date(),
        context: {
          event: log.event,
          source: log.source,
          severity: log.severity,
          level: log.level,
          windowMinutes: ERROR_BURST_IP_WINDOW_MINUTES,
          logCount: count,
          threshold: ERROR_BURST_IP_MIN_EVENTS,
        },
      },
      log,
    );
    context.logger.warn(`Error burst alert: ip=${log.ip}, count=${count}`);
  },
};
