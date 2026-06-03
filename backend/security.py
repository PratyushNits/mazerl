"""
security.py — DDoS & abuse protection for MAZE·RL

Layers implemented here (all free, no external services):

  1. Rate limiting per IP     — using slowapi (wraps limits package)
  2. Account lockout          — 5 failed logins → 15-min ban (in-memory)
  3. IP block list            — permanent/temporary blocks (in-memory)
  4. Request size guard       — reject bodies > 64 KB
  5. WebSocket connection cap — max 3 concurrent WS per IP
  6. Stale race cleanup       — prevent memory exhaustion from abandoned races

NOTE: For production at scale, replace in-memory stores with Redis.
"""

import asyncio
import logging
import time
from collections import defaultdict
from datetime import datetime, timedelta

from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────────────
# 1. RATE LIMITER  (slowapi — wraps limits library)
# ─────────────────────────────────────────────────────────────────────────────
# Imported and applied in main.py via decorators.
# Import the shared limiter from here so all routers use the same instance.

try:
    from slowapi import Limiter
    from slowapi.util import get_remote_address
    from slowapi.errors import RateLimitExceeded
    from slowapi.middleware import SlowAPIMiddleware
    SLOWAPI_AVAILABLE = True
except ImportError:
    SLOWAPI_AVAILABLE = False
    logger.warning("slowapi not installed — rate limiting disabled. Run: pip install slowapi")

def _get_ip(request: Request) -> str:
    """
    Extract real IP — respects X-Forwarded-For set by Nginx/Cloudflare.
    Falls back to direct connection IP.
    """
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"

if SLOWAPI_AVAILABLE:
    limiter = Limiter(key_func=_get_ip, default_limits=["200/minute"])
else:
    # Stub so imports don't break if slowapi isn't installed yet
    class _StubLimiter:
        def limit(self, *a, **kw):
            def decorator(fn): return fn
            return decorator
    limiter = _StubLimiter()


# ─────────────────────────────────────────────────────────────────────────────
# 2. ACCOUNT LOCKOUT
# ─────────────────────────────────────────────────────────────────────────────

MAX_FAILURES     = 5          # failed attempts before lockout
LOCKOUT_MINUTES  = 15         # minutes locked after MAX_FAILURES

# { username_lower: {"count": int, "locked_until": datetime|None} }
_login_attempts: dict[str, dict] = defaultdict(lambda: {"count": 0, "locked_until": None})


def check_account_locked(username: str):
    """Raise 429 if the account is currently locked out."""
    entry = _login_attempts[username.lower()]
    if entry["locked_until"] and datetime.utcnow() < entry["locked_until"]:
        remaining = int((entry["locked_until"] - datetime.utcnow()).total_seconds() / 60) + 1
        raise HTTPException(
            status_code=429,
            detail=f"Account temporarily locked after too many failed attempts. "
                   f"Try again in {remaining} minute(s)."
        )


def record_failed_login(username: str):
    """Increment failure counter; lock account if threshold reached."""
    entry = _login_attempts[username.lower()]
    # Reset if previous lockout has expired
    if entry["locked_until"] and datetime.utcnow() >= entry["locked_until"]:
        entry["count"] = 0
        entry["locked_until"] = None

    entry["count"] += 1
    logger.warning("Failed login for '%s' — attempt %d/%d", username, entry["count"], MAX_FAILURES)

    if entry["count"] >= MAX_FAILURES:
        entry["locked_until"] = datetime.utcnow() + timedelta(minutes=LOCKOUT_MINUTES)
        logger.warning("Account '%s' LOCKED until %s", username, entry["locked_until"])


def clear_failed_logins(username: str):
    """Reset failure counter on successful login."""
    _login_attempts[username.lower()] = {"count": 0, "locked_until": None}


# ─────────────────────────────────────────────────────────────────────────────
# 3. IP BLOCK LIST
# ─────────────────────────────────────────────────────────────────────────────

# { ip: expiry_timestamp_or_None }  (None = permanent)
_blocked_ips: dict[str, float | None] = {}

# IPs that have hit suspicious patterns — auto-blocked
_suspicious_counts: dict[str, int] = defaultdict(int)
SUSPICIOUS_THRESHOLD = 500   # requests/minute before auto-block


def block_ip(ip: str, minutes: int | None = None):
    """Block an IP. Pass minutes=None for permanent."""
    expiry = time.time() + minutes * 60 if minutes else None
    _blocked_ips[ip] = expiry
    logger.warning("IP BLOCKED: %s  expiry=%s", ip, expiry)


def is_blocked(ip: str) -> bool:
    if ip not in _blocked_ips:
        return False
    expiry = _blocked_ips[ip]
    if expiry is None:
        return True
    if time.time() < expiry:
        return True
    del _blocked_ips[ip]
    return False


