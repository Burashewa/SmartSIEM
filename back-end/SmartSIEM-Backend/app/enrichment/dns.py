"""Reverse DNS enrichment for source IP when hostname is missing."""

from __future__ import annotations

import ipaddress
import logging
import socket
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


def reverse_dns_lookup(ip: str) -> str | None:
    try:
        host, _, _ = socket.gethostbyaddr(ip)
        return host if host and host != ip else None
    except (socket.herror, socket.gaierror, OSError) as exc:
        logger.debug("Reverse DNS failed for %s: %s", ip, exc)
        return None


def enrich_reverse_dns(event: dict[str, Any]) -> dict[str, Any]:
    source = event.get("source")
    if not isinstance(source, dict):
        return event
    ip = source.get("ip")
    if not isinstance(ip, str) or not ip.strip():
        return event
    ip = ip.strip()
    if _is_non_public_ip(ip):
        return event
    host = source.get("host")
    if not isinstance(host, dict):
        host = {}
        source["host"] = host
    existing = host.get("name")
    if isinstance(existing, str) and existing.strip():
        return event
    ptr = reverse_dns_lookup(ip)
    if ptr:
        host["name"] = ptr
    return event
