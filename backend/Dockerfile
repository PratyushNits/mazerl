# ─────────────────────────────────────────────────────────────────
#  MAZE·RL — Backend Dockerfile
#  Builds the FastAPI + Uvicorn server into a container image.
# ─────────────────────────────────────────────────────────────────

# Start from official Python 3.11 slim image (small, secure base)
FROM python:3.11-slim

# Set working directory inside the container
WORKDIR /app

# ── Install system dependencies ───────────────────────────────────
# libpq-dev  — needed by asyncpg (PostgreSQL driver)
# gcc        — needed to compile some Python packages
# We clean up apt cache afterwards to keep the image small
RUN apt-get update && apt-get install -y \
    libpq-dev \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# ── Install Python dependencies ───────────────────────────────────
# Copy requirements first — Docker caches this layer.
# If requirements don't change, Docker skips reinstalling on rebuild.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# ── Copy application code ─────────────────────────────────────────
COPY . .

# ── Generate maze assets if they don't exist ─────────────────────
# This runs once during image build so mazes are baked in.
RUN python generate_mazes.py

# ── Create uploads directory ──────────────────────────────────────
RUN mkdir -p assets/mazes/custom

# ── Expose the port Uvicorn will listen on ────────────────────────
EXPOSE 8000

# ── Start command ─────────────────────────────────────────────────
# --host 0.0.0.0  → accept connections from outside the container
# --port 8000     → listen on port 8000
# --workers 2     → 2 worker processes (good for small VPS)
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
