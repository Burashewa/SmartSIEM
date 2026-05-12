"""FastAPI application entrypoint for SmartSIEM unified backend."""

from __future__ import annotations

import asyncio
import contextlib
from contextlib import asynccontextmanager
from datetime import UTC, datetime

from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from slowapi import _rate_limit_exceeded_handler

from app.api.agents.routes import router as agents_router
from app.api.alerts.routes import router as alerts_router
from app.api.analytics.routes import router as analytics_router
from app.api.auth.routes import router as auth_router
from app.api.collector.routes import router as collector_router
from app.api.collector.routes import limiter
from app.api.dashboard.routes import router as dashboard_router
from app.api.logs.routes import router as logs_router
from app.api.incidents.routes import router as incidents_router
from app.api.reports.routes import router as reports_router
from app.api.rules.routes import router as rules_router
from app.api.settings.routes import router as settings_router
from app.api.users.routes import router as users_router
from app.core.config import get_settings
from app.core.logging import configure_logging
from app.core.security import hash_password
from app.core.security import decode_token
from app.database.connection import close_mongo_connection, connect_to_mongo, ensure_indexes, get_database
from app.queues.event_queue import AsyncioQueueImpl
from app.services.ingestion_service import IngestionService
from app.services.websocket_service import ws_manager
from app.workers.detection_worker import DetectionWorker
from app.workers.ingestion_worker import IngestionWorker


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    configure_logging(settings)
    await connect_to_mongo(settings)
    await ensure_indexes(get_database(settings), settings)

    ingest_queue = AsyncioQueueImpl(maxsize=settings.ingest_queue_maxsize)
    detection_queue = AsyncioQueueImpl(maxsize=settings.detection_queue_maxsize)
    ingestion_worker = IngestionWorker(ingest_queue, settings=settings)
    detection_worker = DetectionWorker(detection_queue)
    ingestion_service = IngestionService(ingest_queue, detection_queue, settings=settings)

    ingest_task = asyncio.create_task(ingestion_worker.run(), name="ingestion-worker")
    detect_task = asyncio.create_task(detection_worker.run(), name="detection-worker")

    db = get_database(settings)
    has_admin = await db.users.find_one({"username": settings.default_admin_username})
    if not has_admin:
        await db.users.insert_one(
            {
                "username": settings.default_admin_username,
                "email": settings.default_admin_email,
                "password_hash": hash_password(settings.default_admin_password),
                "role": "admin",
                "is_active": True,
                "created_at": datetime.now(UTC).isoformat(),
            }
        )

    app.state.settings = settings
    app.state.ingest_queue = ingest_queue
    app.state.detection_queue = detection_queue
    app.state.ingestion_service = ingestion_service
    app.state.ingestion_worker = ingestion_worker
    app.state.detection_worker = detection_worker
    app.state.worker_tasks = [ingest_task, detect_task]

    try:
        yield
    finally:
        await ingestion_worker.stop()
        await detection_worker.stop()
        ingestion_service.close()

        for task in app.state.worker_tasks:
            task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await asyncio.gather(*app.state.worker_tasks)

        await close_mongo_connection()


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title=settings.app_name, lifespan=lifespan)
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    app.add_middleware(SlowAPIMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(collector_router, prefix=settings.api_v1_prefix)
    app.include_router(logs_router, prefix=settings.api_v1_prefix)
    app.include_router(alerts_router, prefix=settings.api_v1_prefix)
    app.include_router(incidents_router, prefix=settings.api_v1_prefix)
    app.include_router(rules_router, prefix=settings.api_v1_prefix)
    app.include_router(settings_router, prefix=settings.api_v1_prefix)
    app.include_router(dashboard_router, prefix=settings.api_v1_prefix)
    app.include_router(auth_router, prefix=settings.api_v1_prefix)
    app.include_router(users_router, prefix=settings.api_v1_prefix)
    app.include_router(agents_router, prefix=settings.api_v1_prefix)
    app.include_router(reports_router, prefix=settings.api_v1_prefix)
    app.include_router(analytics_router, prefix=settings.api_v1_prefix)

    @app.get("/health")
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.websocket("/ws/stream")
    async def ws_stream(websocket: WebSocket) -> None:
        token = websocket.query_params.get("token", "")
        try:
            payload = decode_token(token) if token else {}
            if payload.get("type") != "access":
                await websocket.close(code=1008)
                return
        except Exception:
            await websocket.close(code=1008)
            return
        await ws_manager.connect(websocket)
        try:
            while True:
                await websocket.receive_text()
        except Exception:
            await ws_manager.disconnect(websocket)

    return app


app = create_app()
