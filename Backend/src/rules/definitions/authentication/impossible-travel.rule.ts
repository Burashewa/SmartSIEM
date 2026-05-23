import { Log } from '../../../logs/log.schema';
import { DetectionRule } from '../../interfaces/detection-rule.interface';
import {
  IMPOSSIBLE_TRAVELER_MAX_LOOKBACK_HOURS,
  IMPOSSIBLE_TRAVELER_MIN_DISTANCE_KM,
  IMPOSSIBLE_TRAVELER_MIN_SPEED_KMH,
  LOGIN_SUCCESS_EVENT_NAMES,
  RULE_ID_IMPOSSIBLE_TRAVELER,
} from '../../rules.constants';

export const impossibleTravelRule: DetectionRule = {
  id: RULE_ID_IMPOSSIBLE_TRAVELER,
  name: 'Impossible traveler',
  description: 'Detects logins that would require unrealistic travel speed between locations.',
  severity: 'critical',
  tags: ['authentication', 'geo'],
  matches: (log) => Boolean(log.user) && LOGIN_SUCCESS_EVENT_NAMES.includes(log.event),
  async evaluate(log, context): Promise<void> {
    if (!log.user) return;

    const currentLocation = extractGeoPoint(log);
    if (!currentLocation) return;

    const lookbackStart = new Date(
      log.timestamp.getTime() - IMPOSSIBLE_TRAVELER_MAX_LOOKBACK_HOURS * 60 * 60 * 1000,
    );

    const previousLog = await context.logModel
      .findOne({
        _id: { $ne: log._id },
        user: log.user,
        event: { $in: LOGIN_SUCCESS_EVENT_NAMES },
        timestamp: { $gte: lookbackStart, $lt: log.timestamp },
      })
      .sort({ timestamp: -1 })
      .exec();

    if (!previousLog) return;

    const previousLocation = extractGeoPoint(previousLog);
    if (!previousLocation) return;

    const elapsedHours = (log.timestamp.getTime() - previousLog.timestamp.getTime()) / (60 * 60 * 1000);
    if (elapsedHours <= 0) return;

    const distanceKm = haversineKm(
      previousLocation.latitude,
      previousLocation.longitude,
      currentLocation.latitude,
      currentLocation.longitude,
    );
    const speedKmh = distanceKm / elapsedHours;

    if (distanceKm < IMPOSSIBLE_TRAVELER_MIN_DISTANCE_KM || speedKmh < IMPOSSIBLE_TRAVELER_MIN_SPEED_KMH) {
      return;
    }

    await context.emitAlert({
      ruleId: RULE_ID_IMPOSSIBLE_TRAVELER,
      message: `Impossible traveler detected for user ${log.user}: ${distanceKm.toFixed(0)} km in ${elapsedHours.toFixed(2)} hours`,
      severity: 'critical',
      ip: log.ip,
      triggeredAt: new Date(),
      context: {
        user: log.user,
        from: {
          timestamp: previousLog.timestamp,
          ip: previousLog.ip,
          latitude: previousLocation.latitude,
          longitude: previousLocation.longitude,
        },
        to: {
          timestamp: log.timestamp,
          ip: log.ip,
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
        },
        distanceKm,
        elapsedHours,
        speedKmh,
        thresholds: {
          minDistanceKm: IMPOSSIBLE_TRAVELER_MIN_DISTANCE_KM,
          minSpeedKmh: IMPOSSIBLE_TRAVELER_MIN_SPEED_KMH,
        },
      },
    }, log);

    context.logger.warn(
      `Impossible traveler alert created for user=${log.user}, speed=${speedKmh.toFixed(1)} km/h`,
    );
  },
};

function extractGeoPoint(log: Log): { latitude: number; longitude: number } | undefined {
  const raw = readRecord(log.raw);
  const topLevelLat = readNumber(log.latitude);
  const topLevelLon = readNumber(log.longitude);

  if (
    topLevelLat !== undefined &&
    topLevelLon !== undefined &&
    topLevelLat >= -90 &&
    topLevelLat <= 90 &&
    topLevelLon >= -180 &&
    topLevelLon <= 180
  ) {
    return { latitude: topLevelLat, longitude: topLevelLon };
  }

  const lat =
    readNumber(raw?.latitude) ??
    readNumber(raw?.lat) ??
    readNumber(readRecord(raw?.geo)?.latitude) ??
    readNumber(readRecord(raw?.geo)?.lat) ??
    readNumber(readRecord(raw?.location)?.latitude) ??
    readNumber(readRecord(raw?.location)?.lat) ??
    readNumber(readRecord(readRecord(raw?.parsed)?.geo)?.latitude) ??
    readNumber(readRecord(readRecord(raw?.parsed)?.geo)?.lat);

  const lon =
    readNumber(raw?.longitude) ??
    readNumber(raw?.lon) ??
    readNumber(readRecord(raw?.geo)?.longitude) ??
    readNumber(readRecord(raw?.geo)?.lon) ??
    readNumber(readRecord(raw?.location)?.longitude) ??
    readNumber(readRecord(raw?.location)?.lon) ??
    readNumber(readRecord(readRecord(raw?.parsed)?.geo)?.longitude) ??
    readNumber(readRecord(readRecord(raw?.parsed)?.geo)?.lon);

  if (lat === undefined || lon === undefined) return undefined;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return undefined;

  return { latitude: lat, longitude: lon };
}

function readRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
}

function readNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const earthRadiusKm = 6371;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}
