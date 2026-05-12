"""GeoIP enrichment via MaxMind DB (maxminddb reader)."""

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


def _ensure_source_geo(event: dict[str, Any]) -> dict[str, Any]:
    source = event.get("source")
    if not isinstance(source, dict):
        source = {}
        event["source"] = source
    geo = source.get("geo")
    if not isinstance(geo, dict):
        geo = {}
        source["geo"] = geo
    return geo


def enrich_maxmind_geo(reader: Any, event: dict[str, Any]) -> dict[str, Any]:
    if reader is None:
        return event
    source = event.get("source")
    if not isinstance(source, dict):
        return event
    ip = source.get("ip")
    if not isinstance(ip, str) or not ip.strip():
        return event
    ip = ip.strip()
    if _is_non_public_ip(ip):
        return event
    try:
        record = reader.get(ip)
    except Exception as exc:
        logger.debug("MaxMind lookup failed for %s: %s", ip, exc)
        return event
    if not isinstance(record, dict):
        return event
    geo = _ensure_source_geo(event)
    city = record.get("city", {})
    country = record.get("country", {})
    location = record.get("location", {})
    city_name = city.get("names", {}).get("en") if isinstance(city, dict) else None
    country_name = country.get("names", {}).get("en") if isinstance(country, dict) else None
    if city_name:
        geo["city_name"] = city_name
    if country_name:
        geo["country_name"] = country_name
    lat = location.get("latitude") if isinstance(location, dict) else None
    lon = location.get("longitude") if isinstance(location, dict) else None
    if lat is not None:
        geo["latitude"] = lat
    if lon is not None:
        geo["longitude"] = lon
    return event
