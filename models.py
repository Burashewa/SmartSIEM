import uuid
from datetime import datetime, timezone
from dataclasses import dataclass, field
from typing import Optional, List, Dict, Any

@dataclass
class LogEvent:
    timestamp: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    source: Optional[str] = None
    severity: Optional[str] = "low"
    event: Optional[str] = None
    action: Optional[str] = None
    status: Optional[str] = None
    user: Optional[str] = None
    role: Optional[str] = None
    ip: Optional[str] = None
    deviceId: Optional[str] = None
    sessionId: Optional[str] = None
    endpoint: Optional[str] = None
    method: Optional[str] = None
    resource: Optional[str] = None
    payload: Dict[str, Any] = field(default_factory=dict)
    userAgent: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    tags: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)
    raw: Dict[str, Any] = field(default_factory=dict)
    
    event_id: str = field(default_factory=lambda: str(uuid.uuid4()))

    def to_dict(self) -> dict:
        return {
            "event_id": self.event_id,
            "timestamp": self.timestamp,
            "source": self.source,
            "severity": self.severity,
            "event": self.event,
            "action": self.action,
            "status": self.status,
            "user": self.user,
            "role": self.role,
            "ip": self.ip,
            "deviceId": self.deviceId,
            "sessionId": self.sessionId,
            "endpoint": self.endpoint,
            "method": self.method,
            "resource": self.resource,
            "payload": self.payload,
            "userAgent": self.userAgent,
            "latitude": self.latitude,
            "longitude": self.longitude,
            "tags": self.tags,
            "metadata": self.metadata,
            "raw": self.raw
        }

    @classmethod
    def from_dict(cls, data: dict) -> 'LogEvent':
        # Must have at least something to build from
        return cls(
            timestamp=data.get("timestamp", datetime.now(timezone.utc).isoformat()),
            source=data.get("source"),
            severity=data.get("severity", "low"),
            event=data.get("event"),
            action=data.get("action"),
            status=data.get("status"),
            user=data.get("user"),
            role=data.get("role"),
            ip=data.get("ip"),
            deviceId=data.get("deviceId"),
            sessionId=data.get("sessionId"),
            endpoint=data.get("endpoint"),
            method=data.get("method"),
            resource=data.get("resource"),
            payload=data.get("payload", {}),
            userAgent=data.get("userAgent"),
            latitude=data.get("latitude"),
            longitude=data.get("longitude"),
            tags=data.get("tags", []),
            metadata=data.get("metadata", {}),
            raw=data.get("raw", data.copy())
        )

@dataclass
class SecurityAlert:
    rule_id: str
    rule_name: str
    severity: str
    ip: Optional[str]
    event: Optional[str]
    message: str
    recommendation: str
    linked_event_ids: List[str]
    status: str = "NEW"
    alert_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    trigger_time: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    def to_dict(self) -> dict:
        return {
            "alert_id": self.alert_id,
            "trigger_time": self.trigger_time,
            "rule_id": self.rule_id,
            "rule_name": self.rule_name,
            "severity": self.severity,
            "ip": self.ip,
            "event": self.event,
            "message": self.message,
            "recommendation": self.recommendation,
            "linked_event_ids": self.linked_event_ids,
            "status": self.status,
        }
