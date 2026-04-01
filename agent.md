# AGENTS.md — SmartSIEM Rule Engine

## Project overview
Python Flask microservice that receives JSON log events from security log
collectors and evaluates them against 20 detection rules in real time.
Triggered alerts are written to alerts.json and queryable via REST.

## Stack
- Python 3.10+
- Flask 3.x (only web framework)
- rich (terminal output only)
- Zero databases, zero message brokers

## File layout
rule_engine/
├── app.py           # Flask entrypoint — POST /ingest, GET /alerts, GET /summary, GET /health
├── models.py        # LogEvent + SecurityAlert dataclasses
├── rules.py         # 20 DetectionRule objects (source of truth for all rules)
├── engine.py        # Dispatches to 3 rule mechanisms
├── window.py        # In-memory sliding-window counter + sequence tracker
├── alert_writer.py  # Dedup (30s window) + append-only alerts.json persistence
├── summary.py       # CLI: python summary.py [--watch] [--severity X] [--last N]
├── demo_sender.py   # Simulates 14 named attack scenarios via HTTP POST
└── requirements.txt # flask>=3.0, rich>=13.7

## Coding conventions
- Type hints on all function signatures
- Dataclasses for all data models (no dicts as return types)
- Module-level singletons for window, sequence, writer (imported by engine/app)
- Never let a single rule crash the engine — wrap each rule eval in try/except
- Thread-safe: all shared mutable state guarded with threading.Lock

## LogEvent contract (what collectors POST to /ingest)
{
  "timestamp": "2026-03-18T10:30:00Z",
  "source": "web",
  "severity": "medium",

  "event": "authentication",
  "action": "login",
  "status": "failed",

  "user": "admin",
  "role": "user",

  "ip": "192.168.1.10",

  "deviceId": "chrome_windows",
  "sessionId": "sess_123",

  "endpoint": "/login",
  "method": "POST",

  "resource": null,

  "payload": {
    "username": "admin",
    "password": "' OR 1=1 --"
  },

  "userAgent": "Mozilla/5.0",

  "latitude": 9.03,
  "longitude": 38.74,

  "tags": ["authentication", "web"],

  "metadata": {},

  "raw": {}
}
## Rule mechanisms
1. threshold_window — count events per (rule_id, group_key) in a rolling deque
2. single_event     — pattern match on one event (blocklist, path, role, bytes, etc.)
3. sequence         — first_event bursts followed by second_event on same group key

## Alert dedup
Same (rule_id, source_ip) suppressed for 30 seconds after first write.
Suppressed count tracked in stats but not written to disk.

## Testing requirements
Every code change must pass:
  python -m pytest tests/ -q          # if tests/ exists
  python smoke_test.py                # fast in-process checks (no server needed)
```

---

## Step 2 — Agent prompt (paste into Manager View)

Antigravity lets you deploy agents that autonomously plan, execute, and verify complex tasks across your editor, terminal, and browser  — so write the prompt as a mission, not a chat message:
```
Mission: build and verify the SmartSIEM Rule Engine

## Context
All source files are already written and present in rule_engine/.
Read AGENTS.md first to understand the project before touching anything.

## What to do

1. READ all existing files in rule_engine/ to understand the codebase fully.

2. VERIFY the code runs correctly:
   a. pip install -r rule_engine/requirements.txt
   b. cd rule_engine && python smoke_test.py
      If smoke_test.py doesn't exist, create it (see spec below).
   c. Start the Flask server in the background:
         python app.py &
      Wait 2 seconds for it to start.
   d. Run the demo sender (one pass):
         python demo_sender.py --once
   e. Verify alerts.json is non-empty valid JSON:
         python -c "import json; d=json.load(open('alerts.json')); print(len(d), 'alerts written')"
   f. Hit all four endpoints:
         curl -s http://localhost:5000/health
         curl -s http://localhost:5000/summary
         curl -s "http://localhost:5000/alerts?severity=HIGH&limit=5"
         curl -s -X POST http://localhost:5000/ingest \
           -H "Content-Type: application/json" \
           -d '{"event":"authentication","action":"login","status":"failed","ip":"192.168.1.10","severity":"high"}'
   g. Run the terminal summary:
         python summary.py --last 10

3. FIX any issues found in step 2. Do not move on until all checks pass.

4. CREATE smoke_test.py if it doesn't exist, covering:
   - All 3 rule mechanisms (threshold_window, single_event, sequence)
   - AlertWriter dedup logic
   - LogEvent.from_dict validation (missing fields, bad types)
   - All 4 Flask endpoints via Flask test client (no live server needed)

5. PRODUCE artifacts:
   - Screenshot of the terminal summary output
   - Browser recording of GET /alerts in a browser tab
   - Final test run output showing all checks green

## Constraints
- Do NOT add any new pip dependencies
- Do NOT change the /ingest request schema
- Do NOT use a database
- All window state stays in-memory in window.py

## Definition of done
- smoke_test.py passes with zero failures
- demo_sender.py --once completes without HTTP errors
- alerts.json contains at least 10 alerts
- All 4 curl checks return valid JSON with HTTP 200