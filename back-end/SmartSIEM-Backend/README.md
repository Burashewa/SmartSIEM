# SmartSIEM Unified Backend

Unified FastAPI backend for ingestion, detection, alerts, dashboard, auth, and real-time streaming.

## Run

```bash
cp .env.example .env
docker compose up --build
```

API base URL: `http://localhost:8080/api/v1`

WebSocket stream: `ws://localhost:8080/ws/stream?token=<access_token>`

## Architecture

- `app/api/*` route modules for collector, logs, alerts, incidents, rules, users, agents, reports, dashboard, analytics, auth, settings.
- `app/services/ingestion_service.py` orchestrates parse -> normalize -> enrich -> validate -> queue.
- `app/workers/ingestion_worker.py` performs async Mongo bulk inserts.
- `app/workers/detection_worker.py` executes rule evaluation and alert creation.
- `app/queues/event_queue.py` provides `AbstractQueue`; current implementation uses `asyncio.Queue`.

## Kafka Migration Path

`app/queues/event_queue.py` already defines `AbstractQueue`. To migrate:

1. Add a `KafkaQueueImpl` class implementing `push()` and `subscribe()`.
2. Select queue implementation by config (`QUEUE_BACKEND=asyncio|kafka`).
3. Keep workers unchanged because they consume `AbstractQueue`.
4. Move ingestion and detection fanout from in-process to Kafka topics.
5. Preserve event contracts by reusing `map_to_detection_event()` in `detection_service.py`.

## Security Notes

- Do not commit `.env` files with credentials.
- Rotate any leaked MongoDB credentials from legacy collector config.
- Use production secrets for `JWT_SECRET_KEY`.
