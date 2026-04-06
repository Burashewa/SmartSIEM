import os
from dotenv import load_dotenv

# Load .env FIRST so every module sees the variables
load_dotenv()

from flask import Flask, request, jsonify
from flask_socketio import SocketIO, emit

from models       import LogEvent
from engine       import evaluate
from alert_writer import writer
from rules        import RULES
from db           import logs_col, ping as db_ping
from queue_worker import ingestion_queue, QueueFullError
from ws_events    import EVENT_NEW_ALERT, EVENT_CONNECTED, EVENT_STATS_UPDATE

# ── App + SocketIO ────────────────────────────────────────────────────────────

app = Flask(__name__)
app.json.sort_keys = False

socketio = SocketIO(
    app,
    cors_allowed_origins="*",      # tighten in production
    async_mode="threading",
    logger=True,
    engineio_logger=True,
)

# Give the writer access to socketio so it can broadcast new_alert events
writer.register_socketio(socketio)


# ── HTTP Routes ───────────────────────────────────────────────────────────────

@app.route("/ingest", methods=["POST"])
def ingest():
    """Ingest a single log event (non-blocking — returns 202 immediately)."""
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Missing or invalid JSON body"}), 400

    try:
        event = LogEvent.from_dict(data)
    except Exception as exc:
        return jsonify({"error": f"Invalid log schema: {exc}"}), 400

    # Persist raw log to MongoDB
    try:
        log_doc = event.to_dict()
        logs_col.insert_one(log_doc)
    except Exception:
        pass  # non-fatal — don't block ingestion if log storage fails

    # Enqueue for async rule evaluation
    try:
        ingestion_queue.enqueue(event)
    except QueueFullError as exc:
        return jsonify({"error": str(exc)}), 429

    return jsonify({
        "accepted":       True,
        "event_id":       event.event_id,
        "rules_available": len(RULES),
        "queue_depth":    ingestion_queue.depth,
    }), 202


@app.route("/ingest/batch", methods=["POST"])
def ingest_batch():
    """
    Bulk ingest — accepts a JSON array of log events.
    All events are enqueued and processed asynchronously.
    Returns 202 immediately so senders are never blocked.
    """
    data = request.get_json(silent=True)
    if not data or not isinstance(data, list):
        return jsonify({"error": "Expected a JSON array of log events"}), 400

    events    = []
    bad_count = 0

    for item in data:
        try:
            events.append(LogEvent.from_dict(item))
        except Exception:
            bad_count += 1

    if not events:
        return jsonify({"error": "No valid log events in batch"}), 400

    # Bulk-store raw logs to MongoDB (fire-and-forget, ignore duplicates)
    try:
        docs = [e.to_dict() for e in events]
        logs_col.insert_many(docs, ordered=False)
    except Exception:
        pass  # non-fatal

    # Bulk-enqueue for async rule evaluation
    accepted = ingestion_queue.enqueue_many(events)

    return jsonify({
        "accepted":     accepted,
        "rejected":     len(events) - accepted,
        "bad_schema":   bad_count,
        "total_sent":   len(data),
        "queue_depth":  ingestion_queue.depth,
    }), 202


@app.route("/alerts", methods=["GET"])
def get_alerts():
    """Query stored alerts with optional filters."""
    severity = request.args.get("severity")
    rule_id  = request.args.get("rule_id")
    ip       = request.args.get("ip")
    limit    = min(int(request.args.get("limit", 100)), 1000)

    alerts = writer.read_all(limit=limit, severity=severity, rule_id=rule_id, ip=ip)
    return jsonify({"total": len(alerts), "alerts": alerts})


@app.route("/summary", methods=["GET"])
def summary():
    """Alert statistics aggregated from MongoDB."""
    return jsonify(writer.stats())


@app.route("/health", methods=["GET"])
def health():
    """Liveness check — includes DB connectivity and queue depth."""
    db_ok = db_ping()
    return jsonify({
        "status":       "ok",
        "db":           "connected" if db_ok else "unreachable",
        "queue_depth":  ingestion_queue.depth,
        "queue_stats":  ingestion_queue.stats,
    }), 200


# ── WebSocket Handlers ────────────────────────────────────────────────────────

@socketio.on("connect")
def handle_connect():
    """Confirm connection and push initial stats snapshot."""
    stats = writer.stats()
    emit(EVENT_CONNECTED, {
        "message":     "Connected to SmartSIEM Rule Engine",
        "alert_stats": stats,
        "queue_stats": ingestion_queue.stats,
    })
    print(f"[SmartSIEM][ws] Client connected: {request.sid}")


@socketio.on("disconnect")
def handle_disconnect():
    print(f"[SmartSIEM][ws] Client disconnected: {request.sid}")


@socketio.on("get_stats")
def handle_get_stats():
    """Client can request a fresh stats snapshot at any time."""
    emit(EVENT_STATS_UPDATE, {
        "alert_stats": writer.stats(),
        "queue_stats": ingestion_queue.stats,
    })


# ── Entry Point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    port  = int(os.getenv("PORT",  "5000"))
    debug = os.getenv("DEBUG", "false").lower() == "true"

    print(f"[SmartSIEM] Rule engine starting on :{port}  (debug={debug})")
    print(f"[SmartSIEM] WebSocket transport: threading")

    socketio.run(
        app,
        host="0.0.0.0",
        port=port,
        debug=debug,
        use_reloader=False,   # reloader conflicts with our thread pool
    )
