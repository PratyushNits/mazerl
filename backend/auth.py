"""
auth.py — JWT authentication for MAZE·RL.

Endpoints:
  POST /auth/register         — create account (confirm_password validation)
  POST /auth/login            — verify credentials, return JWT
  GET  /auth/me               — return current user (JWT required)
  POST /auth/forgot-password  — send password reset code by email
  POST /auth/reset-password   — apply reset code, update password

Emails sent via mailer.py (smtplib, no extra deps).
Reset tokens stored in-memory (use Redis in production).
"""

import os
import secrets
import uuid
from datetime import datetime, timedelta

from fastapi import APIRouter, HTTPException, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

try:
    from jose import JWTError, jwt
    from passlib.context import CryptContext
    JWT_AVAILABLE = True
except ImportError:
    JWT_AVAILABLE = False

from db import get_db, User
from mailer import send_email, welcome_email, reset_password_email
from security import check_account_locked, record_failed_login, clear_failed_logins, limiter

# ── Config ────────────────────────────────────────────────────────────────────

SECRET_KEY         = os.environ.get("MAZERL_SECRET", "mazerl-dev-secret-change-in-production")
ALGORITHM          = "HS256"
TOKEN_EXPIRE_HOURS = 72
RESET_EXPIRE_MINS  = 30

router   = APIRouter(prefix="/auth", tags=["auth"])
security = HTTPBearer()

if JWT_AVAILABLE:
    pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")

# In-memory reset token store: { token_str: {"user_id": str, "expires": datetime} }
# NOTE: use Redis / DB table in production for persistence across restarts.
reset_tokens: dict[str, dict] = {}


# ── JWT helpers ───────────────────────────────────────────────────────────────

def create_token(data: dict) -> str:
    payload = data.copy()
    payload["exp"] = datetime.utcnow() + timedelta(hours=TOKEN_EXPIRE_HOURS)
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token.")


def _user_public(u: User) -> dict:
    return {
        "id":         str(u.id),
        "username":   u.username,
        "email":      u.email,
        "created_at": u.created_at.isoformat(),
    }


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    payload = decode_token(credentials.credentials)
    user_id = payload.get("sub")
    result  = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
    user    = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="User not found.")
    return user


# ── Schemas ───────────────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    username:         str
    password:         str
    confirm_password: str
    email:            str


class LoginRequest(BaseModel):
    username: str
    password: str


class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    token:        str
    new_password: str


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/register")
@limiter.limit("5/minute")
async def register(request: Request, req: RegisterRequest, db: AsyncSession = Depends(get_db)):
    if not JWT_AVAILABLE:
        raise HTTPException(500, "Run: pip install python-jose[cryptography] passlib[bcrypt]")

    # ── Validation ────────────────────────────────────────────────────────────
    if len(req.username.strip()) < 3:
        raise HTTPException(400, "Username must be at least 3 characters.")
    if len(req.password) < 6:
        raise HTTPException(400, "Password must be at least 6 characters.")
    if req.password != req.confirm_password:
        raise HTTPException(400, "Passwords do not match.")
    if "@" not in req.email:
        raise HTTPException(400, "Invalid email address.")

    dup_user = await db.execute(select(User).where(User.username == req.username.strip()))
    if dup_user.scalar_one_or_none():
        raise HTTPException(400, "Username already taken.")

    dup_email = await db.execute(select(User).where(User.email == req.email.strip().lower()))
    if dup_email.scalar_one_or_none():
        raise HTTPException(400, "Email already registered.")

    # ── Create user ───────────────────────────────────────────────────────────
    user = User(
        username        = req.username.strip(),
        email           = req.email.strip().lower(),
        hashed_password = pwd_ctx.hash(req.password),
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    # ── Send welcome email (fire-and-forget — never crashes endpoint) ─────────
    await send_email(
        to_address = user.email,
        subject    = "Welcome to MAZE·RL — Let the Race Begin!",
        html_body  = welcome_email(user.username),
    )

    token = create_token({"sub": str(user.id)})
    return {"access_token": token, "token_type": "bearer", "user": _user_public(user)}


@router.post("/login")
@limiter.limit("10/minute")
async def login(request: Request, req: LoginRequest, db: AsyncSession = Depends(get_db)):
    if not JWT_AVAILABLE:
        raise HTTPException(500, "Run: pip install python-jose[cryptography] passlib[bcrypt]")

    # Check account lockout BEFORE hitting the DB
    check_account_locked(req.username)

    result = await db.execute(select(User).where(User.username == req.username.strip()))
    user   = result.scalar_one_or_none()

    if not user or not pwd_ctx.verify(req.password, user.hashed_password):
        record_failed_login(req.username)
        raise HTTPException(401, "Invalid username or password.")

    clear_failed_logins(req.username)
    token = create_token({"sub": str(user.id)})
    return {"access_token": token, "token_type": "bearer", "user": _user_public(user)}


@router.get("/me")
async def me(current_user: User = Depends(get_current_user)):
    return _user_public(current_user)


@router.post("/forgot-password")
@limiter.limit("3/minute")
async def forgot_password(request: Request, req: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)):
    """
    Look up user by email. If found, generate a 30-min reset code and email it.
    Always returns the same message — never reveals whether email is registered.
    """
    SAFE_RESPONSE = {"message": "If that email is registered, a reset code has been sent."}

    result = await db.execute(select(User).where(User.email == req.email.strip().lower()))
    user   = result.scalar_one_or_none()

    if user:
        code = secrets.token_urlsafe(32)
        reset_tokens[code] = {
            "user_id": str(user.id),
            "expires": datetime.utcnow() + timedelta(minutes=RESET_EXPIRE_MINS),
        }
        await send_email(
            to_address = user.email,
            subject    = "MAZE·RL — Password Reset Request",
            html_body  = reset_password_email(code),
        )

    return SAFE_RESPONSE


@router.post("/reset-password")
@limiter.limit("5/minute")
async def reset_password(request: Request, req: ResetPasswordRequest, db: AsyncSession = Depends(get_db)):
    """Validate reset code, update password, invalidate the token."""
    entry = reset_tokens.get(req.token)

    if not entry or datetime.utcnow() > entry["expires"]:
        raise HTTPException(400, "Invalid or expired reset code.")

    if len(req.new_password) < 6:
        raise HTTPException(400, "Password must be at least 6 characters.")

    result = await db.execute(select(User).where(User.id == uuid.UUID(entry["user_id"])))
    user   = result.scalar_one_or_none()

    if not user:
        raise HTTPException(400, "Invalid or expired reset code.")

    user.hashed_password = pwd_ctx.hash(req.new_password)
    await db.commit()

    # Invalidate used token
    del reset_tokens[req.token]

    return {"message": "Password updated successfully."}
