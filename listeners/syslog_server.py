"""Async syslog listener supporting UDP and TCP transport."""

import asyncio
import logging
from collections.abc import Awaitable, Callable
from typing import Any

from config.settings import Settings

logger = logging.getLogger(__name__)

LogCallback = Callable[[str, str], Awaitable[None]]


class SyslogServer:
    """
    Async syslog server for UDP and TCP ingestion.

    Ingested logs are passed to the provided callback as (message, source) where
    source identifies the transport and peer (e.g., "udp:192.168.1.1:41234").
    """

    def __init__(
        self,
        settings: Settings | None = None,
        *,
        on_message: LogCallback | None = None,
    ) -> None:
        self._settings = settings or Settings()
        self._on_message = on_message or self._default_callback
        self._udp_transport: asyncio.DatagramTransport | None = None
        self._tcp_servers: list[asyncio.Server] = []
        self._running = False

    async def _default_callback(self, message: str, source: str) -> None:
        """No-op when no callback is provided; override or inject a real handler."""
        logger.debug("Syslog message from %s: %s", source, message[:200])

    async def _dispatch(self, raw: bytes, source: str) -> None:
        """Decode raw bytes and invoke the message callback."""
        try:
            text = raw.decode("utf-8", errors="replace").strip()
            if not text:
                return
            await self._on_message(text, source)
        except Exception as exc:
            logger.warning("Failed to dispatch syslog message from %s: %s", source, exc)

    def _udp_datagram_received(self, data: bytes, addr: tuple[Any, ...]) -> None:
        """Handle incoming UDP datagram."""
        source = f"udp:{addr[0]}:{addr[1]}"
        asyncio.create_task(self._dispatch(data, source))

    def _tcp_connection_made(
        self,
        reader: asyncio.StreamReader,
        writer: asyncio.StreamWriter,
    ) -> None:
        """Handle new TCP connection; spawn a task to read syslog frames."""
        peername = writer.get_extra_info("peername", ("unknown", 0))
        source = f"tcp:{peername[0]}:{peername[1]}"

        async def _read_connection() -> None:
            try:
                buffer = b""
                while True:
                    chunk = await reader.read(4096)
                    if not chunk:
                        break
                    buffer += chunk
                    # RFC 6587 octet-counting: "N " then N bytes
                    while buffer:
                        if b" " in buffer:
                            prefix, rest = buffer.split(b" ", 1)
                            if prefix.isdigit():
                                length = int(prefix)
                                if len(rest) >= length:
                                    msg = rest[:length]
                                    buffer = rest[length:]
                                    await self._dispatch(msg, source)
                                    continue
                        # Fallback: line-delimited (newline-separated)
                        if b"\n" in buffer:
                            line, buffer = buffer.split(b"\n", 1)
                            if line.strip():
                                await self._dispatch(line, source)
                            continue
                        break
                if buffer.strip():
                    await self._dispatch(buffer, source)
            except (ConnectionResetError, asyncio.IncompleteReadError):
                pass
            except Exception as exc:
                logger.warning("TCP syslog read error from %s: %s", source, exc)
            finally:
                try:
                    writer.close()
                    await writer.wait_closed()
                except OSError:
                    pass

        asyncio.create_task(_read_connection())

    async def start(self) -> None:
        """Start UDP and TCP listeners."""
        if self._running:
            logger.warning("Syslog server already running")
            return

        loop = asyncio.get_running_loop()
        host = self._settings.syslog_host

        # UDP
        try:
            self._udp_transport, _ = await loop.create_datagram_endpoint(
                lambda: _UDPProtocol(self._udp_datagram_received),
                local_addr=(host, self._settings.syslog_udp_port),
            )
            logger.info(
                "Syslog UDP listening on %s:%d",
                host,
                self._settings.syslog_udp_port,
            )
        except OSError as exc:
            logger.error("Failed to bind syslog UDP on %s:%d: %s", host, self._settings.syslog_udp_port, exc)
            raise

        # TCP
        try:
            tcp_server = await asyncio.start_server(
                self._tcp_connection_made,
                host,
                self._settings.syslog_tcp_port,
            )
            self._tcp_servers.append(tcp_server)
            logger.info(
                "Syslog TCP listening on %s:%d",
                host,
                self._settings.syslog_tcp_port,
            )
        except OSError as exc:
            logger.error("Failed to bind syslog TCP on %s:%d: %s", host, self._settings.syslog_tcp_port, exc)
            self.stop()
            raise

        self._running = True

    def stop(self) -> None:
        """Stop all listeners."""
        self._running = False
        if self._udp_transport:
            self._udp_transport.close()
            self._udp_transport = None
        for server in self._tcp_servers:
            server.close()
        self._tcp_servers.clear()
        logger.info("Syslog server stopped")

    async def run_forever(self) -> None:
        """Start the server and block until shutdown."""
        await self.start()
        try:
            while self._running:
                await asyncio.sleep(1.0)
        finally:
            self.stop()


class _UDPProtocol(asyncio.DatagramProtocol):
    """Protocol adapter for UDP syslog."""

    def __init__(self, on_datagram: Callable[[bytes, tuple[Any, ...]], None]) -> None:
        self._on_datagram = on_datagram

    def datagram_received(self, data: bytes, addr: tuple[Any, ...]) -> None:
        self._on_datagram(data, addr)


# if __name__ == "__main__":
#     logging.basicConfig(
#         level=logging.INFO,
#         format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
#     )

#     async def test_callback(message: str, source: str):
#         # 1. Print to terminal so we see it live
#         print(f"[!] Log Received from {source}")

#         # 2. Write to a file (the "Capture" part)
#         with open("captured_logs.txt", "a") as f:
#             f.write(f"Source: {source} | Data: {message}\n")

#     async def main():
#         print("--- SmartSIEM Collector: Capturing to captured_logs.txt ---")
#         server = SyslogServer(on_message=test_callback)
#         await server.run_forever()

#     try:
#         asyncio.run(main())
#     except KeyboardInterrupt:
#         print("\nShutting down...")