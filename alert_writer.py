import json
import os
import threading
import time
from typing import List, Dict, Tuple
from models import SecurityAlert

class AlertWriter:
    def __init__(self, filename="alerts.json"):
        self.filename = filename
        self._lock = threading.Lock()
        self._last_written: Dict[Tuple[str, str], float] = {}
        self._suppressed_count = 0
        self._total_alerts = 0
        self._by_severity: Dict[str, int] = {"LOW": 0, "MEDIUM": 0, "HIGH": 0, "CRITICAL": 0}
        self._by_rule: Dict[str, int] = {}
        
        # Ensure file exists
        with self._lock:
            if not os.path.exists(self.filename):
                with open(self.filename, 'w') as f:
                    json.dump([], f)

    def write(self, alert: SecurityAlert) -> bool:
        now = time.time()
        dedup_key = (alert.rule_id, alert.ip)
        
        with self._lock:
            last_time = self._last_written.get(dedup_key, 0)
            if now - last_time < 30:
                self._suppressed_count += 1
                return False # Suppressed
                
            self._last_written[dedup_key] = now
            self._total_alerts += 1
            self._by_severity[alert.severity] = self._by_severity.get(alert.severity, 0) + 1
            self._by_rule[alert.rule_id] = self._by_rule.get(alert.rule_id, 0) + 1
            
            # Read, append, write (simple append-only logic for this demo)
            try:
                with open(self.filename, 'r') as f:
                    data = json.load(f)
            except (json.JSONDecodeError, FileNotFoundError):
                data = []
                
            data.append(alert.to_dict())
            
            with open(self.filename, 'w') as f:
                json.dump(data, f, indent=2)
                
            return True

    def write_many(self, alerts: List[SecurityAlert]) -> List[SecurityAlert]:
        written = []
        for alert in alerts:
            if self.write(alert):
                written.append(alert)
        return written

    def read_all(self) -> List[dict]:
        with self._lock:
            try:
                with open(self.filename, 'r') as f:
                    return json.load(f)
            except (json.JSONDecodeError, FileNotFoundError):
                return []

    def stats(self) -> dict:
        with self._lock:
            return {
                "total_alerts": self._total_alerts,
                "suppressed": self._suppressed_count,
                "by_severity": self._by_severity,
                "by_rule": self._by_rule
            }

writer = AlertWriter()
