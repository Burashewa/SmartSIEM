#!/usr/bin/env python3
"""
POST sample logs to the SmartSIEM Collector HTTP API (/ingest) for end-to-end checks:
collector -> parse/normalize/enrich -> Kafka -> detection-worker.

Exercises **default detection-worker behavior** (same targets as ``detection-worker/test-send-logs.js``):

**Mongo-backed / default rules** (see ``detection-worker/src/rules/ruleLoader.js``):

- ``rule-auth-bruteforce-60s-5`` — AUTH_FAIL threshold (``source_ip`` + ``username``)
- ``rule-proc-powershell-encoded`` — PROC_CREATE pattern on ``command_line``
- ``rule-procaccess-lsass`` — PROC_ACCESS pattern on ``target_process``
- ``rule-dns-entropy-suspicious`` — DNS_QUERY statistical (entropy + length on ``query``)
- ``rule-filemod-ransomware-burst`` — FILE_MODIFY threshold on ``username``

**Built-in engine logic** (not in the rules collection):

- ``seq-001`` / ``seq-002`` — sequence detector (``detection-worker/src/detection/sequence.js``)
- ``ti-001`` — threat intel IOC match (``detection-worker/src/detection/threatIntel.js``)

**Not covered from HTTP ingest**: hourly ring-buffer anomaly ``stat-001`` needs ~168 hours of
``runHourlyStats`` baseline per source IP before z-score alerts can fire.

Prerequisites
-------------
- Collector running (e.g. ``python main.py`` from SmartSIEM-Collector).
- ``QUEUE_OUTPUT`` includes ``kafka``; Kafka broker reachable; topic matches worker ``RAW_LOGS_TOPIC``.
- Optional: detection worker on ``http://127.0.0.1:4000`` to observe ``totalEventsProcessed`` / ``totalAlertsGenerated``.

Usage::

    python scripts/send_test_logs_to_collector.py
    python scripts/send_test_logs_to_collector.py --base-url http://127.0.0.1:8080
    python scripts/send_test_logs_to_collector.py --worker-url http://127.0.0.1:4000
    python scripts/send_test_logs_to_collector.py --file-mod-count 100 --delay-ms 50
"""

from __future__ import annotations

import argparse
import json
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone


def iso_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _request_json(
    url: str,
    *,
    method: str = "GET",
    data: bytes | None = None,
    headers: dict[str, str] | None = None,
    timeout: float = 15.0,
) -> tuple[int, object | None]:
    req = urllib.request.Request(url, data=data, method=method, headers=headers or {})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            body = resp.read().decode("utf-8", errors="replace")
            status = resp.status
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace") if exc.fp else ""
        status = exc.code
        return status, body
    try:
        return status, json.loads(body) if body.strip() else None
    except json.JSONDecodeError:
        return status, body


