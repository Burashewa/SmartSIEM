import os
from flask import Flask, request, jsonify
from models import LogEvent
from engine import evaluate
from alert_writer import writer
from rules import RULES

app = Flask(__name__)
app.json.sort_keys = False

@app.route("/ingest", methods=["POST"])
def ingest():
    data = request.get_json()
    if not data:
        return jsonify({"error": "Missing JSON body"}), 400
        
    try:
        event = LogEvent.from_dict(data)
    except KeyError as e:
        return jsonify({"error": str(e)}), 400
        
    alerts_fired = evaluate(event)
    alerts_written = writer.write_many(alerts_fired)
    
    return jsonify({
        "event_id": event.event_id,
        "rules_evaluated": len(RULES),
        "alerts_fired": len(alerts_fired),
        "alerts_written": len(alerts_written),
        "alert_ids": [a.alert_id for a in alerts_written]
    })

@app.route("/alerts", methods=["GET"])
def get_alerts():
    severity = request.args.get("severity")
    rule_id = request.args.get("rule_id")
    ip = request.args.get("ip")
    limit = int(request.args.get("limit", 100))
    
    alerts = writer.read_all()
    # Reverse to get most-recent-first
    alerts.reverse()
    
    filtered = []
    for a in alerts:
        if severity and a.get("severity") != severity:
            continue
        if rule_id and a.get("rule_id") != rule_id:
            continue
        if ip and a.get("ip") != ip:
            continue
        filtered.append(a)
        if len(filtered) >= limit:
            break
            
    return jsonify({
        "total": len(filtered),
        "alerts": filtered
    })

@app.route("/summary", methods=["GET"])
def summary():
    return jsonify(writer.stats())

@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"}), 200

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    debug = os.environ.get("DEBUG", "false").lower() == "true"
    print(f"[SmartSIEM] Rule engine listening on :{port}")
    app.run(host="0.0.0.0", port=port, debug=debug)
