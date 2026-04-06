import time
import ipaddress
import json
from datetime import datetime, timezone
from typing import List, Any
from models import LogEvent, SecurityAlert
from rules import RULES, DetectionRule
from window import window, sequence

def _matches_filters(event: LogEvent, filters: dict) -> bool:
    for k, v in filters.items():
        val = getattr(event, k, None)
        if isinstance(v, list):
            if val not in v:
                return False
        else:
            if val != v:
                return False
    return True

def evaluate(event: LogEvent) -> List[SecurityAlert]:
    alerts = []
    
    for rule in RULES:
        if not _matches_filters(event, rule.filters):
            continue
            
        try:
            if rule.rule_type == "threshold_window":
                alert = _eval_threshold_window(rule, event)
                if alert: alerts.append(alert)
            elif rule.rule_type == "single_event":
                alert = _eval_single_event(rule, event)
                if alert: alerts.append(alert)
            elif rule.rule_type == "sequence":
                alert = _eval_sequence(rule, event)
                if alert: alerts.append(alert)
        except Exception as e:
            print(f"Error evaluating rule {rule.id}: {e}")
            
    return alerts

def _get_group_value(event: LogEvent, group_by: str) -> str:
    if group_by == "ip":
        return event.ip or f"unknown_ip_{event.event_id}"
    elif group_by == "user":
        return event.user or f"unknown_user_{event.event_id}"
    elif group_by == "sessionId":
        return event.sessionId or f"unknown_session_{event.event_id}"
    return "default"

def _eval_threshold_window(rule: DetectionRule, event: LogEvent) -> SecurityAlert | None:
    cond = rule.condition
    group_value = _get_group_value(event, cond.get("group_by", "ip"))
    
    if "metadata_field" in cond and "metadata_min" in cond:
        val = event.metadata.get(cond["metadata_field"])
        if val is None or float(val) < cond["metadata_min"]:
            return None
            
    current_time = time.time()
    count, linked_ids = window.increment(
        rule.id, group_value, cond["window"], current_time, event.event_id
    )
    
    if count >= cond["threshold"]:
        window.reset(rule.id, group_value)
        return _make_alert(rule, event, linked_ids, f"Threshold {cond['threshold']} exceeded on {group_value}")
        
    return None

def _eval_single_event(rule: DetectionRule, event: LogEvent) -> SecurityAlert | None:
    cond = rule.condition
    trigger = False
    details = ""
    
    if "outside_hours" in cond:
        hour = datetime.now(timezone.utc).hour
        start, end = cond["outside_hours"]
        if hour < start or hour >= end:
            trigger = True
            details = f"Event occurred at {hour}:00 UTC, outside {start}-{end}"
            
    elif "blocklist" in cond:
        if event.ip and event.ip in cond["blocklist"]:
            trigger = True
            details = f"IP {event.ip} is in blocklist"
            
    elif "suspicious_location" in cond:
        if event.latitude and event.longitude:
            trigger = True
            details = f"Suspicious location lat:{event.latitude}, lon:{event.longitude}"
            
    elif "new_device" in cond:
        if event.deviceId and "new" in event.deviceId.lower():
            trigger = True
            details = f"New device detected: {event.deviceId}"
            
    elif "path_contains" in cond:
        path = (event.endpoint or "").lower()
        if any(p.lower() in path for p in cond["path_contains"]):
            trigger = True
            details = f"Endpoint matched forbidden pattern: {path}"
            
    elif "target_roles" in cond:
        role = event.role or event.metadata.get("new_role", "")
        if role in cond["target_roles"]:
            trigger = True
            details = f"Role change to target role: {role}"
            
    elif "payload_suspicious" in cond:
        payload_str = json.dumps(event.payload).lower() if event.payload else ""
        for sus in cond["payload_suspicious"]:
            if sus.lower() in payload_str:
                trigger = True
                details = f"Payload contains suspicious pattern: {sus}"
                break
            
    elif "severity_field" in cond:
        sev = getattr(event, cond["severity_field"], event.severity)
        if str(sev).lower() in cond.get("severity_levels", []):
            trigger = True
            details = f"Severity matched level: {sev}"
            
    elif "metadata_field" in cond and "threshold" in cond:
        val = float(event.metadata.get(cond["metadata_field"], 0))
        if val >= cond["threshold"]:
            trigger = True
            details = f"{cond['metadata_field']} {val} >= {cond['threshold']}"
            
    if trigger:
        return _make_alert(rule, event, [event.event_id], details)
    return None

def _eval_sequence(rule: DetectionRule, event: LogEvent) -> SecurityAlert | None:
    cond = rule.condition
    group_value = _get_group_value(event, cond.get("group_by", "ip"))
    current_time = time.time()
    
    first_match = _matches_filters(event, cond.get("first_filters", {}))
    second_match = _matches_filters(event, cond.get("second_filters", {}))
    
    result = None
    
    if second_match:
        triggered, linked_ids = sequence.check_second(
            rule.id, group_value, cond["window"], cond.get("first_threshold", 1), current_time, event.event_id
        )
        if triggered:
            if cond.get("diff_ip"):
                ips = set()
                clean_ids = []
                for id_str in linked_ids[:-1]:
                    parts = id_str.split('|')
                    clean_ids.append(parts[0])
                    if len(parts) > 1:
                        ips.add(parts[1])
                ips.add(str(event.ip))
                
                if len(ips) > 1:
                    linked_ids = clean_ids + [event.event_id]
                    result = _make_alert(rule, event, linked_ids, f"Sequence detected on {group_value}")
            else:
                result = _make_alert(rule, event, linked_ids, f"Sequence detected on {group_value}")
                
    if first_match and not result:
        if cond.get("diff_ip"):
            sequence.record_first(rule.id, group_value, cond["window"], current_time, f"{event.event_id}|{event.ip}")
        else:
            sequence.record_first(rule.id, group_value, cond["window"], current_time, event.event_id)
            
    return result

def _make_alert(rule: DetectionRule, event: LogEvent, linked_ids: List[str], extra_msg: str) -> SecurityAlert:
    return SecurityAlert(
        rule_id=rule.id,
        rule_name=rule.name,
        severity=rule.severity,
        ip=event.ip,
        event=event.event,
        message=extra_msg,
        recommendation=rule.recommendation,
        linked_event_ids=linked_ids
    )