def post_ingest(base_url: str, payload: object) -> tuple[int, str]:
    """POST a JSON object or array to /ingest."""
    raw = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    url = f"{base_url.rstrip('/')}/ingest"
    req = urllib.request.Request(url, data=raw, method="POST", headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            return resp.status, resp.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace") if exc.fp else ""
        return exc.code, body


def get_collector_health(base_url: str) -> tuple[int, object | str | None]:
    return _request_json(f"{base_url.rstrip('/')}/health", method="GET")


def get_worker_stats(worker_url: str) -> tuple[int, object | str | None]:
    return _request_json(f"{worker_url.rstrip('/')}/stats", method="GET")


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Send test logs through the collector to exercise detection-worker rules"
    )
    parser.add_argument(
        "--base-url",
        default="http://127.0.0.1:8080",
        help="Collector HTTP base URL (default: %(default)s)",
    )
    parser.add_argument(
        "--worker-url",
        default="http://127.0.0.1:4000",
        help="Detection worker base URL for before/after /stats (default: %(default)s)",
    )
    parser.add_argument("--delay-ms", type=int, default=120, help="Pause between single-log POSTs (default %(default)s)")
    parser.add_argument(
        "--file-mod-count",
        type=int,
        default=100,
        help="FILE_MODIFY events for ransomware-burst rule (default %(default)s, must be >= 100 for default rule)",
    )
    args = parser.parse_args()
    base = args.base_url.rstrip("/")
    delay = max(0, args.delay_ms) / 1000.0
    file_mod_n = max(1, args.file_mod_count)

    print(f"[send-test] collector health: GET {base}/health")
    code, health = get_collector_health(base)
    print(f"[send-test] collector health -> HTTP {code}: {health}")
    if code != 200:
        print("[send-test] fix collector URL or start main.py", file=sys.stderr)
        return 1

    worker_before = None
    if args.worker_url:
        wc, worker_before = get_worker_stats(args.worker_url.rstrip("/"))
        print(f"[send-test] worker /stats (before) HTTP {wc}: {worker_before}")

    def send(label: str, payload: object) -> None:
        try:
            status, body = post_ingest(base, payload)
            tail = body[:200] + ("…" if len(body) > 200 else "")
            print(f"[send-test] {label} -> HTTP {status}: {tail!r}")
        except urllib.error.URLError as exc:
            print(f"[send-test] {label} FAILED: {exc}", file=sys.stderr)
            raise

    def send_many(label: str, payloads: list[dict[str, object]]) -> None:
        """Single HTTP request with a JSON array (collector processes each element)."""
        try:
            status, body = post_ingest(base, payloads)
            tail = body[:200] + ("…" if len(body) > 200 else "")
            print(f"[send-test] {label} ({len(payloads)} logs) -> HTTP {status}: {tail!r}")
        except urllib.error.URLError as exc:
            print(f"[send-test] {label} FAILED: {exc}", file=sys.stderr)
            raise

    # --- 1) Threshold: rule-auth-bruteforce-60s-5 (needs fresh timestamps + username for key_fields) ---
    print("\n[send-test] rule-auth-bruteforce-60s-5: 5+ AUTH_FAIL (same source_ip + username)")
    for i in range(6):
        send(
            f"AUTH_FAIL {i + 1}/6",
            {
                "event_type": "AUTH_FAIL",
                "source_ip": "10.0.0.99",
                "username": "admin",
                "timestamp": iso_now(),
                "reason": "invalid_password",
                "attempt": i + 1,
            },
        )
        time.sleep(delay)

    # --- 2) Sequence seq-001: AUTH_FAIL then AUTH_SUCCESS (same IP + user) ---
    print("\n[send-test] seq-001: AUTH_FAIL then AUTH_SUCCESS (brute force then success)")
    send(
        "seq-001 AUTH_FAIL",
        {
            "event_type": "AUTH_FAIL",
            "source_ip": "10.0.0.98",
            "username": "sequser",
            "timestamp": iso_now(),
            "reason": "invalid_password",
        },
    )
    time.sleep(delay)
    send(
        "seq-001 AUTH_SUCCESS",
        {
            "event_type": "AUTH_SUCCESS",
            "source_ip": "10.0.0.98",
            "username": "sequser",
            "timestamp": iso_now(),
            "method": "password",
        },
    )
    time.sleep(delay)

    # --- 3) Sequence seq-002: NET_CONN (powershell) then TASK_CREATE ---
    print("\n[send-test] seq-002: NET_CONN (powershell) then TASK_CREATE")
    send(
        "seq-002 NET_CONN",
        {
            "event_type": "NET_CONN",
            "source_ip": "10.0.0.97",
            "timestamp": iso_now(),
            "process": {"name": "powershell.exe", "command_line": "powershell.exe -NoLogo"},
            "destination_ip": "93.184.216.34",
        },
    )
    time.sleep(delay)
    send(
        "seq-002 TASK_CREATE",
        {
            "event_type": "TASK_CREATE",
            "source_ip": "10.0.0.97",
            "username": "SYSTEM",
            "timestamp": iso_now(),
            "task_name": "\\Microsoft\\Windows\\Exploit",
        },
    )
    time.sleep(delay)

    # --- 4) Pattern: rule-proc-powershell-encoded ---
    print("\n[send-test] rule-proc-powershell-encoded: PROC_CREATE -EncodedCommand")
    send(
        "PROC_CREATE encoded",
        {
            "event_type": "PROC_CREATE",
            "source_ip": "10.0.0.50",
            "username": "jdoe",
            "timestamp": iso_now(),
            "process": {
                "command_line": (
                    "powershell.exe -NoProfile -EncodedCommand SGVsbG9Xb3JsZDEyMzQ1Njc4OTA="
                )
            },
        },
    )
    time.sleep(delay)

    # --- 5) Pattern: rule-procaccess-lsass ---
    print("\n[send-test] rule-procaccess-lsass: PROC_ACCESS target_process lsass.exe")
    send(
        "PROC_ACCESS lsass",
        {
            "event_type": "PROC_ACCESS",
            "source_ip": "10.0.0.51",
            "username": "SYSTEM",
            "timestamp": iso_now(),
            "target_process": "lsass.exe",
            "granted_access": "PROCESS_VM_READ",
        },
    )
    time.sleep(delay)

    # --- 6) Statistical: rule-dns-entropy-suspicious (high entropy + length > 25) ---
    print("\n[send-test] rule-dns-entropy-suspicious: DNS_QUERY high-entropy query")
    high_entropy_queries = [
        "xK9mPq2vL8nR4tY7wZ3bC6fH1jM5sA0uD9eG2hJ4kN8pQwRtYzVx.cfd",
        "Zq4Wn8Rt2Yp6Ls1Hv9Mx3Bc7Df0Jg5Nk8Pm2Qs6Tu0Vy4Xz8Ab.cfd",
    ]
    for idx, query in enumerate(high_entropy_queries):
        send(
            f"DNS_QUERY entropy {idx + 1}/{len(high_entropy_queries)}",
            {
                "event_type": "DNS_QUERY",
                "source_ip": "10.0.0.52",
                "username": "workstation-01",
                "timestamp": iso_now(),
                "query": query,
            },
        )
        time.sleep(delay)

    # --- 7) Threat intel ti-001: malicious source IP (DEFAULT_IOCS) ---
    print("\n[send-test] ti-001: source_ip in default IOC list (203.0.113.10)")
    send(
        "THREAT_INTEL bad IP",
        {
            "event_type": "NET_CONN",
            "source_ip": "203.0.113.10",
            "username": "unknown",
            "timestamp": iso_now(),
            "destination_ip": "10.0.0.1",
        },
    )
    time.sleep(delay)

    # --- 8) Threat intel ti-001: malicious domain on query ---
    print("\n[send-test] ti-001: query in default IOC domain list (malicious-example.com)")
    send(
        "THREAT_INTEL bad domain",
        {
            "event_type": "DNS_QUERY",
            "source_ip": "10.0.0.55",
            "timestamp": iso_now(),
            "query": "malicious-example.com",
        },
    )
    time.sleep(delay)

    # --- 9) Syslog samples (collector parsers / normalization path) ---
    print("\n[send-test] parser path: SSH failed password (syslog message)")
    send(
        "ssh_failed_password",
        {
            "message": "Failed password for admin from 198.51.100.5 port 22 ssh2",
            "hostname": "web01",
            "timestamp": iso_now(),
        },
    )
    time.sleep(delay)

    print("\n[send-test] parser path: Kali syslog + SSH fail")
    send(
        "kali_syslog_ssh",
        {
            "message": (
                f"{iso_now().replace('Z', '+00:00')} kali sshd[1234]: "
                "Failed password for root from 198.51.100.5 port 2222 ssh2"
            ),
        },
    )
    time.sleep(delay)

    print("\n[send-test] parser path: Apache combined access log")
    send(
        "apache_combined",
        {
            "message": (
                '203.0.113.50 - - [03/May/2026:12:04:00 +0000] "GET /admin HTTP/1.1" 404 123 '
                '"-" "Mozilla/5.0"'
            ),
        },
    )
    time.sleep(delay)

    # --- 10) Threshold: rule-filemod-ransomware-burst (>=100 FILE_MODIFY same username in 300s) ---
    print(f"\n[send-test] rule-filemod-ransomware-burst: {file_mod_n} FILE_MODIFY (same username)")
    ransom_user = r"corp\victim_user"
    batch: list[dict[str, object]] = []
    for i in range(file_mod_n):
        batch.append(
            {
                "event_type": "FILE_MODIFY",
                "source_ip": "10.0.0.53",
                "username": ransom_user,
                "timestamp": iso_now(),
                "path": rf"C:\Users\Public\Documents\file_{i}.dat.enc",
                "operation": "write",
            }
        )
    # Chunk to avoid huge single HTTP bodies on constrained setups
    chunk_size = 50
    for start in range(0, len(batch), chunk_size):
        chunk = batch[start : start + chunk_size]
        send_many(f"FILE_MODIFY batch {start + 1}-{start + len(chunk)}", chunk)
        time.sleep(max(delay, 0.05))

    print("\n[send-test] done posting to collector.")
    print("  - Default worker rules: auth bruteforce, PowerShell encoded, LSASS access, DNS entropy, file-mod burst.")
    print("  - Built-ins: seq-001, seq-002, threat intel ti-001.")
    print("  - Hourly statistical anomaly stat-001 is not triggered from a single ingest run.")

    if args.worker_url:
        time.sleep(2.0)
        wc2, worker_after = get_worker_stats(args.worker_url.rstrip("/"))
        print(f"\n[send-test] worker /stats (after) HTTP {wc2}: {worker_after}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