# ─────────────────────────────────────────────────────────────────────────────
# 4. WEBSOCKET CONNECTION TRACKER
# ─────────────────────────────────────────────────────────────────────────────

MAX_WS_PER_IP = 3

# { ip: count }
_ws_connections: dict[str, int] = defaultdict(int)


def ws_connect(ip: str):
    """Call when a WebSocket connection opens. Raises 429 if over limit."""
    if _ws_connections[ip] >= MAX_WS_PER_IP:
        raise HTTPException(
            status_code=429,
            detail=f"Too many concurrent connections from your IP (max {MAX_WS_PER_IP})."
        )
    _ws_connections[ip] += 1


def ws_disconnect(ip: str):
    """Call when a WebSocket connection closes."""
    if _ws_connections[ip] > 0:
        _ws_connections[ip] -= 1


# ─────────────────────────────────────────────────────────────────────────────
# 5. SECURITY MIDDLEWARE  (runs on every HTTP request)
# ─────────────────────────────────────────────────────────────────────────────

class SecurityMiddleware(BaseHTTPMiddleware):
    """
    Runs before every request:
      - Blocks banned IPs immediately (no rate-limit token consumed)
      - Rejects bodies larger than MAX_BODY_BYTES
      - Adds security response headers
      - Tracks suspicious request volume per IP
    """

    MAX_BODY_BYTES = 64 * 1024   # 64 KB — more than enough for any API call

    # Paths that are always allowed even if large (maze image uploads)
    UPLOAD_PATHS = {"/maze/upload"}

    async def dispatch(self, request: Request, call_next):
        ip = _get_ip(request)

        # ── Block list check ──────────────────────────────────────────────────
        if is_blocked(ip):
            return JSONResponse(
                status_code=403,
                content={"detail": "Access denied."},
                headers=self._security_headers(),
            )

        # ── Body size limit ───────────────────────────────────────────────────
        if request.method in ("POST", "PUT", "PATCH") and request.url.path not in self.UPLOAD_PATHS:
            content_length = request.headers.get("content-length")
            if content_length and int(content_length) > self.MAX_BODY_BYTES:
                return JSONResponse(
                    status_code=413,
                    content={"detail": "Request body too large."},
                    headers=self._security_headers(),
                )

        # ── Suspicious volume tracking ────────────────────────────────────────
        _suspicious_counts[ip] += 1

        # ── Process request ───────────────────────────────────────────────────
        response = await call_next(request)

        # ── Attach security headers to every response ─────────────────────────
        for k, v in self._security_headers().items():
            response.headers[k] = v

        return response

    @staticmethod
    def _security_headers() -> dict:
        return {
            "X-Content-Type-Options":    "nosniff",
            "X-Frame-Options":           "DENY",
            "X-XSS-Protection":          "1; mode=block",
            "Referrer-Policy":           "strict-origin-when-cross-origin",
            "Permissions-Policy":        "geolocation=(), microphone=(), camera=()",
            "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
            "Content-Security-Policy":   (
                "default-src 'self'; "
                "script-src 'self' 'unsafe-inline'; "
                "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
                "font-src 'self' https://fonts.gstatic.com; "
                "img-src 'self' data:; "
                "connect-src 'self' ws: wss:;"
            ),
        }


# ─────────────────────────────────────────────────────────────────────────────
# 6. STALE RACE CLEANER
# ─────────────────────────────────────────────────────────────────────────────

RACE_MAX_AGE_SECONDS = 3600   # 1 hour — abandoned races removed after this


async def cleanup_stale_races(active_races: dict):
    """
    Background task — removes abandoned race sessions every 10 minutes.
    Prevents unbounded memory growth if players disconnect mid-race.
    """
    while True:
        await asyncio.sleep(600)   # run every 10 minutes
        now   = time.time()
        stale = [
            rid for rid, engine in list(active_races.items())
            if hasattr(engine, "_created_at") and now - engine._created_at > RACE_MAX_AGE_SECONDS
        ]
        for rid in stale:
            del active_races[rid]
            logger.info("Cleaned up stale race: %s", rid)
        if stale:
            logger.info("Removed %d stale races. Active: %d", len(stale), len(active_races))


# ─────────────────────────────────────────────────────────────────────────────
# 7. SUSPICIOUS IP AUTO-BLOCKER  (background task)
# ─────────────────────────────────────────────────────────────────────────────

async def auto_block_suspicious_ips():
    """
    Every 60 seconds, check if any IP made > SUSPICIOUS_THRESHOLD requests.
    If so, block it for 60 minutes automatically.
    """
    while True:
        await asyncio.sleep(60)
        for ip, count in list(_suspicious_counts.items()):
            if count > SUSPICIOUS_THRESHOLD:
                if not is_blocked(ip):
                    block_ip(ip, minutes=60)
                    logger.warning(
                        "AUTO-BLOCKED %s — %d requests in last 60s", ip, count
                    )
        _suspicious_counts.clear()
