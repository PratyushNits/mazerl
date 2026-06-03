# MAZE·RL — Production Deployment & DDoS Protection Guide

This guide covers every protection layer and how to activate each one.
All tools mentioned are **free**.

---

## Protection Layers Summary

| Layer | Tool | Where | Status |
|---|---|---|---|
| Volumetric DDoS absorption | Cloudflare (free) | DNS / Edge | Manual setup |
| SSL (HTTPS) | Let's Encrypt + Certbot | Nginx | Manual setup |
| Reverse proxy + rate limits | Nginx | Server | Config ready |
| Slowloris / timeout protection | Nginx timeouts | Server | Config ready |
| Per-route rate limiting | slowapi | FastAPI code | Active |
| Account lockout | security.py | FastAPI code | Active |
| IP auto-blocker | security.py | FastAPI code | Active |
| Body size limit | SecurityMiddleware | FastAPI code | Active |
| Security headers | SecurityMiddleware | FastAPI code | Active |
| WebSocket connection cap | security.py | FastAPI code | Active |
| Stale race cleanup | Background task | FastAPI code | Active |
| CORS lockdown | main.py | FastAPI code | Configure |

---

## Step 1 — Server Setup

You need a Linux VPS. Free options:
- **Oracle Cloud Always Free** — 2 AMD cores, 1 GB RAM, always free
- **Google Cloud Free Tier** — f1-micro (limited hours/month)
- **AWS Free Tier** — t2.micro for 12 months

Once you have a server (Ubuntu 22.04 recommended):

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y nginx python3 python3-pip nodejs npm certbot python3-certbot-nginx
```

---

## Step 2 — Cloudflare (Free DDoS Protection)

Cloudflare's free tier absorbs volumetric DDoS attacks before they reach your server.

1. Go to **cloudflare.com** and create a free account
2. Click "Add a Site" → enter your domain
3. Select the **Free plan**
4. Cloudflare will scan your existing DNS records
5. Change your domain's nameservers to Cloudflare's (shown on screen)
   - This takes 10-30 minutes to propagate
6. In Cloudflare dashboard → **Security** → **DDoS** → set to **High**
7. In Cloudflare dashboard → **Security** → **Bot Fight Mode** → **On**
8. In Cloudflare dashboard → **SSL/TLS** → set to **Full (strict)**

**What Cloudflare's free tier blocks:**
- Layer 3/4 volumetric attacks (UDP floods, SYN floods)
- Known bad bots and scrapers
- Requests from malicious IP ranges (updated in real time)
- Basic Layer 7 attacks

---

## Step 3 — Deploy the App

```bash
# Clone / upload your project to the server
# Example path: /var/www/mazerl

# Backend
cd /var/www/mazerl/backend
pip install -r requirements.txt
cp .env.example .env
nano .env   # fill in DATABASE_URL, MAZERL_SECRET, SMTP_PASSWORD, ALLOWED_ORIGINS

# Frontend — build for production
cd /var/www/mazerl/frontend
npm install
npm run build
# Built files will be in frontend/dist/
```

---

## Step 4 — PostgreSQL

```bash
sudo apt install -y postgresql postgresql-contrib
sudo -u postgres psql -c "CREATE DATABASE mazerl;"
sudo -u postgres psql -c "CREATE USER mazerl_user WITH PASSWORD 'strong_password_here';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE mazerl TO mazerl_user;"
```

Update your `.env`:
```
DATABASE_URL=postgresql+asyncpg://mazerl_user:strong_password_here@localhost:5432/mazerl
```

---

## Step 5 — Nginx Configuration

```bash
# Copy the provided nginx config
sudo cp /var/www/mazerl/nginx.conf /etc/nginx/sites-available/mazerl

# Edit it — replace yourdomain.com with your actual domain
sudo nano /etc/nginx/sites-available/mazerl

# Enable it
sudo ln -s /etc/nginx/sites-available/mazerl /etc/nginx/sites-enabled/

# Remove the default site
sudo rm /etc/nginx/sites-enabled/default

# Test and reload
sudo nginx -t && sudo systemctl reload nginx
```

---

## Step 6 — Free SSL with Let's Encrypt

```bash
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

Certbot will:
1. Obtain a free SSL certificate (valid 90 days)
2. Auto-configure Nginx to use it
3. Set up automatic renewal via a cron job

Test auto-renewal:
```bash
sudo certbot renew --dry-run
```

---

## Step 7 — Run the Backend as a Service

Create a systemd service so the backend auto-starts and restarts on crash:

```bash
sudo nano /etc/systemd/system/mazerl.service
```

Paste:
```ini
[Unit]
Description=MAZE·RL FastAPI Backend
After=network.target postgresql.service

[Service]
User=www-data
WorkingDirectory=/var/www/mazerl/backend
EnvironmentFile=/var/www/mazerl/backend/.env
ExecStart=/usr/local/bin/uvicorn main:app --host 127.0.0.1 --port 8000 --workers 2
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable mazerl
sudo systemctl start mazerl
sudo systemctl status mazerl
```

---

## Step 8 — CORS Lockdown

In production, only allow your domain to call the API.
Set this in `/var/www/mazerl/backend/.env`:

```
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
```

---

## Step 9 — Firewall (ufw)

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
sudo ufw status
```

This blocks all ports except SSH (22), HTTP (80), and HTTPS (443).
Port 8000 (FastAPI) is NOT exposed — only Nginx can reach it.

---

## What Each Layer Protects Against

| Attack Type | Protected By |
|---|---|
| UDP/SYN/ICMP flood | Cloudflare edge |
| HTTP flood (millions of req/s) | Cloudflare + Nginx rate limits |
| Slowloris (slow request exhaustion) | Nginx timeouts (12s body/header) |
| Brute-force password attack | slowapi 10/min + account lockout after 5 fails |
| Account enumeration | Auth always returns same timing/message |
| Oversized request bodies | Nginx 6MB cap + SecurityMiddleware 64KB cap |
| Open WebSocket flooding | Nginx `limit_conn 3` + FastAPI ws cap |
| Bot scraping | Cloudflare Bot Fight Mode + user-agent blocking |
| Abandoned race memory leak | Background cleanup task every 10 min |
| MITM / eavesdropping | HTTPS (Let's Encrypt) + HSTS header |
| Clickjacking | X-Frame-Options: DENY header |
| XSS via headers | X-XSS-Protection + CSP header |
| MIME-type sniffing | X-Content-Type-Options: nosniff |
| Cross-origin API abuse | CORS locked to your domain in production |

---

## Monitoring (Free)

- **Cloudflare Analytics** — shows attack traffic, blocked requests, top IPs
- `sudo tail -f /var/log/nginx/error.log` — Nginx rate-limit blocks
- `sudo journalctl -u mazerl -f` — FastAPI auto-blocker and lockout logs
- **UptimeRobot** (free) — monitors uptime and alerts you if the site goes down

---

## Environment Variables Checklist

```
DATABASE_URL          postgresql+asyncpg://user:pass@localhost:5432/mazerl
MAZERL_SECRET         [long random string — generate with: python -c "import secrets; print(secrets.token_hex(32))"]
SMTP_HOST             smtp.gmail.com
SMTP_PORT             587
SMTP_USER             pkspratyush710@gmail.com
SMTP_PASSWORD         [Gmail App Password]
ALLOWED_ORIGINS       https://yourdomain.com,https://www.yourdomain.com
```
