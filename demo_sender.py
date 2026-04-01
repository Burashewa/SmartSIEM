import argparse
import json
import random
import time
import urllib.request
import urllib.error
from datetime import datetime, timezone

BASE_URL = "http://localhost:5000"

def post(host: str, payload: dict) -> dict | None:
    url = f"{host}/ingest"
    body = json.dumps(payload).encode()
    req = urllib.request.Request(
        url, data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            return json.loads(resp.read())
    except urllib.error.URLError as exc:
        print(f"  [!] POST failed: {exc.reason}")
        return None

def send(host: str, payload: dict, label: str = "") -> None:
    result = post(host, payload)
    if result:
        fired = result.get("alerts_fired", 0)
        mark = "ALERT" if fired else "     "
        event_name = label or payload.get('event', payload.get('action', 'Unknown'))
        print(f"  [{mark}] {event_name[:30]:30s}  alerts={fired}")

# SCENARIOS
def brute_force(host: str) -> None:
    print("\n[scenario] Brute-force login")
    for i in range(7):
        send(host, {"event": "authentication", "action": "login", "status": "failed", "ip": "10.10.10.10", "user": "admin"}, f"AUTH_FAIL #{i+1}")
        time.sleep(0.2)

def credential_stuffing(host: str) -> None:
    print("\n[scenario] Credential stuffing")
    for u in [f"user{i}" for i in range(25)]:
        send(host, {"event": "authentication", "action": "login", "status": "failed", "ip": "10.10.10.20", "user": u}, f"AUTH_FAIL user={u}")
        time.sleep(0.05)

def account_takeover(host: str) -> None:
    print("\n[scenario] Account takeover")
    for i in range(4):
        send(host, {"event": "authentication", "action": "login", "status": "failed", "ip": "10.10.10.30", "user": "alice"}, f"AUTH_FAIL #{i+1}")
        time.sleep(0.15)
    send(host, {"event": "authentication", "action": "login", "status": "success", "ip": "10.10.10.30", "user": "alice"}, "AUTH_OK (takeover!)")

def off_hours_login(host: str) -> None:
    print("\n[scenario] Off-hours login")
    send(host, {"event": "authentication", "action": "login", "status": "success", "ip": "10.10.10.40", "user": "bob"}, "AUTH_OK off-hours")

def port_scan(host: str) -> None:
    print("\n[scenario] Port scan / API abuse scan")
    for port in range(20, 37):
        send(host, {"event": "network", "status": "refused", "ip": "172.16.0.50"}, f"CONN_REFUSED port={port}")
        time.sleep(0.1)

def ddos_flood(host: str) -> None:
    print("\n[scenario] DDoS flood (200+ requests in 10s)")
    for i in range(210):
        send(host, {"event": "request", "ip": "203.0.113.5", "endpoint": "/"}, f"HTTP_REQUEST #{i+1}")
        time.sleep(0.01)

def malicious_ip(host: str) -> None:
    print("\n[scenario] Known malicious IP")
    send(host, {"event": "authentication", "action": "login", "ip": "10.0.0.99"}, "Event from blocklisted IP")

def admin_panel_scan(host: str) -> None:
    print("\n[scenario] Admin panel scan")
    for path in ["/admin", "/wp-admin", "/.env", "/config", "/phpmyadmin", "/console"]:
        send(host, {"event": "request", "ip": "198.51.100.7", "endpoint": path}, f"HTTP_REQ path={path}")
        time.sleep(0.1)

def privilege_escalation(host: str) -> None:
    print("\n[scenario] Privilege escalation")
    send(host, {"event": "account", "action": "role_change", "ip": "192.168.1.77", "metadata": {"old_role": "viewer", "new_role": "admin"}}, "ROLE_CHANGE -> admin")

def sensitive_file_read(host: str) -> None:
    print("\n[scenario] Sensitive file read")
    send(host, {"event": "file_access", "action": "read", "ip": "192.168.1.88", "endpoint": "/etc/shadow"}, "FILE_ACCESS /etc/shadow")

def suspicious_location(host: str) -> None:
    print("\n[scenario] Suspicious location")
    send(host, {"event": "request", "ip": "192.168.2.10", "latitude": 90.03, "longitude": 38.74}, "Suspicious location lat=90.03")

def error_burst(host: str) -> None:
    print("\n[scenario] Application error burst")
    for i in range(12):
        send(host, {"event": "application", "status": "error", "ip": "192.168.1.5"}, f"APP_ERROR #{i+1}")
        time.sleep(0.2)

def critical_exception(host: str) -> None:
    print("\n[scenario] Critical exception")
    send(host, {"event": "application", "status": "error", "ip": "192.168.1.5", "severity": "critical"}, "APP_EXCEPTION severity=critical")

def memory_exhaustion(host: str) -> None:
    print("\n[scenario] Memory exhaustion")
    send(host, {"event": "system", "ip": "192.168.1.100", "metadata": {"mem_pct": 97, "cpu_pct": 60}}, "SYS_RESOURCE mem_pct=97")

def web_attack(host: str) -> None:
    print("\n[scenario] Web Attack")
    send(host, {"event": "request", "ip": "192.168.1.101", "payload": {"username": "admin", "password": "' OR 1=1 --"}}, "Web Attack")

SCENARIOS: dict[str, callable] = {
    "brute_force":         brute_force,
    "credential_stuffing": credential_stuffing,
    "account_takeover":    account_takeover,
    "off_hours_login":     off_hours_login,
    "port_scan":           port_scan,
    "ddos_flood":          ddos_flood,
    "malicious_ip":        malicious_ip,
    "admin_panel_scan":    admin_panel_scan,
    "privilege_escalation": privilege_escalation,
    "sensitive_file_read": sensitive_file_read,
    "suspicious_location": suspicious_location,
    "error_burst":         error_burst,
    "critical_exception":  critical_exception,
    "memory_exhaustion":   memory_exhaustion,
    "web_attack":          web_attack,
}

def run_all(host: str) -> None:
    for name, fn in SCENARIOS.items():
        fn(host)
        time.sleep(1)

def main() -> None:
    parser = argparse.ArgumentParser(description="SmartSIEM demo log sender")
    parser.add_argument("--host", default=BASE_URL, help="Rule engine base URL")
    parser.add_argument("--scenario", choices=list(SCENARIOS), default=None)
    parser.add_argument("--once", action="store_true", help="Run once and exit")
    args = parser.parse_args()

    print(f"[demo_sender] Target: {args.host}")
    print(f"[demo_sender] Scenarios: {args.scenario or 'ALL'}\n")

    def _run_once():
        if args.scenario:
            SCENARIOS[args.scenario](args.host)
        else:
            run_all(args.host)

    _run_once()
    if not args.once:
        print("\n[demo_sender] Looping — Ctrl+C to stop")
        while True:
            time.sleep(15)
            _run_once()

if __name__ == "__main__":
    main()
