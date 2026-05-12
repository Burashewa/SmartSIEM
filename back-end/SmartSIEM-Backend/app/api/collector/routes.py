"""Collector API routes."""

from typing import Any

from fastapi import APIRouter, Request, status
from slowapi import Limiter
from slowapi.util import get_remote_address

router = APIRouter(prefix="/collector", tags=["collector"])
limiter = Limiter(key_func=get_remote_address)


@router.get("/health")
async def collector_health() -> dict[str, str]:
    return {"status": "ok"}


@router.post("/ingest", status_code=status.HTTP_202_ACCEPTED)
@limiter.limit("500/minute")
async def ingest_events(request: Request, payload: list[dict[str, Any]] | dict[str, Any]) -> dict[str, int | str]:
    source = "http:unknown"
    if request.client:
        source = f"http:{request.client.host}:{request.client.port}"
    service = request.app.state.ingestion_service
    count = await service.ingest_payload(payload, source=source)
    return {"status": "accepted", "count": count}
