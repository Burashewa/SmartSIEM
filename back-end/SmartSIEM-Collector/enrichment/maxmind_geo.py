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


def _city_name(record: dict[str, Any] | None) -> str | None:
    if not record:
        return None
    city = record.get("city")
    if isinstance(city, dict):
        names = city.get("names")
        if isinstance(names, dict):
            return names.get("en") or next(iter(names.values()), None)
    return None


def _country_name(record: dict[str, Any] | None) -> str | None:
    if not record:
        return None
    country = record.get("country")
    if isinstance(country, dict):
        names = country.get("names")
        if isinstance(names, dict):
            return names.get("en") or next(iter(names.values()), None)
    return None


def _lat_lon(record: dict[str, Any] | None) -> tuple[float | None, float | None]:
    if not record:
        return None, None
    loc = record.get("location")
    if not isinstance(loc, dict):
        return None, None
    lat = loc.get("latitude")
    lon = loc.get("longitude")
    try:
        return (float(lat) if lat is not None else None, float(lon) if lon is not None else None)
    except (TypeError, ValueError):
        return None, None


def enrich_maxmind_geo(reader: Any, event: dict[str, Any]) -> dict[str, Any]:
    """Populate source.geo from MaxMind City lookup using source.ip."""
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
    city = _city_name(record)
    country = _country_name(record)
    lat, lon = _lat_lon(record)
    if city:
        geo["city_name"] = city
    if country:
        geo["country_name"] = country
    if lat is not None:
        geo["latitude"] = lat
    if lon is not None:
        geo["longitude"] = lon
    return event
