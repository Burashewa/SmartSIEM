"""Legacy sync enrichment helper (prefer EnrichmentManager for pipeline)."""

from __future__ import annotations

from typing import Any, Callable

from enrichment.maxmind_geo import enrich_maxmind_geo

EnrichmentFunc = Callable[[dict[str, Any]], dict[str, Any]]


def apply_enrichments(
    event: dict[str, Any],
    enrichers: list[EnrichmentFunc] | None = None,
    *,
    maxmind_reader: Any | None = None,
) -> dict[str, Any]:
    """Apply enrichment callables in order (sync)."""
    if enrichers is not None:
        enriched = dict(event)
        for enricher in enrichers:
            enriched = enricher(enriched)
        return enriched

    enriched = dict(event)
    if maxmind_reader is not None:
        enrich_maxmind_geo(maxmind_reader, enriched)
    return enriched
