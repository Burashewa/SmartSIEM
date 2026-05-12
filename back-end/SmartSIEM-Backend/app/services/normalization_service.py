"""Normalization service facade."""

from typing import Any

from app.normalizers import normalize


class NormalizationService:
    def normalize_event(
        self,
        log_type: str,
        fields: dict[str, Any],
        raw: str | dict[str, Any],
        source: str = "",
    ) -> dict[str, Any]:
        return normalize(log_type=log_type, fields=fields, raw=raw, source=source).to_json_dict()
