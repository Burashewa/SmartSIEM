# SmartSIEM — Daily security report

- **Generated:** 2026-05-16T12:04:20.300Z
- **Window:** 2026-05-15T12:04:20.300Z → 2026-05-16T12:04:20.300Z
- **Tenant user:** sa2@gmail.com (69efe21bda34df1ef5e0a0f3), role security_analyst
- **Total alerts:** 17

## Summary by severity

- **high:** 16
- **critical:** 1

## Findings and recommendations

### failed login burst (`failed-logins-5-in-5m`) — 9 alert(s)

- **2026-05-16T12:00:36.627Z** | high | IP: 196.191.52.38 | Brute-force pattern from IP 196.191.52.38: 7 failed logins in 15m (burst); 11 failed logins in 60m (sustained)
- **2026-05-16T11:56:50.119Z** | critical | IP: 196.191.52.38 | 196.191.52.38 triggered the failed login burst rule 2 times in 5 minutes
- **2026-05-16T11:52:49.930Z** | high | IP: 196.191.52.38 | 196.191.52.38 triggered the failed login burst rule 2 times in 5 minutes
- **2026-05-16T11:46:24.186Z** | high | IP: 196.191.52.38 | 196.191.52.38 triggered the failed login burst rule 2 times in 5 minutes
- **2026-05-16T11:44:48.360Z** | high | IP: 196.191.52.38 | Brute-force pattern from IP 196.191.52.38: 3 failed logins in 2m (rapid)
- _… and 4 more (deduped in UI)._

**Recommendations:**
1. Temporarily lock the user account
1. Block the source IP address
1. Enable CAPTCHA on login
1. Monitor further login attempts

### XSS (`xss-attempt`) — 6 alert(s)

- **2026-05-15T20:45:25.698Z** | high | IP: 170.64.226.54 | 170.64.226.54 triggered the XSS rule 5 times in 5 minutes
- **2026-05-15T20:25:05.102Z** | high | IP: 170.64.226.54 | 170.64.226.54 triggered the XSS rule 2 times in 5 minutes
- **2026-05-15T20:05:41.874Z** | high | IP: 170.64.226.54 | Possible XSS in log content (HTML script tag (<script)) from 170.64.226.54
- **2026-05-15T20:03:01.381Z** | high | IP: 170.64.226.54 | Possible XSS in log content (HTML script tag (<script)) from 170.64.226.54
- **2026-05-15T19:53:03.095Z** | high | IP: 170.64.226.54 | Possible XSS in log content (HTML script tag (<script)) from 170.64.226.54
- _… and 1 more (deduped in UI)._

**Recommendations:**
1. Ensure strict Content Security Policy (CSP) headers are active
1. Verify input sanitization on the vulnerable endpoint
1. Block the source IP if attacks persist
1. Check application logs to confirm if the XSS payload was stored or reflected

### SQL injection (`sql-injection-attempt`) — 2 alert(s)

- **2026-05-16T12:00:36.316Z** | high | IP: 196.191.52.38 | Possible SQL injection in request body (UNION SELECT) from 196.191.52.38
- **2026-05-16T11:56:49.721Z** | high | IP: 196.191.52.38 | Possible SQL injection in request body (UNION SELECT) from 196.191.52.38

**Recommendations:**
1. Block the offending IP address
1. Review web application firewall rules
1. Sanitize and parameterize database queries
1. Inspect affected endpoints for injection payloads

---

*This file is generated automatically. Configure malicious IPs via `MALICIOUS_IPS` and tune DoS/error thresholds in `rules.constants.ts` as needed.*
