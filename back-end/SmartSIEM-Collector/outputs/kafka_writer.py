import json
import logging
from typing import Any

from confluent_kafka import Producer

logger = logging.getLogger(__name__)

# ANSI: green foreground + reset (terminal success line for delivered messages)
_GREEN = "\033[92m"
_RESET = "\033[0m"


class KafkaWriter:
    def __init__(
        self,
        *,
        bootstrap_servers: str,
        topic: str,
        cert_folder: str = "certs",
        client_id: str = "smartsiem-collector",
    ) -> None:
        self._topic = topic
        from outputs.ssl_diag import is_ssl_diag_enabled, log_ssl_verify_paths

        if is_ssl_diag_enabled():
            log_ssl_verify_paths("kafka: before Producer() (librdkafka SSL conf only)")

        conf: dict[str, Any] = {
            "bootstrap.servers": bootstrap_servers,
            "security.protocol": "SSL",
            "ssl.ca.location": f"{cert_folder}/ca.pem",
            "ssl.certificate.location": f"{cert_folder}/service.cert",
            "ssl.key.location": f"{cert_folder}/service.key",
            "client.id": client_id,
            "acks": 1,
        }
        self._producer = Producer(conf)

        if is_ssl_diag_enabled():
            log_ssl_verify_paths(
                "kafka: after Producer() (verify paths should be unchanged vs pre-Producer)"
            )

    def _delivery_report(self, err, msg) -> None:
        if err is not None:
            logger.error("Kafka delivery failed: %s", err)
            return
        raw = msg.value()
        if isinstance(raw, (bytes, bytearray)):
            preview = bytes(raw).decode("utf-8", errors="replace")[:50]
        elif raw is None:
            preview = ""
        else:
            preview = str(raw)[:50]
        line = f"[KAFKA] ✅ Delivered: {preview}"
        print(f"{_GREEN}{line}{_RESET}", flush=True)
        logger.debug("Kafka delivered to %s [%s]", msg.topic(), msg.partition())

    def _produce_with_backpressure(self, payload: bytes) -> None:
        warned = False
        while True:
            try:
                self._producer.produce(
                    self._topic, value=payload, callback=self._delivery_report
                )
                return
            except BufferError:
                if not warned:
                    logger.warning("Kafka producer queue full; waiting to retry")
                    warned = True
                self._producer.poll(0.5)

    def send_many(self, events: list[dict[str, Any]]) -> None:
        for ev in events:
            payload = json.dumps(ev, ensure_ascii=False).encode("utf-8")
            self._produce_with_backpressure(payload)
            self._producer.poll(0)
        # Serve delivery callbacks without blocking.
        self._producer.poll(0)

    def flush(self, timeout: float = 10.0) -> None:
        self._producer.flush(timeout=timeout)
