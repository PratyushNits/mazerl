"""
mailer.py — Email sending for MAZE·RL using Python's built-in smtplib.

No extra pip install needed — uses stdlib only.

Usage:
    await send_email(
        to_address="user@example.com",
        subject="Welcome!",
        html_body="<h1>Hello</h1>"
    )

Set in backend/.env:
    SMTP_HOST=smtp.gmail.com
    SMTP_PORT=587
    SMTP_USER=pkspratyush710@gmail.com
    SMTP_PASSWORD=your-gmail-app-password

Gmail App Password setup:
    myaccount.google.com → Security → 2-Step Verification → App passwords
"""

import asyncio
import logging
import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

logger = logging.getLogger(__name__)

SMTP_HOST     = os.environ.get("SMTP_HOST",     "smtp.gmail.com")
SMTP_PORT     = int(os.environ.get("SMTP_PORT", "587"))
SMTP_USER     = os.environ.get("SMTP_USER",     "pkspratyush710@gmail.com")
SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD", "")
FROM_ADDRESS  = SMTP_USER


def _send_blocking(to_address: str, subject: str, html_body: str):
    """Blocking SMTP send — run this in a thread pool."""
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"]    = f"MAZE·RL <{FROM_ADDRESS}>"
    msg["To"]      = to_address
    msg.attach(MIMEText(html_body, "html"))

    with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=10) as server:
        server.ehlo()
        server.starttls()
        server.ehlo()
        server.login(SMTP_USER, SMTP_PASSWORD)
        server.sendmail(FROM_ADDRESS, to_address, msg.as_string())


async def send_email(to_address: str, subject: str, html_body: str):
    """
    Async wrapper — runs smtplib in a thread pool so it never blocks FastAPI.
    Email failures are caught and logged; they never crash the calling endpoint.
    """
    if not SMTP_PASSWORD:
        logger.warning("SMTP_PASSWORD not set — skipping email to %s", to_address)
        return
    try:
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, _send_blocking, to_address, subject, html_body)
        logger.info("Email sent to %s — %s", to_address, subject)
    except Exception as exc:
        logger.error("Failed to send email to %s: %s", to_address, exc)


# ── Email templates ───────────────────────────────────────────────────────────

def welcome_email(username: str) -> str:
    return f"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#050810;font-family:'Courier New',monospace;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table width="560" cellpadding="0" cellspacing="0"
               style="background:#090e1a;border:1px solid #1a2744;border-top:3px solid #0fffa0;border-radius:8px;">
          <tr>
            <td style="padding:40px 40px 24px;">
              <!-- Logo -->
              <div style="font-family:'Courier New',monospace;font-size:32px;font-weight:900;
                          letter-spacing:6px;color:#0fffa0;margin-bottom:6px;">
                MAZE·RL
              </div>
              <div style="font-size:11px;letter-spacing:4px;color:#3a4d70;margin-bottom:32px;">
                REINFORCEMENT LEARNING MAZE GAME
              </div>
              <!-- Greeting -->
              <div style="font-size:18px;color:#d4e0ff;margin-bottom:16px;letter-spacing:1px;">
                Thanks for joining, <span style="color:#0fffa0;">{username}</span>!
              </div>
              <!-- Body -->
              <div style="font-size:13px;color:#6b7fa8;line-height:1.8;margin-bottom:28px;">
                You're now registered to compete in ranked maze races against other players.<br><br>
                Sign in anytime to start racing, set personal bests, and climb the
                global leaderboard.
              </div>
              <!-- Divider -->
              <div style="height:1px;background:linear-gradient(90deg,#0fffa0,transparent);margin-bottom:28px;"></div>
              <!-- Sign-off -->
              <div style="font-size:12px;color:#3a4d70;letter-spacing:2px;">
                GOOD LUCK ON THE LEADERBOARD<br>
                <span style="color:#0fffa0;">— The MAZE·RL Team</span>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 40px;border-top:1px solid #1a2744;">
              <div style="font-size:10px;color:#3a4d70;letter-spacing:1px;">
                This email was sent because you registered at MAZE·RL.
                If this wasn't you, you can safely ignore this message.
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


def reset_password_email(reset_code: str) -> str:
    return f"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#050810;font-family:'Courier New',monospace;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table width="560" cellpadding="0" cellspacing="0"
               style="background:#090e1a;border:1px solid #1a2744;border-top:3px solid #ff3d7f;border-radius:8px;">
          <tr>
            <td style="padding:40px 40px 24px;">
              <!-- Logo -->
              <div style="font-family:'Courier New',monospace;font-size:32px;font-weight:900;
                          letter-spacing:6px;color:#0fffa0;margin-bottom:6px;">
                MAZE·RL
              </div>
              <div style="font-size:11px;letter-spacing:4px;color:#3a4d70;margin-bottom:32px;">
                PASSWORD RESET REQUEST
              </div>
              <!-- Message -->
              <div style="font-size:14px;color:#d4e0ff;margin-bottom:24px;line-height:1.8;">
                A password reset was requested for your account.<br>
                Copy the code below into the app to set a new password.
              </div>
              <!-- Code box -->
              <div style="background:#050810;border:1px solid #ff3d7f;border-radius:6px;
                          padding:20px;text-align:center;margin-bottom:24px;">
                <div style="font-size:10px;letter-spacing:3px;color:#ff3d7f;margin-bottom:10px;">
                  YOUR RESET CODE
                </div>
                <div style="font-size:22px;letter-spacing:4px;color:#d4e0ff;word-break:break-all;">
                  {reset_code}
                </div>
              </div>
              <!-- Warning -->
              <div style="font-size:12px;color:#6b7fa8;line-height:1.8;margin-bottom:28px;">
                ⏱ This code expires in <strong style="color:#ffd700;">30 minutes</strong>.<br>
                If you did not request a password reset, ignore this email — your
                account is safe.
              </div>
              <!-- Divider -->
              <div style="height:1px;background:linear-gradient(90deg,#ff3d7f,transparent);margin-bottom:24px;"></div>
              <div style="font-size:12px;color:#3a4d70;letter-spacing:2px;">
                — The MAZE·RL Team
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""
