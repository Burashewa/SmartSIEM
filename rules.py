from dataclasses import dataclass, field
from typing import Union, List, Dict, Any

@dataclass
class DetectionRule:
    id: str
    name: str
    rule_type: str
    severity: str
    recommendation: str
    condition: Dict[str, Any]
    filters: Dict[str, Any] = field(default_factory=dict)

RULES = [
    DetectionRule("R01", "Brute-force login", "threshold_window", "HIGH", "Block source IP temporarily", 
                  {"threshold": 5, "window": 60, "group_by": "ip"},
                  filters={"event": "authentication", "action": "login", "status": "failed"}),
                  
    DetectionRule("R02", "Credential stuffing", "threshold_window", "CRITICAL", "Block IP and alert SOC", 
                  {"threshold": 20, "window": 60, "group_by": "ip"},
                  filters={"event": "authentication", "action": "login", "status": "failed"}),
                  
    DetectionRule("R03", "Account takeover", "sequence", "CRITICAL", "Lock account and reset password", 
                  {"first_filters": {"status": "failed"}, "first_threshold": 3, 
                   "second_filters": {"status": "success"}, "window": 120, "group_by": "ip"},
                  filters={"event": "authentication", "action": "login"}),
                  
    DetectionRule("R04", "Off-hours login", "single_event", "MEDIUM", "Verify with user", 
                  {"outside_hours": (6, 22)},
                  filters={"event": "authentication", "action": "login", "status": "success"}),
                  
    DetectionRule("R05", "Repeated lockout", "threshold_window", "HIGH", "Investigate user activity", 
                  {"threshold": 3, "window": 300, "group_by": "user"},
                  filters={"event": "authentication", "action": "lockout"}),
                  
    DetectionRule("R06", "Port scan / Conn Refused", "threshold_window", "HIGH", "Block IP at firewall", 
                  {"threshold": 15, "window": 30, "group_by": "ip"},
                  filters={"event": "network", "status": "refused"}), 

    DetectionRule("R07", "DDoS flood", "threshold_window", "CRITICAL", "Enable DDoS mitigation", 
                  {"threshold": 200, "window": 10, "group_by": "ip"},
                  filters={"event": "request"}),
                  
    DetectionRule("R08", "Known malicious IP", "single_event", "HIGH", "Block immediately", 
                  {"blocklist": ["10.0.0.99", "192.168.50.1", "172.16.100.5"]}),
                  
    DetectionRule("R09", "Suspicious location", "single_event", "HIGH", "Investigate VPN/proxy", 
                  {"suspicious_location": True}),
                  
    DetectionRule("R10", "New device detection", "single_event", "MEDIUM", "Verify host/user", 
                  {"new_device": True}),
                  
    DetectionRule("R11", "Forbidden path probe", "threshold_window", "HIGH", "Monitor IP for further probes", 
                  {"threshold": 10, "window": 60, "group_by": "ip"},
                  filters={"event": "authorization", "status": "failed"}),
                  
    DetectionRule("R12", "Admin panel scan", "single_event", "HIGH", "Block IP", 
                  {"path_contains": ["/admin", "/wp-admin", "/.env", "/console", "/actuator", "/phpmyadmin"]},
                  filters={"event": "request"}),
                  
    DetectionRule("R13", "Privilege escalation", "single_event", "CRITICAL", "Revert role and investigate", 
                  {"target_roles": ["admin", "root", "superuser", "sudo"]},
                  filters={"event": "account", "action": "role_change"}),
                  
    DetectionRule("R14", "Sensitive file read", "single_event", "CRITICAL", "Investigate potential breach", 
                  {"path_contains": ["/etc/passwd", "/etc/shadow", "/.ssh/", "id_rsa", ".pem", "credentials"]}),
                  
    DetectionRule("R15", "Web attack payload", "single_event", "CRITICAL", "Verify WAF rules", 
                  {"payload_suspicious": ["OR 1=1", "<script>", "SELECT", "UNION", "/bin/sh", "DROP TABLE"]}),
                  
    DetectionRule("R16", "Error burst", "threshold_window", "HIGH", "Check application logs", 
                  {"threshold": 10, "window": 60, "group_by": "ip"},
                  filters={"event": "application", "status": "error"}),
                  
    DetectionRule("R17", "Critical exception", "single_event", "CRITICAL", "Immediate dev review needed", 
                  {"severity_field": "severity", "severity_levels": ["critical", "high"]},
                  filters={"event": "application", "status": "error"}),
                  
    DetectionRule("R18", "API Abuse", "threshold_window", "HIGH", "Rate limit endpoint", 
                  {"threshold": 20, "window": 10, "group_by": "ip"},
                  filters={"event": "request", "method": "POST"}),
                  
    DetectionRule("R19", "Session hijacking", "sequence", "CRITICAL", "Invalidate session", 
                  {"first_filters": {}, "first_threshold": 1, 
                   "second_filters": {}, "window": 300, "group_by": "sessionId", "diff_ip": True}),
                  
    DetectionRule("R20", "Slow response spike", "threshold_window", "MEDIUM", "Investigate performance", 
                  {"threshold": 5, "window": 60, "group_by": "ip", "metadata_field": "latency_ms", "metadata_min": 5000}),
]
