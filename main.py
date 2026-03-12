"""SmartSIEM Collector: central entry point for log ingestion pipeline."""

import asyncio
import logging
import signal
import sys

from config.settings import Settings
from listeners.http_api import HttpApiServer
from listeners.syslog_server import SyslogServer
from normalizers.schema import normalize
from outputs.queue_writer import QueueWriter
from parsers.base_parser import BaseParser

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    stream=sys.stdout,
)
logger = logging.getLogger(__name__)


def main() -> None:
    """Run the collector pipeline until shutdown."""
    settings = Settings()

    parser = BaseParser()
    queue_writer = QueueWriter(settings=settings)

    async def on_message(raw: str, source: str) -> None:
        """Pipeline: parse -> normalize -> queue."""
        try:
            result = parser.parse(raw, source=source)
            if result.log_type == "empty":
                return
            normalized = normalize(
                log_type=result.log_type,
                fields=result.fields,
                raw=result.raw,
                source=source,
            )
            await queue_writer.put(normalized.to_json_dict())
        except Exception as exc:
            logger.warning("Pipeline error for log from %s: %s", source, exc)

    syslog = SyslogServer(settings=settings, on_message=on_message)
    http_api = HttpApiServer(settings=settings, on_message=on_message)

    async def run() -> None:
        await queue_writer.start()
        await syslog.start()
        await http_api.start()
        logger.info("SmartSIEM Collector running (syslog UDP/TCP, HTTP API)")

        shutdown = asyncio.Event()

        def _on_signal() -> None:
            shutdown.set()

        try:
            loop = asyncio.get_running_loop()
            for sig in (signal.SIGINT, signal.SIGTERM):
                loop.add_signal_handler(sig, _on_signal)
        except NotImplementedError:
            pass

        try:
            await shutdown.wait()
        except asyncio.CancelledError:
            pass
        finally:
            logger.info("Shutting down...")
            http_api.stop()
            syslog.stop()
            try:
                await asyncio.shield(queue_writer.stop())
            except asyncio.CancelledError:
                pass
            logger.info("Shutdown complete")

    try:
        asyncio.run(run())
    except (KeyboardInterrupt, asyncio.CancelledError):
        pass


if __name__ == "__main__":
    main()
