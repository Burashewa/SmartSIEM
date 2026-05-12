"""Async enrichment manager."""

from __future__ import annotations

import asyncio
import copy
from typing import Any

from app.core.config import Settings
from app.enrichment.asset_db import enrich_assets_and_users, load_json_list
from app.enrichment.dns import enrich_reverse_dns
from app.enrichment.maxmind_geo import enrich_maxmind_geo
from app.enrichment.threat_intel import enrich_threat_intel_placeholder


class EnrichmentManager:
    def __init__(self, settings: Settings | None = None) -> None:
        self._settings = settings or Settings()
        self._reader: Any = None
        path = (self._settings.geoip_mmdb_path or "").strip()
        if path:
            try:
                import maxminddb

                self._reader = maxminddb.open_database(path)
            except Exception:
                self._reader = None
        self._critical_assets = load_json_list(self._settings.critical_assets_json_path)
        self._user_directory = load_json_list(self._settings.user_directory_json_path)

    def close(self) -> None:
        if self._reader is not None:
            try:
                self._reader.close()
            except Exception:
                pass
            self._reader = None

    async def enrich(self, event: dict[str, Any]) -> dict[str, Any]:
        if not self._settings.enrichment_enabled:
            return event
        out = copy.deepcopy(event)
        loop = asyncio.get_running_loop()
        if self._reader is not None:
            await loop.run_in_executor(None, lambda: enrich_maxmind_geo(self._reader, out))
        await enrich_threat_intel_placeholder(out, self._settings)
        enrich_assets_and_users(
            out,
            critical_assets=self._critical_assets,
            user_directory=self._user_directory,
        )
        await loop.run_in_executor(None, lambda: enrich_reverse_dns(out))
        enr = out.get("enrichment")
        if isinstance(enr, dict) and not enr:
            out.pop("enrichment", None)
        return out
