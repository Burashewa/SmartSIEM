# SmartSIEM — Daily security report

- **Generated:** 2026-05-15T21:36:24.191Z
- **Window:** 2026-05-14T21:36:24.191Z → 2026-05-15T21:36:24.191Z
- **Tenant user:** sa2@gmail.com (69efe21bda34df1ef5e0a0f3), role security_analyst
- **Total alerts:** 10

## Summary by severity

- **high:** 10

## Findings and recommendations

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

### failed login burst (`failed-logins-5-in-5m`) — 4 alert(s)

- **2026-05-15T19:15:39.165Z** | high | IP: 170.64.198.130 | Brute-force pattern from IP 170.64.198.130: 5 failed logins in 2m (rapid); 5 failed logins in 15m (burst)
- **2026-05-15T19:15:38.860Z** | high | IP: 170.64.198.130 | Brute-force pattern from IP 170.64.198.130: 5 failed logins in 2m (rapid); 5 failed logins in 15m (burst)
- **2026-05-15T19:15:31.466Z** | high | IP: 170.64.198.130 | Brute-force pattern from IP 170.64.198.130: 3 failed logins in 2m (rapid)
- **2026-05-15T19:15:31.333Z** | high | IP: 170.64.198.130 | Brute-force pattern from IP 170.64.198.130: 3 failed logins in 2m (rapid)

**Recommendations:**
1. Temporarily lock the user account
1. Block the source IP address
1. Enable CAPTCHA on login
1. Monitor further login attempts

---

*This file is generated automatically. Configure malicious IPs via `MALICIOUS_IPS` and tune DoS/error thresholds in `rules.constants.ts` as needed.*
