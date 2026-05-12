# """Background worker that consumes ingest queue and writes logs."""

# from __future__ import annotations

# import asyncio
# from datetime import UTC, datetime
# from typing import Any

# from app.core.config import Settings, get_settings
# from app.database.connection import get_database
# from app.queues.event_queue import AbstractQueue
# from app.services.websocket_service import ws_manager


# class IngestionWorker:
#     """Consumes ingest queue events and persists them to MongoDB."""

#     def __init__(self, queue: AbstractQueue, settings: Settings | None = None) -> None:
#         self._queue = queue
#         self._settings = settings or get_settings()
#         self._buffer: list[dict[str, Any]] = []
#         self._last_flush = datetime.now(UTC)

#     async def run(self) -> None:
#         async for event in self._queue.subscribe():
#             self._buffer.append(event)
#             await ws_manager.broadcast("log.new", event)
#             await self._flush_if_needed()
#         await self._flush(force=True)

#     async def stop(self) -> None:
#         await self._queue.shutdown()

#     async def _flush_if_needed(self) -> None:
#         if len(self._buffer) >= self._settings.ingest_worker_batch_size:
#             await self._flush(force=True)
#             return
#         elapsed_ms = (datetime.now(UTC) - self._last_flush).total_seconds() * 1000
#         if elapsed_ms >= self._settings.ingest_worker_flush_interval_ms:
#             await self._flush(force=True)
#         else:
#             await asyncio.sleep(0)

#     async def _flush(self, force: bool = False) -> None:
#         if not self._buffer:
#             return
#         if not force and len(self._buffer) < self._settings.ingest_worker_batch_size:
#             return
#         db = get_database()
#         docs = self._buffer
#         self._buffer = []
#         await db.logs.insert_many(docs, ordered=False)
#         self._last_flush = datetime.now(UTC)

"""Background worker that consumes ingest queue and writes logs."""

from __future__ import annotations

import asyncio
import logging
from datetime import UTC, datetime
from typing import Any

from app.core.config import Settings, get_settings
from app.database.connection import get_database
from app.queues.event_queue import AbstractQueue
from app.services.websocket_service import ws_manager

logger = logging.getLogger(__name__)


class IngestionWorker:
    """Consumes ingest queue events and persists them to MongoDB."""

    def __init__(
        self,
        queue: AbstractQueue,
        settings: Settings | None = None,
    ) -> None:
        self._queue = queue
        self._settings = settings or get_settings()

        self._buffer: list[dict[str, Any]] = []

        self._last_flush = datetime.now(UTC)

    async def run(self) -> None:

        logger.info("ingestion worker started")

        async for event in self._queue.subscribe():

            try:
                logger.info("received event")

                self._buffer.append(event)

                # websocket failures should NEVER kill ingestion
                try:
                    await ws_manager.broadcast("log.new", event)

                except Exception:
                    logger.exception("websocket broadcast failed")

                await self._flush_if_needed()

            except Exception:
                logger.exception("worker processing failed")

        await self._flush(force=True)

    async def stop(self) -> None:
        await self._queue.shutdown()

    async def _flush_if_needed(self) -> None:

        if len(self._buffer) >= self._settings.ingest_worker_batch_size:
            await self._flush(force=True)
            return

        elapsed_ms = (
            datetime.now(UTC) - self._last_flush
        ).total_seconds() * 1000

        if elapsed_ms >= self._settings.ingest_worker_flush_interval_ms:
            await self._flush(force=True)

        else:
            await asyncio.sleep(0)

    async def _flush(self, force: bool = False) -> None:

        if not self._buffer:
            return

        if (
            not force
            and len(self._buffer)
            < self._settings.ingest_worker_batch_size
        ):
            return

        db = get_database()

        # DO NOT clear buffer yet
        docs = list(self._buffer)

        try:
            logger.info(f"inserting {len(docs)} docs")

            result = await db.logs.insert_many(
                docs,
                ordered=False,
            )

            logger.info(
                f"inserted {len(result.inserted_ids)} docs"
            )

            # clear only after successful insert
            self._buffer.clear()

            self._last_flush = datetime.now(UTC)

        except Exception:
            logger.exception("mongodb insert failed")