"""SmartSIEM Collector: central entry point for log ingestion pipeline."""

import asyncio
import errno
import logging
import signal
import sys

from config.settings import Settings
from enrichment import EnrichmentManager
from listeners.http_api import HttpApiServer
from listeners.syslog_server import SyslogServer
from normalizers import normalize
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
    logger.info("Starting SmartSIEM Collector...")
    settings = Settings()

    parser = BaseParser()
    queue_writer = QueueWriter(settings=settings)
    enrichment = EnrichmentManager(settings=settings)

    async def on_message(raw: str, source: str) -> None:
        """Pipeline: parse -> normalize -> enrich -> queue.

        Accepts single-line text, multi-line text blobs, and JSON objects/arrays.
        Any single bad line must not stall subsequent ingestion.
        """

        def _split_text_payload(text: str) -> list[str]:
            lines = [ln.strip() for ln in text.splitlines()]
            return [ln for ln in lines if ln]

        # Many agents send newline-delimited logs in a single request. Process each line.
        payloads: list[str] = [raw]
        if isinstance(raw, str) and raw.strip() and not raw.lstrip().startswith(("{", "[")):
            lines = _split_text_payload(raw)
            if len(lines) > 1:
                payloads = lines

        for one in payloads:
            try:
                logger.debug("Pipeline start source=%s bytes=%d", source, len(one or ""))
                result = parser.parse(one, source=source)
                logger.debug("Parsed log_type=%s fields=%d", result.log_type, len(result.fields))
                if result.log_type == "empty":
                    continue
                normalized = normalize(
                    log_type=result.log_type,
                    fields=result.fields,
                    raw=result.raw,
                    source=source,
                )
                payload = normalized.to_json_dict()
                logger.debug("Normalized keys=%d", len(payload))
                enriched = await enrichment.enrich(payload)
                logger.debug("Enriched keys=%d", len(enriched))
                await queue_writer.put(enriched)
                logger.debug("Queued log_type=%s", result.log_type)
            except Exception:
                # Keep stack trace so "second log disappears" isn't a silent failure.
                logger.exception("Pipeline error for log from %s", source)

    syslog = SyslogServer(settings=settings, on_message=on_message)
    http_api = HttpApiServer(settings=settings, on_message=on_message)

    async def run() -> None:
        await queue_writer.start()
        await syslog.start()
        await http_api.start()
        output_mode = settings.queue_output
        logger.info(
            "SmartSIEM Collector running (syslog UDP/TCP, HTTP API, output=%s)",
            output_mode,
        )

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
            await http_api.stop()
            syslog.stop()
            enrichment.close()
            try:
                await asyncio.shield(queue_writer.stop())
            except asyncio.CancelledError:
                pass
            logger.info("Shutdown complete")

    try:
        asyncio.run(run())
    except KeyboardInterrupt:
        logger.info("Interrupted by user")
    except asyncio.CancelledError:
        logger.info("Main task cancelled")
    except OSError as exc:
        if exc.errno == errno.EADDRINUSE:
            logger.error(
                "Collector startup failed: a required port is already in use. "
                "Set SYSLOG_UDP_PORT/SYSLOG_TCP_PORT/HTTP_PORT in .env to free ports "
                "(for example 5514/5515/5000), or stop the service using them."
            )
            sys.exit(1)
        logger.exception("Collector terminated unexpectedly")
        sys.exit(1)
    except Exception:
        logger.exception("Collector terminated unexpectedly")
        sys.exit(1)


if __name__ == "__main__":
    main()
