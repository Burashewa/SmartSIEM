"""
Run every default detection-worker alert path via the collector HTTP API.

Covers Mongo-backed rules (ruleLoader defaults), built-in sequence (seq-001, seq-002),
and threat intel (ti-001). Does not cover hourly statistical anomaly stat-001.
"""

from __future__ import annotations

import sys
import time
import urllib.error

from collector_ingest_client import (
    get_collector_health,
    get_worker_stats,
    iso_now,
    post_ingest,
    to_new_contract_event,
)


def run_all_alert_scenarios(
    *,
    base_url: str,
    delay_ms: int,
    file_mod_count: int,
    worker_url: str | None,
) -> int:
    """
    POST scenarios to the collector. Returns 0 on success, 1 if collector health fails.
    """
    base = base_url.rstrip("/")
    delay = max(0, delay_ms) / 1000.0
    file_mod_n = max(1, file_mod_count)

    print(f"[alerts] collector health: GET {base}/health")
    code, health = get_collector_health(base)
    print(f"[alerts] collector health -> HTTP {code}: {health}")
    if code != 200:
        print("[alerts] fix collector URL or start main.py", file=sys.stderr)
        return 1

    worker_before = None
    if worker_url:
        wc, worker_before = get_worker_stats(worker_url.rstrip("/"))
        print(f"[alerts] worker /stats (before) HTTP {wc}: {worker_before}")

    def send(label: str, payload: object) -> None:
        try:
            normalized_payload = (
                to_new_contract_event(payload) if isinstance(payload, dict) else payload
            )
            status, body = post_ingest(base, normalized_payload)
            tail = body[:200] + ("…" if len(body) > 200 else "")
            print(f"[alerts] {label} -> HTTP {status}: {tail!r}")
        except urllib.error.URLError as exc:
            print(f"[alerts] {label} FAILED: {exc}", file=sys.stderr)
            raise

    def send_many(label: str, payloads: list[dict[str, object]]) -> None:
        try:
            status, body = post_ingest(base, [to_new_contract_event(p) for p in payloads])
            tail = body[:200] + ("…" if len(body) > 200 else "")
            print(f"[alerts] {label} ({len(payloads)} logs) -> HTTP {status}: {tail!r}")
        except urllib.error.URLError as exc:
            print(f"[alerts] {label} FAILED: {exc}", file=sys.stderr)
            raise

    # --- 1) rule-auth-bruteforce-60s-5 ---
    print("\n[alerts] rule-auth-bruteforce-60s-5: 6x AUTH_FAIL (same source_ip + username)")
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

    # --- 2) seq-001: multiple AUTH_FAIL then AUTH_SUCCESS (same IP + user) ---
    print("\n[alerts] seq-001: AUTH_FAIL burst then AUTH_SUCCESS")
    for i in range(5):
        send(
            f"seq-001 AUTH_FAIL {i + 1}/5",
            {
                "event_type": "AUTH_FAIL",
                "source_ip": "10.0.0.98",
                "username": "sequser",
                "timestamp": iso_now(),
                "reason": "invalid_password",
                "attempt": i + 1,
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

    # --- 3) seq-002 ---
    print("\n[alerts] seq-002: NET_CONN (powershell) then TASK_CREATE")
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

    # --- 4) rule-proc-powershell-encoded ---
    print("\n[alerts] rule-proc-powershell-encoded: PROC_CREATE -EncodedCommand")
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

    # --- 5) rule-procaccess-lsass ---
    print("\n[alerts] rule-procaccess-lsass: PROC_ACCESS lsass.exe")
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

    # --- 6) rule-dns-entropy-suspicious ---
    print("\n[alerts] rule-dns-entropy-suspicious: high-entropy DNS queries")
    high_entropy_queries = [
        "xK9mPq2vL8nR4tY7wZ3bC6fH1jM5sA0uD9eG2hJ4kN8pQwRtYzVx.cfd",
        "Zq4Wn8Rt2Yp6Ls1Hv9Mx3Bc7Df0Jg5Nk8Pm2Qs6Tu0Vy4Xz8Ab.cfd",
        "mN7bV3cX9zL5kJ1hG6fD2sA8pO4iU0yT6rE3wQ9nM5bV1xZ7cK3jH9fD5.io",
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

    # --- 7) ti-001 bad IPs (all DEFAULT_IOCS ips) ---
    print("\n[alerts] ti-001: malicious source IPs (203.0.113.10, 198.51.100.23, 192.0.2.77)")
    for bad_ip in ("203.0.113.10", "198.51.100.23", "192.0.2.77"):
        send(
            f"THREAT_INTEL bad IP {bad_ip}",
            {
                "event_type": "NET_CONN",
                "source_ip": bad_ip,
                "username": "unknown",
                "timestamp": iso_now(),
                "destination_ip": "10.0.0.1",
            },
        )
        time.sleep(delay)

    # --- 8) ti-001 bad domains (all DEFAULT_IOCS domains) ---
    print("\n[alerts] ti-001: malicious-example.com, bad-domain.test, cnc.example.net")
    for domain in ("malicious-example.com", "bad-domain.test", "cnc.example.net"):
        send(
            f"THREAT_INTEL DNS {domain}",
            {
                "event_type": "DNS_QUERY",
                "source_ip": "10.0.0.55",
                "timestamp": iso_now(),
                "query": domain,
            },
        )
        time.sleep(delay)

    # --- 9) Parser samples (normalization path) ---
    print("\n[alerts] parser: SSH failed password")
    send(
        "ssh_failed_password",
        {
            "message": "Failed password for admin from 198.51.100.5 port 22 ssh2",
            "hostname": "web01",
            "timestamp": iso_now(),
        },
    )
    time.sleep(delay)

    print("\n[alerts] parser: Kali syslog + SSH fail")
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

    print("\n[alerts] parser: Apache combined")
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

    # --- 10) rule-filemod-ransomware-burst ---
    print(f"\n[alerts] rule-filemod-ransomware-burst: {file_mod_n} FILE_MODIFY (same username)")
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
    chunk_size = 50
    for start in range(0, len(batch), chunk_size):
        chunk = batch[start : start + chunk_size]
        send_many(f"FILE_MODIFY batch {start + 1}-{start + len(chunk)}", chunk)
        time.sleep(max(delay, 0.05))

    print("\n[alerts] done. Rules: auth threshold, PowerShell encoded, LSASS, DNS entropy, file-mod burst.")
    print("  Built-ins: seq-001, seq-002, ti-001 (all default IOC IPs/domains exercised for DNS).")
    print("  stat-001 (hourly z-score) is not triggered from a single run.")

    if worker_url:
        time.sleep(2.0)
        wc2, worker_after = get_worker_stats(worker_url.rstrip("/"))
        print(f"\n[alerts] worker /stats (after) HTTP {wc2}: {worker_after}")

    return 0
