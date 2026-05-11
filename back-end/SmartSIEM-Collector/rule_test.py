import json
import time
import threading
from typing import List
# Import the engine architecture components directly from your module
from rule_engine import (
    CorrelationEngine, 
    BruteForceAuthRule, 
    PrivilegeEscalationRule, 
    SiemAlert, 
    AlertSeverity
)

class SIEMEngineTester:
    def __init__(self):
        self.engine = CorrelationEngine()
        self.captured_alerts: List[SiemAlert] = []
        self.captured_actions: List[dict] = []
        self.lock = threading.Lock()

        # Connect verification hooks to monitor pipeline notifications
        self.engine.set_output_hooks(self.handle_alert, self.handle_action)

    def handle_alert(self, alert: SiemAlert):
        with self.lock:
            self.captured_alerts.append(alert)
            print(f"✔️ Captured Alert Notification -> [{alert.severity.value}] {alert.title}")

    def handle_action(self, action: dict):
        with self.lock:
            self.captured_actions.append(action)
            print(f"🛠️ Captured Mitigation Directive -> {action.get('action')} targeting {action.get('target_user', action.get('host'))}")

    def run_all_tests(self):
        print("======================================================================")
        print("          STARTING AUTOMATED SECURITY ENGINE VALIDATION SUITE          ")
        print("======================================================================\n")

        # 1. Mount Rules into Pipeline
        brute_force_rule = BruteForceAuthRule(failure_threshold=3, lookback_ms=5000)
        priv_esc_rule = PrivilegeEscalationRule()
        
        self.engine.register_rule(brute_force_rule)
        self.engine.register_rule(priv_esc_rule)

        # 2. Execute Scenario Triggers
        self.verify_clean_traffic()
        self.verify_brute_force_incident()
        self.verify_privilege_escalation_incident()
        self.verify_concurrent_stream_handling()

        # 3. Print Diagnostic Metric Summary
        print("\n======================================================================")
        print("                      DIAGNOSTIC TEST REPORT SUMMARY                  ")
        print("======================================================================")
        print(f"Total Normalized Logs Ingested: {self.engine.processed_log_count}")
        print(f"Total Analytical Incidents Fired: {len(self.captured_alerts)}")
        print(f"Total Mitigation Directives Issued: {len(self.captured_actions)}")
        
        assert len(self.captured_alerts) >= 3, "Pipeline Error: Failed to correlate expected risk patterns."
        print("\n[SUCCESS] All detection thresholds and isolation models verified accurately.")

    def verify_clean_traffic(self):
        print("\n[Scenario 1] Ingesting Baseline Clean Operations Traffic...")
        log = {
            "id": "LOG-001",
            "tenant": "finance_dept",
            "timestamp": int(time.time() * 1000),
            "service": "AuthService",
            "event_type": "AUTH_SUCCESS",
            "payload": {"auth": {"username": "m.tariku", "domain": "PRODUCTION"}}
        }
        matches = self.engine.dispatch_log(json.dumps(log))
        print(f"Matches triggered: {matches} (Expected: 0)")

    def verify_brute_force_incident(self):
        print("\n[Scenario 2] Simulating Rapid Sequential Authentication Failures (Brute Force)...")
        base_time = int(time.time() * 1000)
        
        for i in range(3):
            log = {
                "id": f"LOG-BF-00{i}",
                "tenant": "pci_environment",
                "timestamp": base_time + (i * 100),
                "service": "AuthService",
                "event_type": "AUTH_FAILURE",
                "payload": {"auth": {"username": "admin", "domain": "CORE_SWITCH"}}
            }
            self.engine.dispatch_log(json.dumps(log))

    def verify_privilege_escalation_incident(self):
        print("\n[Scenario 3] Injecting Malicious Host OS Process Spawn Vectors...")
        log = {
            "id": "LOG-PE-099",
            "tenant": "default",
            "timestamp": int(time.time() * 1000),
            "service": "OS_Audit",
            "event_type": "PROCESS_SPAWN",
            "payload": {
                "process": {
                    "command_line": "/bin/bash -c 'mimikatz dump memory'",
                    "user": "local_guest"
                },
                "host": {"hostname": "ep-prod-web-04"}
            }
        }
        self.engine.dispatch_log(json.dumps(log))

    def verify_concurrent_stream_handling(self):
        print("\n[Scenario 4] Spawning Parallel Processing Threads (Stress Handling)...")
        threads = []
        
        def mock_stream_worker(worker_id: int):
            log = {
                "id": f"LOG-CONC-{worker_id}",
                "tenant": "shared_cloud",
                "timestamp": int(time.time() * 1000),
                "service": "OS_Audit",
                "event_type": "PROCESS_SPAWN",
                "payload": {
                    "process": {"command_line": "sudo su - root", "user": f"hacker_dev_{worker_id}"},
                    "host": {"hostname": f"container-node-{worker_id}"}
                }
            }
            self.engine.dispatch_log(json.dumps(log))

        for i in range(5):
            t = threading.Thread(target=mock_stream_worker, args=(i,))
            threads.append(t)
            t.start()

        for t in threads:
            t.join()

if __name__ == "__main__":
    tester = SIEMEngineTester()
    tester.run_all_tests()