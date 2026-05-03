
const { v4: uuidv4 } = require('uuid');

const BUILTIN_SEQUENCE_RULES = [
  {
    sequence_id: 'seq-001',
    name: 'Brute force followed by successful login',
    states: ['INIT', 'AUTH_FAIL_BURST', 'AUTH_SUCCESS'],
    transitions: [
      {
        from: 'INIT',
        to: 'AUTH_FAIL_BURST',
        event_type: 'AUTH_FAIL',
        condition: (event, session) => {
          if (!event?.user_id) return false;
          if (!session.user_id) session.user_id = event.user_id;
          return session.user_id === event.user_id;
        },
        timeout_ms: 5 * 60 * 1000,
      },
      {
        from: 'AUTH_FAIL_BURST',
        to: 'AUTH_SUCCESS',
        event_type: 'AUTH_SUCCESS',
        condition: (event, session) => Boolean(event?.user_id) && session.user_id === event.user_id,
        timeout_ms: 5 * 60 * 1000,
      },
    ],
    severity: 'HIGH',
    description: 'Potential brute-force: authentication failures followed by a successful login.',
    needsUserContext: true,
    timeout_ms: 5 * 60 * 1000,
  },
  {
    sequence_id: 'seq-002',
    name: 'PowerShell network connection then scheduled task creation',
    states: ['INIT', 'POWERSHELL_NETCONN', 'SCHEDULED_TASK_CREATE'],
    transitions: [
      {
        from: 'INIT',
        to: 'POWERSHELL_NETCONN',
        event_type: 'NET_CONN',
        condition: (event) => {
          const proc = String(event?.process_name ?? '').toLowerCase();
          return proc.includes('powershell') || proc.includes('pwsh');
        },
        timeout_ms: 10 * 60 * 1000,
      },
      {
        from: 'POWERSHELL_NETCONN',
        to: 'SCHEDULED_TASK_CREATE',
        event_type: 'TASK_CREATE',
        condition: () => true,
        timeout_ms: 10 * 60 * 1000,
      },
    ],
    severity: 'CRITICAL',
    description: 'Suspicious chain: PowerShell network activity followed by scheduled task creation.',
    needsUserContext: false,
    timeout_ms: 10 * 60 * 1000,
  },
];

class SequenceDetector {
  constructor(sequenceRules = BUILTIN_SEQUENCE_RULES) {
    this.sequenceRules = Array.isArray(sequenceRules) ? sequenceRules : BUILTIN_SEQUENCE_RULES;
    this.sessions = new Map();
  }

  evaluate(event) {
    try {
      if (!event || !event.source_ip) return null;

      for (const rule of this.sequenceRules) {
        const sourceIp = String(event.source_ip);
        const userPart = rule.needsUserContext ? `:${String(event.user_id ?? '')}` : '';
        const sessionKey = `${rule.sequence_id}:${sourceIp}${userPart}`;

        let session = this.sessions.get(sessionKey);
        const now = Date.now();

        if (!session) {
          session = {
            currentState: rule.states[0],
            source_ip: sourceIp,
            user_id: event.user_id,
            startedAt: now,
            lastTransition: now,
          };
          this.sessions.set(sessionKey, session);
        }

        if (now - session.lastTransition > (rule.timeout_ms ?? 0)) {
          session.currentState = rule.states[0];
          session.startedAt = now;
          session.lastTransition = now;
          session.source_ip = sourceIp;
          session.user_id = rule.needsUserContext ? event.user_id : session.user_id;
        }

        const transition = rule.transitions.find(
          (t) =>
            t.from === session.currentState &&
            t.event_type === event.event_type &&
            typeof t.condition === 'function' &&
            t.condition(event, session) === true
        );

        if (!transition) continue;

        session.currentState = transition.to;
        session.lastTransition = now;

        const finalState = rule.states[rule.states.length - 1];
        if (session.currentState === finalState) {
          const alert = {
            alert_id: uuidv4(),
            rule_id: rule.sequence_id,
            rule_name: rule.name,
            severity: rule.severity,
            event_type: event.event_type,
            trigger_time: new Date(now).toISOString(),
            source_ip: sourceIp,
            user_id: event.user_id,
            description: rule.description,
            linked_events: [],
            recommendation: null,
            status: 'NEW',
          };

          this.sessions.delete(sessionKey);
          return alert;
        }
      }

      return null;
    } catch (err) {
      console.error('[sequence] evaluate error', err);
      return null;
    }
  }

  cleanup() {
    try {
      const now = Date.now();
      const maxTimeout = Math.max(
        0,
        ...this.sequenceRules.map((r) => Number(r.timeout_ms) || 0)
      );
      const cutoff = maxTimeout + 2 * 60 * 1000;

      let removed = 0;
      for (const [key, session] of this.sessions.entries()) {
        const last = Number(session?.lastTransition) || 0;
        if (now - last > cutoff) {
          this.sessions.delete(key);
          removed += 1;
        }
      }

      console.log(`[sequence] cleanup removed ${removed} sessions`);
      return removed;
    } catch (err) {
      console.error('[sequence] cleanup error', err);
      return 0;
    }
  }
}

module.exports = { BUILTIN_SEQUENCE_RULES, SequenceDetector };


