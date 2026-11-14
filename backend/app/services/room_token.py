"""Short-lived identity tokens minted by the login backend (api/auth/room-token.js).

Format: base64url(JSON payload) + "." + base64url(HMAC-SHA256(secret, first part)).
The two backends share only the secret; they never share a database.
"""

import base64
import binascii
import hashlib
import hmac
import json
import time
from dataclasses import dataclass


class InvalidTokenError(Exception):
    pass


@dataclass(frozen=True)
class TokenClaims:
    sub: str  # the login service's user id
    name: str
    avatar: str | None


def _b64decode(value: str) -> bytes:
    return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))


def sign_token(secret: str, claims: dict) -> str:
    """Used by tests. Production tokens come from the Vercel function."""
    payload = base64.urlsafe_b64encode(json.dumps(claims).encode()).rstrip(b"=")
    signature = hmac.new(secret.encode(), payload, hashlib.sha256).digest()
    return f"{payload.decode()}.{base64.urlsafe_b64encode(signature).rstrip(b'=').decode()}"


def verify_token(secret: str, token: str, now: float | None = None) -> TokenClaims:
    if not secret:
        raise InvalidTokenError("Live rooms are not configured on this server")
    try:
        payload_part, signature_part = token.split(".")
        expected = hmac.new(secret.encode(), payload_part.encode(), hashlib.sha256).digest()
        if not hmac.compare_digest(expected, _b64decode(signature_part)):
            raise InvalidTokenError("Bad token signature")
        payload = json.loads(_b64decode(payload_part))
    except (ValueError, binascii.Error) as exc:
        raise InvalidTokenError("Malformed token") from exc

    if not isinstance(payload, dict):
        raise InvalidTokenError("Malformed token")
    expires = payload.get("exp")
    if not isinstance(expires, int | float) or expires <= (now if now is not None else time.time()):
        raise InvalidTokenError("Token expired")
    sub, name = payload.get("sub"), payload.get("name")
    if not isinstance(sub, str) or not sub or len(sub) > 64:
        raise InvalidTokenError("Malformed token")
    display = name if isinstance(name, str) and name.strip() else "Player"
    avatar = payload.get("avatar")
    return TokenClaims(
        sub=sub,
        name=display.strip()[:40],
        avatar=avatar if isinstance(avatar, str) and avatar.startswith("https://") else None,
    )
