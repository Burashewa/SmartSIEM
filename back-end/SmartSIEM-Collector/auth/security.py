from __future__ import annotations

import base64
import hashlib
import secrets
from datetime import UTC, datetime, timedelta
from typing import Any

import bcrypt
from cryptography.fernet import Fernet, InvalidToken
from jose import JWTError, jwt


# Bcrypt only considers the first 72 bytes of a password and bcrypt >= 4.1
# raises an error when this limit is exceeded. We truncate on a UTF-8
# character boundary so multi-byte characters are not split.
_BCRYPT_MAX_BYTES = 72


def _password_bytes(password: str) -> bytes:
    encoded = password.encode("utf-8")
    if len(encoded) <= _BCRYPT_MAX_BYTES:
        return encoded
    truncated = encoded[:_BCRYPT_MAX_BYTES]
    # Drop any partial multi-byte char at the boundary, then re-encode.
    return truncated.decode("utf-8", errors="ignore").encode("utf-8")


def hash_password(password: str) -> str:
    hashed = bcrypt.hashpw(_password_bytes(password), bcrypt.gensalt())
    return hashed.decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(
            _password_bytes(password),
            password_hash.encode("utf-8"),
        )
    except ValueError:
        # Malformed hash on disk - treat as a failed verification.
        return False


def now_utc() -> datetime:
    return datetime.now(UTC)


def create_access_token(
    *,
    secret: str,
    issuer: str,
    subject: str,
    expires_in_seconds: int,
    extra_claims: dict[str, Any] | None = None,
) -> str:
    now = now_utc()
    payload: dict[str, Any] = {
        "iss": issuer,
        "sub": subject,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(seconds=expires_in_seconds)).timestamp()),
        "type": "access",
    }
    if extra_claims:
        payload.update(extra_claims)
    return jwt.encode(payload, secret, algorithm="HS256")


def decode_access_token(token: str, *, secret: str, issuer: str) -> dict[str, Any]:
    try:
        payload = jwt.decode(token, secret, algorithms=["HS256"], issuer=issuer)
    except JWTError as exc:
        raise ValueError("Invalid token") from exc
    if payload.get("type") != "access":
        raise ValueError("Invalid token type")
    sub = payload.get("sub")
    if not isinstance(sub, str) or not sub:
        raise ValueError("Invalid token subject")
    return payload


def new_refresh_token() -> str:
    # Opaque token; we store only a hash server-side.
    return secrets.token_urlsafe(48)


def hash_refresh_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def new_agent_api_key() -> str:
    # Agent API key (opaque). Store only a hash in DB.
    return secrets.token_urlsafe(48)


def hash_agent_api_key(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _fernet_for_agent_keys(secret: str) -> Fernet:
    """Derive a stable Fernet key from the auth signing secret.

    Tying the KEK to ``auth_jwt_secret`` means rotating the JWT secret also
    invalidates encrypted agent keys (callers must recreate them). That is the
    intended behavior: a rotated secret should never silently keep decrypting
    old material.
    """
    if not secret:
        raise ValueError("auth_jwt_secret is empty; cannot derive encryption key")
    digest = hashlib.sha256(("smartsiem.agent-key.v1:" + secret).encode("utf-8")).digest()
    return Fernet(base64.urlsafe_b64encode(digest))


def encrypt_agent_api_key(*, secret: str, api_key: str) -> str:
    """Return Fernet ciphertext (urlsafe base64 string) for an API key."""
    fernet = _fernet_for_agent_keys(secret)
    return fernet.encrypt(api_key.encode("utf-8")).decode("utf-8")


def decrypt_agent_api_key(*, secret: str, ciphertext: str) -> str:
    """Return the plaintext API key, or raise ``ValueError`` on tamper/rotation."""
    fernet = _fernet_for_agent_keys(secret)
    try:
        return fernet.decrypt(ciphertext.encode("utf-8")).decode("utf-8")
    except InvalidToken as exc:
        raise ValueError("Stored API key cannot be decrypted (rotated secret or tampering)") from exc

