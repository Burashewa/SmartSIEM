"""Queue abstraction used by ingestion and detection workers."""

import asyncio
from abc import ABC, abstractmethod
from collections.abc import AsyncIterator
from typing import Any


class AbstractQueue(ABC):
    """Abstract event queue to support asyncio and future Kafka backends."""

    @abstractmethod
    async def push(self, event: dict[str, Any]) -> None:
        """Push one event into the queue."""

    @abstractmethod
    async def subscribe(self) -> AsyncIterator[dict[str, Any]]:
        """Subscribe to events as an async iterator."""

    @abstractmethod
    async def shutdown(self) -> None:
        """Signal queue consumers to stop."""


class AsyncioQueueImpl(AbstractQueue):
    """In-memory queue implementation for phase 1 foundation."""

    def __init__(self, maxsize: int = 10000) -> None:
        self._queue: asyncio.Queue[dict[str, Any] | object] = asyncio.Queue(maxsize=maxsize)
        self._sentinel = object()
        self._closed = False

    async def push(self, event: dict[str, Any]) -> None:
        if self._closed:
            raise RuntimeError("queue is closed")
        await self._queue.put(event)

    async def subscribe(self) -> AsyncIterator[dict[str, Any]]:
        while True:
            item = await self._queue.get()
            try:
                if item is self._sentinel:
                    break
                if isinstance(item, dict):
                    yield item
            finally:
                self._queue.task_done()

    async def shutdown(self) -> None:
        if self._closed:
            return
        self._closed = True
        await self._queue.put(self._sentinel)
