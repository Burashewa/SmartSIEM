"""Async enrichment manager: GeoIP, threat intel hook, assets, reverse DNS."""

from __future__ import annotations

import asyncio
import copy
import logging
from typing import Any

from config.settings import Settings
from enrichment.asset_db import enrich_assets_and_users, load_json_list
from enrichment.dns import enrich_reverse_dns
from enrichment.maxmind_geo import enrich_maxmind_geo
from enrichment.threat_intel import enrich_threat_intel_placeholder

logger = logging.getLogger(__name__)


class EnrichmentManager:
    """
    Runs enrichment stages on normalized event dicts without blocking the event loop.

    GeoIP uses MaxMind DB (maxminddb) when ``settings.geoip_mmdb_path`` is set.
    """

    def __init__(self, settings: Settings | None = None) -> None:
        self._settings = settings or Settings()
        self._reader: Any = None
        path = (self._settings.geoip_mmdb_path or "").strip()
        if path:
            try:
                import maxminddb

                self._reader = maxminddb.open_database(path)
                logger.info("GeoIP MaxMind database opened: %s", path)
            except Exception as exc:
                logger.warning("Could not open MaxMind DB %s: %s", path, exc)
                self._reader = None

        self._critical_assets = load_json_list(self._settings.critical_assets_json_path)
        self._user_directory = load_json_list(self._settings.user_directory_json_path)

    def close(self) -> None:
        """Release MaxMind reader."""
        if self._reader is not None:
            try:
                self._reader.close()
            except Exception as exc:
                logger.debug("MaxMind reader close: %s", exc)
            self._reader = None

    async def enrich(self, event: dict[str, Any]) -> dict[str, Any]:
        """Apply all enrichment stages to a copy of the event."""
        if not self._settings.enrichment_enabled:
            return event

        out = copy.deepcopy(event)
        loop = asyncio.get_running_loop()

        if self._reader is not None:

            def _geo() -> None:
                enrich_maxmind_geo(self._reader, out)

            await loop.run_in_executor(None, _geo)

        await enrich_threat_intel_placeholder(out, self._settings)

        enrich_assets_and_users(
            out,
            critical_assets=self._critical_assets,
            user_directory=self._user_directory,
        )

        def _dns() -> None:
            enrich_reverse_dns(out)

        await loop.run_in_executor(None, _dns)

        enr = out.get("enrichment")
        if isinstance(enr, dict) and not enr:
            out.pop("enrichment", None)

        return out
