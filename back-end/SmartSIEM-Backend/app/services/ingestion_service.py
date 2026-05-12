"""Ingestion service orchestrating parse/normalize/enrich/validate/enqueue."""

from __future__ import annotations

from typing import Any

from app.core.config import Settings, get_settings
from app.enrichment import EnrichmentManager
from app.parsers.base_parser import BaseParser
from app.queues.event_queue import AbstractQueue
from app.services.normalization_service import NormalizationService
from app.validators.event_validators import SIEMValidator


class IngestionService:
    def __init__(
        self,
        ingest_queue: AbstractQueue,
        detection_queue: AbstractQueue,
        settings: Settings | None = None,
    ) -> None:
        self._settings = settings or get_settings()
        self._parser = BaseParser()
        self._normalizer = NormalizationService()
        self._validator = SIEMValidator()
        self._enrichment = EnrichmentManager(self._settings)
        self._ingest_queue = ingest_queue
        self._detection_queue = detection_queue

    async def ingest_payload(self, payload: dict[str, Any] | list[dict[str, Any]], source: str) -> int:
        items = payload if isinstance(payload, list) else [payload]
        accepted = 0
        for item in items:
            raw = item if isinstance(item, str) else self._serialize(item)
            parse_result = self._parser.parse(raw, source=source)
            if parse_result.log_type == "empty":
                continue
            normalized = self._normalizer.normalize_event(
                parse_result.log_type,
                parse_result.fields,
                parse_result.raw,
                source=source,
            )
            enriched = await self._enrichment.enrich(normalized)
            is_valid, cleaned, _errors = self._validator.validate_and_clean(enriched)
            if not is_valid:
                continue
            await self._ingest_queue.push(cleaned)
            await self._detection_queue.push(dict(cleaned))
            accepted += 1
        return accepted

    def close(self) -> None:
        self._enrichment.close()

    @staticmethod
    def _serialize(item: dict[str, Any]) -> str:
        import json

        return json.dumps(item, ensure_ascii=False, default=str)
