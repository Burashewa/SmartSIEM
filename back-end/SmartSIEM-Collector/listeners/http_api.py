"""FastAPI REST listener for JSON log ingestion from agents."""

import asyncio
import contextlib
import json
import logging
from collections.abc import Awaitable, Callable
from typing import Any

from fastapi import FastAPI, HTTPException, Query, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from uvicorn import Config, Server

from auth.db import ensure_auth_indexes
from auth.deps import get_agent_api_key
from auth.routes import router as auth_router
from auth.service import authenticate_agent_api_key
from config.settings import Settings
from listeners import metrics

logger = logging.getLogger(__name__)

LogCallback = Callable[[str, str], Awaitable[None]]


class HttpApiServer:
    """
    Async HTTP API for JSON log ingestion.

    Agents POST JSON payloads to /ingest. Ingested logs are passed to the
    provided callback as (payload_str, source) where source identifies the
    client (e.g., "http:192.168.1.1:54321").
    """

    def __init__(
        self,
        settings: Settings | None = None,
        *,
        on_message: LogCallback | None = None,
    ) -> None:
        self._settings = settings or Settings()
        self._on_message = on_message or self._default_callback
        self._server: Server | None = None
        self._task: asyncio.Task[None] | None = None
        self._running = False

        self._app = FastAPI(title="SmartSIEM Collector HTTP API")
        # Minimal permissive CORS for UI -> collector; typically same-origin via Vite proxy.
        self._app.add_middleware(
            CORSMiddleware,
            allow_origins=["*"],
            allow_credentials=False,
            allow_methods=["*"],
            allow_headers=["*"],
        )

        # Auth routes and indexes (best-effort; collector must still start even if Mongo is down).
        try:
            ensure_auth_indexes(self._settings)
        except Exception as exc:
            logger.warning("Auth index initialization skipped: %s", exc)
        self._app.include_router(auth_router)

        self._app.add_api_route(
            "/ingest",
            self._handle_ingest,
            methods=["POST"],
            include_in_schema=True,
        )
        self._app.add_api_route(
            "/health",
            self._handle_health,
            methods=["GET"],
            include_in_schema=True,
        )
        self._app.add_api_route(
            "/metrics",
            self._handle_metrics,
            methods=["GET"],
            include_in_schema=True,
        )
        self._app.add_api_route(
            "/logs/recent",
            self._handle_recent_logs,
            methods=["GET"],
            include_in_schema=True,
        )

    async def _default_callback(self, message: str, source: str) -> None:
        """No-op when no callback is provided."""
        logger.debug("HTTP ingest from %s: %s", source, message[:200])

    def _client_source(self, request: Request) -> str:
        """Build source identifier from request."""
        client = request.client
        if client:
            return f"http:{client.host}:{client.port}"
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            return f"http:{forwarded.split(',')[0].strip()}"
        return "http:unknown"

    async def _handle_health(self) -> dict[str, str]:
        """Health check endpoint."""
        return {"status": "ok"}

    async def _handle_metrics(self) -> dict[str, Any]:
        """Process counters for the dashboard (events ingested, errors, per-source)."""
        snap = metrics.snapshot()
        return {
            "status": "ok",
            "queue_output": self._settings.queue_output,
            "kafka_topic": self._settings.kafka_topic,
            "require_ingest_auth": self._settings.require_ingest_auth,
            **snap,
        }

    async def _handle_recent_logs(
        self,
        limit: int = Query(50, ge=1, le=500),
        event_type: str | None = Query(default=None),
        source_ip: str | None = Query(default=None),
        q: str | None = Query(default=None),
    ) -> dict[str, Any]:
        """
        Return the most recent ingested raw logs from the collector's own
        `SIEM.logs` collection. Useful for surfacing logs that are not yet in
        the worker's time-series `log_events` collection.
        """

        def _fetch() -> dict[str, Any]:
            from pymongo import MongoClient

            uri = self._settings.mongo_uri
            client = MongoClient(uri, serverSelectionTimeoutMS=3000)
            try:
                db = client["SIEM"]
                coll = db["logs"]
                filt: dict[str, Any] = {}
                if event_type:
                    filt["event_type"] = event_type
                if source_ip:
                    filt["source_ip"] = source_ip
                if q:
                    safe = q.replace("\\", "\\\\")
                    filt["$or"] = [
                        {"event_type": {"$regex": safe, "$options": "i"}},
                        {"source_ip": {"$regex": safe, "$options": "i"}},
                        {"raw_data.message": {"$regex": safe, "$options": "i"}},
                        {"message": {"$regex": safe, "$options": "i"}},
                    ]

                cursor = coll.find(filt, projection={"_id": 0}).sort("created_at", -1).limit(limit)
                items = list(cursor)
                return {"items": items, "limit": limit}
            finally:
                client.close()

        try:
            loop = asyncio.get_event_loop()
            return await loop.run_in_executor(None, _fetch)
        except Exception as exc:
            logger.warning("Recent logs fetch failed: %s", exc)
            raise HTTPException(status_code=503, detail="MongoDB unavailable") from exc

    async def _handle_ingest(self, request: Request) -> Response:
        """
        Accept JSON body (object or array of objects) and dispatch to callback.

        Single object: {"message": "...", "timestamp": "..."}
        Batch: [{"message": "..."}, {"message": "..."}]
        """
        source = self._client_source(request)
        metrics.increment("requests_total")
        agent_ctx = None
        if self._settings.require_ingest_auth:
            api_key = get_agent_api_key(request)
            if not api_key:
                metrics.increment("auth_missing_key")
                return Response(status_code=401, content="Missing agent API key")
            agent_ctx = authenticate_agent_api_key(settings=self._settings, api_key=api_key)
            if not agent_ctx:
                metrics.increment("auth_invalid_key")
                return Response(status_code=401, content="Invalid agent API key")
        try:
            body = await request.body()
            if not body.strip():
                metrics.increment("empty_body")
                return Response(status_code=400, content="Empty body")
            raw = json.loads(body)
        except json.JSONDecodeError as exc:
            metrics.increment("invalid_json")
            logger.warning("Invalid JSON from %s: %s", source, exc)
            return Response(status_code=400, content="Invalid JSON")
        except Exception as exc:
            metrics.increment("ingest_errors")
            logger.warning("Ingest error from %s: %s", source, exc)
            return Response(status_code=500, content="Internal error")

        payloads: list[str]
        if isinstance(raw, list):
            batch = [p for p in raw if isinstance(p, dict)]
            if agent_ctx:
                for p in batch:
                    smart = p.get("smartsiem")
                    if not isinstance(smart, dict):
                        smart = {}
                    smart.update(
                        {
                            "agent_id": agent_ctx["agent_id"],
                            "agent_name": agent_ctx.get("name"),
                            "user_id": agent_ctx["user_id"],
                        }
                    )
                    p["smartsiem"] = smart
            payloads = [json.dumps(p) for p in batch]
        elif isinstance(raw, dict):
            if agent_ctx:
                smart = raw.get("smartsiem")
                if not isinstance(smart, dict):
                    smart = {}
                smart.update(
                    {
                        "agent_id": agent_ctx["agent_id"],
                        "agent_name": agent_ctx.get("name"),
                        "user_id": agent_ctx["user_id"],
                    }
                )
                raw["smartsiem"] = smart
            payloads = [json.dumps(raw)]
        else:
            return Response(status_code=400, content="Expected JSON object or array")

        for payload in payloads:
            try:
                await self._on_message(payload, source)
            except Exception as exc:
                metrics.increment("ingest_errors")
                logger.warning("Callback error for ingest from %s: %s", source, exc)
                return Response(status_code=500, content="Ingest failed")

        metrics.increment("events_total", amount=len(payloads))
        metrics.increment_source(source.split(":")[0] or "http", amount=len(payloads))
        return Response(status_code=202, content="Accepted")

    async def _run_server(self) -> None:
        """Blocking server loop; call via create_task."""
        config = Config(
            self._app,
            host=self._settings.http_host,
            port=self._settings.http_port,
            log_level="warning",
            lifespan="off",
        )
        server = Server(config)
        self._server = server
        self._running = True
        logger.info(
            "HTTP API listening on %s:%d",
            self._settings.http_host,
            self._settings.http_port,
        )
        try:
            await server.serve()
        finally:
            self._running = False

    async def start(self) -> None:
        """Start the HTTP server in the background."""
        if self._running:
            logger.warning("HTTP API already running")
            return
        self._task = asyncio.create_task(self._run_server())
        await asyncio.sleep(0.1)  # Allow server to bind

    async def stop(self) -> None:
        """Stop the HTTP server."""
        if self._server:
            self._server.should_exit = True
        if self._task:
            try:
                await asyncio.wait_for(self._task, timeout=5.0)
            except asyncio.TimeoutError:
                self._task.cancel()
                with contextlib.suppress(asyncio.CancelledError):
                    await self._task
            finally:
                self._task = None
        self._running = False
        self._server = None
        logger.info("HTTP API stopped")
