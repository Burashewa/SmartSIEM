import sys
import unittest
from unittest.mock import patch
import json
import time

# Ensure it's run from within the directory
from app import app
from models import LogEvent, SecurityAlert
from engine import evaluate
from alert_writer import writer, AlertWriter
from window import window, sequence

class SmokeTest(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()
        # Reset state
        window._buckets.clear()
        sequence._first_events.clear()
        # Use an in-memory test file for writer
        self.test_file = "test_alerts.json"
        
        # Write to test writer and update global
        import alert_writer
        self.orig_writer = alert_writer.writer
        self.test_writer = AlertWriter(self.test_file)
        alert_writer.writer = self.test_writer

    def tearDown(self):
        import os
        if os.path.exists(self.test_file):
            os.remove(self.test_file)
        import alert_writer
        alert_writer.writer = self.orig_writer

    def _eval_and_get(self, event_dict):
        event = LogEvent.from_dict(event_dict)
        return evaluate(event)
        
    def test_r01_brute_force(self):
        alerts = []
        for i in range(6):
            res = self._eval_and_get({"event": "authentication", "action": "login", "status": "failed", "ip": "1.1.1.1"})
            alerts.extend(res)
        self.assertTrue(any(a.rule_id == "R01" for a in alerts))

    def test_r02_cred_stuffing(self):
        alerts = []
        for i in range(21):
            res = self._eval_and_get({"event": "authentication", "action": "login", "status": "failed", "ip": "2.2.2.2", "user": f"u{i}"})
            alerts.extend(res)
        
        r02_alerts = [a for a in alerts if a.rule_id == "R02"]
        self.assertGreaterEqual(len(r02_alerts), 1)

    def test_r03_sequence_account_takeover(self):
        alerts = []
        for i in range(4):
            alerts.extend(self._eval_and_get({"event": "authentication", "action": "login", "status": "failed", "ip": "3.3.3.3"}))
        res = self._eval_and_get({"event": "authentication", "action": "login", "status": "success", "ip": "3.3.3.3"})
        alerts.extend(res)
        self.assertTrue(any(a.rule_id == "R03" for a in alerts))

    @patch('engine.datetime')
    def test_r04_off_hours(self, mock_datetime):
        from datetime import datetime
        # Mock UTC time to be 23:00 (outside 06-22)
        mock_now = datetime(2025, 1, 1, 23, 0, 0)
        mock_datetime.now.return_value = mock_now
        
        res = self._eval_and_get({"event": "authentication", "action": "login", "status": "success", "ip": "4.4.4.4"})
        self.assertTrue(any(a.rule_id == "R04" for a in res))

    def test_r08_blocklist(self):
        res = self._eval_and_get({"event": "custom", "ip": "10.0.0.99"})
        self.assertTrue(any(a.rule_id == "R08" for a in res))

    def test_r13_priv_esc(self):
        res = self._eval_and_get({"event": "account", "action": "role_change", "ip": "1.2.3.4", "metadata": {"new_role": "admin"}})
        self.assertTrue(any(a.rule_id == "R13" for a in res))

    def test_r14_sensitive_file(self):
        res = self._eval_and_get({"event": "file_access", "action": "read", "ip": "1.2.3.4", "endpoint": "/etc/shadow"})
        self.assertTrue(any(a.rule_id == "R14" for a in res))
        
    def test_r17_critical_exception(self):
        res = self._eval_and_get({"event": "application", "status": "error", "ip": "1.2.3.4", "severity": "critical"})
        self.assertTrue(any(a.rule_id == "R17" for a in res))

    def test_r19_session_hijacking(self):
        alerts = []
        alerts.extend(self._eval_and_get({"event": "authentication", "sessionId": "s1", "ip": "1.1.1.1"}))
        res = self._eval_and_get({"event": "authentication", "sessionId": "s1", "ip": "2.2.2.2"})
        alerts.extend(res)
        self.assertTrue(any(a.rule_id == "R19" for a in alerts))

    def test_alert_writer_dedup(self):
        alert1 = SecurityAlert(rule_id="R01", rule_name="Test", severity="HIGH", ip="1.2.3.4", event="authentication", message="", recommendation="", linked_event_ids=[])
        alert2 = SecurityAlert(rule_id="R01", rule_name="Test", severity="HIGH", ip="1.2.3.4", event="authentication", message="", recommendation="", linked_event_ids=[])
        
        # First write succeeds
        self.assertTrue(self.test_writer.write(alert1))
        # Second write is suppressed within 30s
        self.assertFalse(self.test_writer.write(alert2))
        
        stats = self.test_writer.stats()
        self.assertEqual(stats["suppressed"], 1)

    def test_flask_ingest(self):
        resp = self.client.post('/ingest', json={
            "event": "authentication",
            "action": "login",
            "status": "failed",
            "ip": "1.2.3.4"
        })
        self.assertEqual(resp.status_code, 200)
        data = resp.get_json()
        self.assertIn("event_id", data)

    def test_flask_health(self):
        resp = self.client.get('/health')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.get_json(), {"status": "ok"})
        
    def test_flask_alerts(self):
        # ensure there is at least one alert to test properly
        alert = SecurityAlert("R99", "Test", "LOW", "1.1.1.1", "T", "", "", [])
        self.test_writer.write(alert)
        
        resp = self.client.get('/alerts')
        self.assertEqual(resp.status_code, 200)
        data = resp.get_json()
        self.assertIn("total", data)
        self.assertIn("alerts", data)

    def test_flask_summary(self):
        resp = self.client.get('/summary')
        self.assertEqual(resp.status_code, 200)
        data = resp.get_json()
        self.assertIn("total_alerts", data)

if __name__ == '__main__':
    result = unittest.TextTestRunner(verbosity=2).run(unittest.TestLoader().loadTestsFromTestCase(SmokeTest))
    if result.wasSuccessful():
        print("PASS")
        sys.exit(0)
    else:
        print("FAIL")
        sys.exit(1)
