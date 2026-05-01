"""Threat intelligence hook (placeholder for VT / AlienVault / OTX)."""

from __future__ import annotations

import ipaddress
import logging
from typing import Any

logger = logging.getLogger(__name__)


def _is_non_public_ip(ip: str) -> bool:
    try:
        parsed = ipaddress.ip_address(ip)
    except ValueError:
        return True
    return (
        parsed.is_loopback
        or parsed.is_private
        or parsed.is_link_local
        or parsed.is_reserved
        or parsed.is_multicast
        or parsed.is_unspecified
    )


def _source_ip(event: dict[str, Any]) -> str | None:
    source = event.get("source")
    if isinstance(source, dict):
        ip = source.get("ip")
        if isinstance(ip, str) and ip.strip():
            return ip.strip()
    ip = event.get("ip")
    if isinstance(ip, str) and ip.strip():
        return ip.strip()
    return None


async def enrich_threat_intel_placeholder(event: dict[str, Any], settings: Any) -> dict[str, Any]:
    """
    Placeholder async threat check.

    Wire a real provider by setting threat_intel_provider + API keys in Settings
    and extending this module.
    """
    if not getattr(settings, "threat_intel_enabled", False):
        return event

    ip = _source_ip(event)
    if not ip or _is_non_public_ip(ip):
        return event

    enrichment = event.get("enrichment")
    if not isinstance(enrichment, dict):
        enrichment = {}
        event["enrichment"] = enrichment

    enrichment["threat_intel"] = {
        "intel_checked": True,
        "provider": getattr(settings, "threat_intel_provider", "placeholder"),
        "malicious": None,
        "reason": "no_provider_implementation",
    }

    logger.debug("Threat intel placeholder evaluated for %s", ip)
    return event
