"""Optional TLS diagnostics (gated by SMARTSIEM_SSL_DIAG=1).

Kafka uses librdkafka SSL via Producer conf only; PyMongo uses Python TLS to
MongoDB. This module does not modify global SSL state — it only logs.
"""

from __future__ import annotations

import logging
import os
import ssl

logger = logging.getLogger(__name__)

_TLS_ENV_NAMES = (
    "SSL_CERT_FILE",
    "SSL_CERT_DIR",
    "REQUESTS_CA_BUNDLE",
    "CURL_CA_BUNDLE",
)


def is_ssl_diag_enabled() -> bool:
    v = os.environ.get("SMARTSIEM_SSL_DIAG", "").strip().lower()
    return v in ("1", "true", "yes", "on")


def log_tls_env_flags() -> None:
    """Log which TLS-related env vars are set (not their values)."""
    if not is_ssl_diag_enabled():
        return
    flags = {name: bool(os.environ.get(name)) for name in _TLS_ENV_NAMES}
    logger.warning("SMARTSIEM_SSL_DIAG: TLS-related env vars present=%s", flags)


def log_ssl_verify_paths(label: str) -> None:
    """Log ssl.get_default_verify_paths() (Python default CA store hints)."""
    if not is_ssl_diag_enabled():
        return
    try:
        p = ssl.get_default_verify_paths()
        logger.warning(
            "SMARTSIEM_SSL_DIAG: ssl paths [%s] cafile=%r capath=%r "
            "openssl_cafile=%r openssl_capath=%r openssl_cafile_env=%r",
            label,
            p.cafile,
            p.capath,
            p.openssl_cafile,
            p.openssl_capath,
            p.openssl_cafile_env,
        )
    except Exception as exc:
        logger.warning("SMARTSIEM_SSL_DIAG: ssl.get_default_verify_paths failed: %s", exc)


def format_mongo_tls_error(exc: BaseException) -> str:
    """Human-readable PyMongo / TLS error for logs."""
    parts: list[str] = [f"{type(exc).__name__}: {exc}"]
    for attr in ("details", "code", "_message"):
        try:
            val = getattr(exc, attr, None)
            if val is not None:
                parts.append(f"{attr}={val!r}")
        except Exception:
            pass
    return " | ".join(parts)


def log_mongo_connect_failure(exc: BaseException, *, mongo_uri_hint: str) -> None:
    """Log Mongo handshake/TLS failure with PyMongo-oriented detail."""
    from pymongo.errors import (
        ConfigurationError,
        OperationFailure,
        ServerSelectionTimeoutError,
    )

    detail = format_mongo_tls_error(exc)
    if isinstance(exc, ServerSelectionTimeoutError):
        phase = "server selection / TLS handshake (timeout before usable server)"
    elif isinstance(exc, ConfigurationError):
        phase = "client configuration (often invalid URI or TLS options)"
    elif isinstance(exc, OperationFailure):
        phase = "post-handshake (authentication or authorization on server)"
    else:
        phase = "unknown phase (see exception type)"

    # Never log full URI (credentials).
    safe_uri = mongo_uri_hint.split("@")[-1] if "@" in mongo_uri_hint else "<hidden>"
    logger.error(
        "MongoDB connection failed [%s]: %s (host suffix from URI: %s)",
        phase,
        detail,
        safe_uri,
    )
