"""Buffered output: push normalized logs to a queue, file, or MongoDB."""

import asyncio
import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Any
import uuid

from config.settings import Settings

logger = logging.getLogger(__name__)


class QueueWriter:
    """
    Buffers normalized logs and writes them in batches.

    Supports file output (NDJSON) or null (drop). Designed for high-volume
    streams: items are queued and flushed when batch_size is reached or
    flush_interval expires.
    """

    def __init__(self, settings: Settings | None = None) -> None:
        self._settings = settings or Settings()
        self._queue: asyncio.Queue[dict[str, Any] | None] = asyncio.Queue()
        self._task: asyncio.Task[None] | None = None
        self._running = False

    async def put(self, item: dict[str, Any]) -> None:
        """Add a single normalized log (dict from NormalizedLog.to_json_dict())."""
        if not self._running:
            logger.warning("QueueWriter not started; dropping item")
            return
        await self._queue.put(item)

    async def put_many(self, items: list[dict[str, Any]]) -> None:
        """Add multiple logs."""
        for item in items:
            await self.put(item)

    async def start(self) -> None:
        """Start the background flush task."""
        if self._running:
            logger.warning("QueueWriter already running")
            return
        self._running = True
        self._task = asyncio.create_task(self._run())
        logger.info(
            "QueueWriter started (output=%s, batch=%d)",
            self._settings.queue_output,
            self._settings.queue_batch_size,
        )

    async def stop(self) -> None:
        """Stop and flush remaining items."""
        self._running = False
        await self._queue.put(None)
        if self._task:
            await asyncio.wait_for(self._task, timeout=10.0)
            self._task = None
        logger.info("QueueWriter stopped")

    async def _run(self) -> None:
        """Background task: drain queue and flush batches."""
        batch: list[dict[str, Any]] = []
        flush_interval = self._settings.queue_flush_interval_ms / 1000.0
        last_flush = asyncio.get_event_loop().time()

        _sentinel = object()

        try:
            while self._running or not self._queue.empty():
                try:
                    item = await asyncio.wait_for(
                        self._queue.get(),
                        timeout=min(0.1, flush_interval),
                    )
                except asyncio.TimeoutError:
                    item = _sentinel

                if item is None:
                    if batch:
                        await self._flush(batch)
                    break
                if item is _sentinel:
                    # Timeout: check time-based flush only
                    now = asyncio.get_event_loop().time()
                    if batch and (now - last_flush >= flush_interval):
                        await self._flush(batch)
                        batch = []
                        last_flush = now
                    continue
                batch.append(item)

                now = asyncio.get_event_loop().time()
                should_flush = (
                    len(batch) >= self._settings.queue_batch_size
                    or (now - last_flush >= flush_interval and batch)
                )
                if should_flush:
                    await self._flush(batch)
                    batch = []
                    last_flush = now

            if batch:
                await self._flush(batch)
        except asyncio.CancelledError:
            if batch:
                await self._flush(batch)
            raise
        except Exception as exc:
            logger.exception("QueueWriter drain error: %s", exc)

    async def _flush(self, batch: list[dict[str, Any]]) -> None:
        """Write batch to output backend."""
        if not batch:
            return
        backend = self._settings.queue_output
        if backend == "null":
            return
        if backend == "file":
            await self._flush_to_file(batch)
        elif backend == "mongodb":
            await self._flush_to_mongo(batch)
        else:
            logger.warning("Unknown queue_output %r; dropping %d items", backend, len(batch))

    async def _flush_to_file(self, batch: list[dict[str, Any]]) -> None:
        """Append batch as NDJSON lines."""
        path = Path(self._settings.queue_file_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        lines = [json.dumps(item, ensure_ascii=False) + "\n" for item in batch]

        def _write() -> None:
            with path.open("a", encoding="utf-8") as f:
                f.writelines(lines)

        try:
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(None, _write)
            logger.debug("Flushed %d logs to %s", len(batch), path)
        except OSError as exc:
            logger.error("Failed to write to %s: %s", path, exc)

    async def _flush_to_mongo(self, batch: list[dict[str, Any]]) -> None:
        """Store each log in MongoDB (geo from ingest enrichment; storage path is non-blocking)."""

        def _do_batch() -> None:
            from database import _prepare_for_mongo
            from pymongo import MongoClient
            from pymongo.errors import DuplicateKeyError
            from validators import SIEMValidator

            client = MongoClient(self._settings.mongo_uri)
            validator = SIEMValidator()
            try:
                db = client["SIEM"]
                coll = db["logs"]
                dead_letter = db["dead_letter"]
                for item in batch:
                    try:
                        is_valid, cleaned, errors = validator.validate_and_clean(item)
                        if is_valid:
                            doc = _prepare_for_mongo(cleaned)
                            try:
                                coll.insert_one(doc)
                            except DuplicateKeyError:
                                # Some senders reuse a constant event.id. If Mongo has a unique
                                # index on event_id, retry once with a fresh ID so ingestion
                                # never stalls.
                                if isinstance(doc.get("event"), dict):
                                    doc["event"]["id"] = str(uuid.uuid4())
                                    doc["event_id"] = doc["event"]["id"]
                                else:
                                    doc["event_id"] = str(uuid.uuid4())
                                coll.insert_one(doc)
                        else:
                            tags = cleaned.get("tags")
                            if not isinstance(tags, list):
                                tags = []
                            if "validation_failed" not in tags:
                                tags.append("validation_failed")
                            cleaned["tags"] = tags
                            dead_letter.insert_one(
                                {
                                    "failed_at": datetime.utcnow(),
                                    "validation_errors": errors,
                                    "event": cleaned,
                                }
                            )
                    except Exception as exc:
                        logger.error("MongoDB insert failed: %s", exc)
                logger.debug("Inserted %d logs into MongoDB", len(batch))
            finally:
                client.close()

        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, _do_batch)
