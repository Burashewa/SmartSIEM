# SmartSIEM Backend

NestJS API for log ingestion, detection rules, alerts, dashboard metrics, and AI-assisted reports. Data is stored in MongoDB.

## Prerequisites

- Node.js 20+
- MongoDB (local or remote)

## Setup

```bash
npm install
```

Create `SmartSIEM/.env` (or `Backend/.env`) with at least:

```env
MONGODB_URI=mongodb://localhost:27017/smartsiem
JWT_ACCESS_SECRET=change-me-access
JWT_REFRESH_SECRET=change-me-refresh
PORT=5001
```

Optional:

```env
GEMINI_API_KEY=           # AI report enrichment & chat
GOOGLE_CLIENT_ID=         # Google sign-in
MALICIOUS_IPS=            # Comma-separated IPs for known-malicious-ip rule
SMTP_HOST= SMTP_PORT= SMTP_USER= SMTP_PASS=  # Password reset email
```

## Run

```bash
npm run start:dev
```

API base: `http://localhost:5001/api` (set `PORT` in `.env`).

Static simulator UI is served from `public/` (excluded from `/api` routes).

## Authentication

| Use case | Method |
|----------|--------|
| Log ingestion | `Authorization: Bearer <agent-api-key>` on `POST /api/logs` |
| Dashboard / analyst APIs | `Authorization: Bearer <jwt-access-token>` from `/api/auth/login` |

Roles: `security_analyst`, `admin`.

## Main endpoints

### Public

- `POST /api/auth/register` — `{ username, password, role, email? }`
- `POST /api/auth/login` — `{ username, password }`
- `POST /api/auth/google` — `{ credential }`
- `POST /api/auth/refresh` — `{ refreshToken }`
- `POST /api/auth/forgot-password` · `POST /api/auth/reset-password`
- `GET /api/system/status`
- `POST /api/logs` — ingest (requires agent API key)

### Protected (JWT, typically `security_analyst`)

- `GET /api/logs` · `DELETE /api/logs` · `DELETE /api/logs/:id`
- `GET /api/alerts` · `GET /api/alerts/:id` · `PATCH /api/alerts/:id/status` · `DELETE /api/alerts`
- `GET /api/rules` · `PUT /api/rules/:id/toggle`
- `GET /api/dashboard/summary` · `GET /api/dashboard/kpi`
- `POST /api/agents` · `GET /api/agents` · `GET /api/agents/:id/api-key` · `POST /api/agents/:id/regenerate`
- `GET /api/reports/daily/list` · `GET /api/reports/daily/:date` · `POST /api/reports/daily`
- `POST /api/reports/ai/chat` · `POST /api/alert-assistant/chat`

### Admin only

- `POST /api/auth/users/block` — `{ username, blocked }`

## Example log payload

```json
{
  "timestamp": "2026-05-10T15:30:00.000Z",
  "source": "my-app",
  "event": "authentication",
  "action": "login",
  "status": "failed",
  "user": "jdoe",
  "ip": "203.0.113.42",
  "severity": "high"
}
```

Batch multiple events in one request:

```json
{
  "source": "my-app",
  "events": [
    { "timestamp": "2026-05-10T15:31:00.000Z", "event": "authentication", "action": "login", "status": "failed", "user": "jdoe", "ip": "203.0.113.42" }
  ]
}
```

## Detection rules

Sixteen built-in rules are registered in `src/rules/registry/rule.registry.ts` (authentication abuse, web attacks, API abuse, reconnaissance, network). Rules run after each successful ingest.

## Tests

```bash
npm test
```

Runs unit tests for log parsers and rule payload scanners.
