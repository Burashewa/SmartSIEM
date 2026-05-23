import { DetectionRule } from '../../interfaces/detection-rule.interface';
import {
  CREDENTIAL_STUFFING_MIN_UNIQUE_USERS,
  CREDENTIAL_STUFFING_WINDOW_MINUTES,
  RULE_ID_CREDENTIAL_STUFFING,
} from '../../rules.constants';
import {
  countDistinctLoginIdentitiesFromIp,
  extractLoginIdentity,
  isFailedLoginLog,
} from './auth-log-identity';

export const credentialStuffingRule: DetectionRule = {
  id: RULE_ID_CREDENTIAL_STUFFING,
  name: 'Credential stuffing',
  description:
    'Detects failed login attempts from a single IP targeting many distinct users (accounts resolved from log.user and raw.rawEvent.context email/username/body fields).',
  severity: 'high',
  tags: ['authentication', 'credential-stuffing'],
  matches: (log) =>
    Boolean(log.ip?.trim()) &&
    isFailedLoginLog(log) &&
    Boolean(extractLoginIdentity(log)),
  async evaluate(log, context): Promise<void> {
    if (!log.ip?.trim()) return;

    const stats = await countDistinctLoginIdentitiesFromIp(
      context.logModel,
      log,
      CREDENTIAL_STUFFING_WINDOW_MINUTES,
    );

    if (stats.uniqueIdentities < CREDENTIAL_STUFFING_MIN_UNIQUE_USERS) return;

    await context.emitAlert(
      {
        ruleId: RULE_ID_CREDENTIAL_STUFFING,
        message: `Credential stuffing suspected from IP ${log.ip}: ${stats.uniqueIdentities} distinct accounts targeted in ${CREDENTIAL_STUFFING_WINDOW_MINUTES} minutes`,
        severity: 'high',
        ip: log.ip,
        triggeredAt: new Date(),
        context: {
          ip: log.ip,
          uniqueUsers: stats.uniqueIdentities,
          targetedAccounts: stats.identities.slice(0, 20),
          totalAttempts: stats.totalAttempts,
          windowMinutes: CREDENTIAL_STUFFING_WINDOW_MINUTES,
          lastEventAt: log.timestamp,
          identitySource: 'log.user and raw.rawEvent.context (email, user, username, body)',
        },
      },
      log,
    );
  },
};
