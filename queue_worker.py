"""
queue_worker.py — Bounded async queue + thread-pool for SmartSIEM high-throughput ingestion.

Design:
  - A single global Queue (max 50 000 items) buffers LogEvent objects.
  - A ThreadPoolExecutor (8 workers by default) drains the queue continuously.
  - Each worker calls evaluate() → alert_writer.write_many() just like the
    original synchronous flow, but off the HTTP request thread.
  - /ingest/batch pushes N events and returns 202 immediately.
  - Backpressure: if the queue is full, enqueue() raises QueueFullError so the
    caller can return 429 instead of silently dropping logs.
"""

import threading
import queue
import time
import os
from concurrent.futures import ThreadPoolExecutor
from typing import List, Callable, Optional

from models import LogEvent, SecurityAlert

# ── Configuration (overridable via env) ──────────────────────────────────────
MAX_QUEUE_SIZE  = int(os.getenv("QUEUE_MAX_SIZE",  "50000"))
WORKER_THREADS  = int(os.getenv("WORKER_THREADS",  "8"))
WORKER_TIMEOUT  = float(os.getenv("WORKER_TIMEOUT", "1.0"))  # seconds to block on get()


class QueueFullError(RuntimeError):
    """Raised when the ingestion queue is at capacity."""


class _IngestionWorker:
    """
    Internal class that owns the queue and thread pool.
    Do not instantiate directly — use the module-level `ingestion_queue` singleton.
    """

    def __init__(self) -> None:
        self._q: queue.Queue = queue.Queue(maxsize=MAX_QUEUE_SIZE)
        self._pool = ThreadPoolExecutor(max_workers=WORKER_THREADS, thread_name_prefix="siem-worker")
        self._running = True
        self._processed = 0
        self._failed    = 0
        self._lock      = threading.Lock()

        # Lazy imports to break circular dependency
        # (alert_writer imports socketio which imports app)
        self._evaluate_fn: Optional[Callable] = None
        self._writer      = None

        # Submit the drain tasks (one per worker thread)
        for _ in range(WORKER_THREADS):
            self._pool.submit(self._drain_loop)

        print(
            f"[SmartSIEM][queue] Worker started — "
            f"threads={WORKER_THREADS}  queue_limit={MAX_QUEUE_SIZE}"
        )

    # ── Public API ────────────────────────────────────────────────────────────

    def enqueue(self, event: LogEvent) -> None:
        """
        Push a single LogEvent onto the queue.
        Raises QueueFullError if the queue is at capacity (back-pressure).
        """
        try:
            self._q.put_nowait(event)
        except queue.Full:
            raise QueueFullError(
                f"Ingestion queue is full ({MAX_QUEUE_SIZE} items). "
                "Slow down the sender or increase QUEUE_MAX_SIZE."
            )

    def enqueue_many(self, events: List[LogEvent]) -> int:
        """
        Push a list of LogEvents.  Returns the number successfully enqueued.
        Events that cannot fit are silently counted (not raised) for batch tolerance.
        """
        accepted = 0
        for event in events:
            try:
                self._q.put_nowait(event)
                accepted += 1
            except queue.Full:
                break   # stop trying once full; caller sees accepted < len(events)
        return accepted

    @property
    def depth(self) -> int:
        """Current number of items waiting in the queue."""
        return self._q.qsize()

    @property
    def stats(self) -> dict:
        with self._lock:
            return {
                "queue_depth":  self._q.qsize(),
                "processed":    self._processed,
                "failed":       self._failed,
                "workers":      WORKER_THREADS,
                "queue_limit":  MAX_QUEUE_SIZE,
            }

    def shutdown(self) -> None:
        """Graceful shutdown — drain remaining items then stop."""
        self._running = False
        self._pool.shutdown(wait=True)

    # ── Internal ─────────────────────────────────────────────────────────────

    def _get_deps(self):
        """Lazy-load engine and writer to avoid circular imports at module load."""
        if self._evaluate_fn is None:
            from engine       import evaluate
            from alert_writer import writer
            self._evaluate_fn = evaluate
            self._writer      = writer

    def _drain_loop(self) -> None:
        """Run in each worker thread — continuously processes queue items."""
        self._get_deps()
        while self._running:
            try:
                event: LogEvent = self._q.get(timeout=WORKER_TIMEOUT)
            except queue.Empty:
                continue

            try:
                alerts: List[SecurityAlert] = self._evaluate_fn(event)
                if alerts:
                    self._writer.write_many(alerts)
                with self._lock:
                    self._processed += 1
            except Exception as exc:
                with self._lock:
                    self._failed += 1
                print(f"[SmartSIEM][queue] Worker error processing event: {exc}")
            finally:
                self._q.task_done()


# ── Module-level singleton ────────────────────────────────────────────────────
ingestion_queue = _IngestionWorker()
