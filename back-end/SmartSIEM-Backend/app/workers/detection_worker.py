"""Background worker that consumes detection queue and runs rules."""

from __future__ import annotations

from app.services.alert_service import AlertService
from app.services.detection_service import DetectionService
from app.queues.event_queue import AbstractQueue


class DetectionWorker:
    """Consumes detection queue events and evaluates detection logic."""

    def __init__(self, queue: AbstractQueue) -> None:
        self._queue = queue
        self._detection_service = DetectionService()
        self._alert_service = AlertService()

    async def run(self) -> None:
        async for event in self._queue.subscribe():
            alerts = await self._detection_service.evaluate(event)
            for alert in alerts:
                await self._alert_service.create_alert(alert)

    async def stop(self) -> None:
        await self._queue.shutdown()
