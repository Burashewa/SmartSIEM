"""FastAPI REST listener for JSON log ingestion from agents."""

import asyncio
import contextlib
import json
import logging
from collections.abc import Awaitable, Callable

from fastapi import FastAPI, Request, Response
from uvicorn import Config, Server

from config.settings import Settings

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
        self._app.add_api_route(
            "/api/logs",
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

    def _forwarded_identity(self, request: Request) -> dict[str, str]:
        """
        Trust identity headers injected by upstream auth middleware/proxy.

        Collector does not validate bearer tokens directly; it only forwards
        resolved identity values when present.
        """
        mapping = {
            "agentId": ("x-agent-id", "x-agentid"),
            "userId": ("x-user-id", "x-userid"),
        }
        identity: dict[str, str] = {}
        for key, header_names in mapping.items():
            value = ""
            for header in header_names:
                raw = request.headers.get(header)
                if isinstance(raw, str) and raw.strip():
                    value = raw.strip()
                    break
            if value:
                identity[key] = value
        return identity

    async def _handle_health(self) -> dict[str, str]:
        """Health check endpoint."""
        return {"status": "ok"}

    async def _handle_ingest(self, request: Request) -> Response:
        """
        Accept JSON body (object or array of objects) and dispatch to callback.

        Single object: {"message": "...", "timestamp": "..."}
        Batch: [{"message": "..."}, {"message": "..."}]
        """
        source = self._client_source(request)
        try:
            body = await request.body()
            if not body.strip():
                return Response(status_code=400, content="Empty body")
            raw = json.loads(body)
        except json.JSONDecodeError as exc:
            logger.warning("Invalid JSON from %s: %s", source, exc)
            return Response(status_code=400, content="Invalid JSON")
        except Exception as exc:
            logger.warning("Ingest error from %s: %s", source, exc)
            return Response(status_code=500, content="Internal error")

        payloads: list[str]
        identity = self._forwarded_identity(request)

        def _merge_identity(payload: dict[str, object]) -> dict[str, object]:
            if not identity:
                return payload
            merged = dict(payload)
            for key, value in identity.items():
                if not isinstance(merged.get(key), str) or not str(merged.get(key)).strip():
                    merged[key] = value
            return merged

        if isinstance(raw, list):
            payloads = [json.dumps(_merge_identity(p)) for p in raw if isinstance(p, dict)]
        elif isinstance(raw, dict):
            payloads = [json.dumps(_merge_identity(raw))]
        else:
            return Response(status_code=400, content="Expected JSON object or array")

        for payload in payloads:
            try:
                await self._on_message(payload, source)
            except Exception as exc:
                logger.warning("Callback error for ingest from %s: %s", source, exc)
                return Response(status_code=500, content="Ingest failed")

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
    
    