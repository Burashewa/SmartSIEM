import { Log } from '../../../logs/log.schema';
import {
  AlertInput,
  DetectionRule,
  ResolvedIpCountry,
  RuleContext,
} from '../../interfaces/detection-rule.interface';
import {
  IMPOSSIBLE_TRAVEL_COUNTRY_IP_WINDOW_MINUTES,
  RULE_ID_IMPOSSIBLE_TRAVEL_COUNTRY_IP,
} from '../../rules.constants';
import { extractLoginIdentity, userMatchFilter } from './auth-log-identity';

export const impossibleTravelCountryIpRule: DetectionRule = {
  id: RULE_ID_IMPOSSIBLE_TRAVEL_COUNTRY_IP,
  name: 'Impossible traveler (country by IP)',
  description:
    'Detects the same user sending logs from a different country (IP geolocation) than a recent log within a short window — any event with user + client IP, not only authentication.',
  severity: 'high',
  tags: ['authentication', 'geo', 'ip', 'session'],
  matches: (log) => Boolean(log.ip?.trim()) && Boolean(extractLoginIdentity(log)),
  async evaluate(log, context): Promise<void> {
    const identity = extractLoginIdentity(log);
    if (!identity || !log.ip?.trim()) return;

    const currentGeo = await context.resolveIpCountry(log.ip);
    if (!currentGeo || currentGeo.source === 'private' || currentGeo.source === 'unknown') {
      return;
    }
    if (!hasResolvableCountry(currentGeo)) return;

    const lookbackStart = new Date(
      log.timestamp.getTime() - IMPOSSIBLE_TRAVEL_COUNTRY_IP_WINDOW_MINUTES * 60 * 1000,
    );

    const candidates = await context.logModel
      .find({
        _id: { $ne: log._id },
        timestamp: { $gte: lookbackStart, $lt: log.timestamp },
        ip: { $exists: true, $nin: [null, ''] },
        ...userMatchFilter(identity),
      })
      .sort({ timestamp: -1 })
      .limit(25)
      .exec();

    for (const previousLog of candidates) {
      if (!previousLog.ip?.trim() || previousLog.ip === log.ip) continue;

      const previousGeo = await context.resolveIpCountry(previousLog.ip);
      if (!previousGeo || previousGeo.source === 'private' || previousGeo.source === 'unknown') {
        continue;
      }
      if (!hasResolvableCountry(previousGeo)) continue;
      if (countriesEqual(currentGeo, previousGeo)) continue;

      await emitCountryJumpAlert(context, log, identity, previousLog, currentGeo, previousGeo);
      return;
    }
  },
};

async function emitCountryJumpAlert(
  context: RuleContext,
  log: Log,
  userIdentity: string,
  previousLog: Log,
  currentGeo: ResolvedIpCountry,
  previousGeo: ResolvedIpCountry,
): Promise<void> {
  const input: AlertInput = {
    ruleId: RULE_ID_IMPOSSIBLE_TRAVEL_COUNTRY_IP,
    message: `User ${userIdentity}: activity from ${formatCountry(currentGeo)} after recent activity from ${formatCountry(
      previousGeo,
    )} (country from IP; different address)`,
    severity: 'high',
    ip: log.ip,
    triggeredAt: new Date(),
    context: {
      user: userIdentity,
      windowMinutes: IMPOSSIBLE_TRAVEL_COUNTRY_IP_WINDOW_MINUTES,
      previous: {
        timestamp: previousLog.timestamp,
        event: previousLog.event,
        ip: previousLog.ip,
        country: previousGeo.country,
        countryCode: previousGeo.countryCode,
        source: previousGeo.source,
      },
      current: {
        timestamp: log.timestamp,
        event: log.event,
        ip: log.ip,
        country: currentGeo.country,
        countryCode: currentGeo.countryCode,
        source: currentGeo.source,
      },
    },
  };

  await context.emitAlert(input, log);
  context.logger.warn(
    `Impossible travel (country/IP) for user=${userIdentity}: ${formatCountry(previousGeo)} -> ${formatCountry(
      currentGeo,
    )}`,
  );
}

function formatCountry(g: ResolvedIpCountry): string {
  if (g.countryCode) return `${g.country ?? g.countryCode} (${g.countryCode})`;
  return g.country ?? 'unknown';
}

function hasResolvableCountry(g: ResolvedIpCountry): boolean {
  return Boolean((g.countryCode ?? '').trim() || (g.country ?? '').trim());
}

function countriesEqual(a: ResolvedIpCountry, b: ResolvedIpCountry): boolean {
  const ac = (a.countryCode ?? '').trim().toUpperCase();
  const bc = (b.countryCode ?? '').trim().toUpperCase();
  if (ac && bc) return ac === bc;
  const an = (a.country ?? '').trim().toLowerCase();
  const bn = (b.country ?? '').trim().toLowerCase();
  if (an && bn) return an === bn;
  return false;
}

