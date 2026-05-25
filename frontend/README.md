# SmartSIEM Frontend

React + Vite + Tailwind CSS dashboard for SmartSIEM.

## Setup

From `SmartSIEM/frontend`:

```bash
npm install
npm run dev
```

The dev server defaults to port **3001** (`FRONTEND_PORT` in `SmartSIEM/.env`). API requests to `/api/*` are proxied to the NestJS backend (`PORT`, default 5001).

## Environment

Set in `SmartSIEM/.env`:

```env
VITE_GOOGLE_CLIENT_ID=   # optional — Google sign-in on login page
```

## App areas

| Route | Purpose |
|-------|---------|
| `/` | Landing page |
| `/login` | Sign in / register |
| `/docs` | Developer documentation |
| `/dashboard` | Security KPIs and widgets |
| `/logs` | Ingested log viewer |
| `/alerts-and-threats` | Alert triage |
| `/detection-rules` | Enable/disable rules |
| `/investigations` | Investigation cases |
| `/reports` | Daily security reports |
| `/ai-recommendations` | Rule remediation hints |
| `/settings` | Agents, users, account |

## Build

```bash
npm run build
npm run preview
```
