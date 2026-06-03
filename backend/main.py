"""
maze-rl backend — FastAPI server (production-hardened)

Security layers active:
  1. slowapi rate limiting     — per-IP, per-route limits
  2. SecurityMiddleware        — IP block list, body size cap, security headers
  3. Account lockout           — in auth.py via security.check_account_locked()
  4. WebSocket connection cap  — max 3 concurrent WS per IP
  5. Stale race cleanup        — background task, prevents memory exhaustion
  6. Auto IP blocker           — background task, blocks IPs > 500 req/min
  7. Trusted CORS              — locked to ALLOWED_ORIGINS env var in production
"""

import asyncio
import json
import os
import time
import uuid
from contextlib import asynccontextmanager

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

from fastapi import FastAPI, Request, UploadFile, File, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from maze_parser import MazeParser
from q_agent import QAgent
from skill_tracker import SkillTracker
from race_engine import RaceEngine, DEFAULT_FPS
from auth import router as auth_router
from scores import router as scores_router
from db import create_tables
from security import (
    SecurityMiddleware,
    limiter, SLOWAPI_AVAILABLE,
    ws_connect, ws_disconnect, _get_ip,
    cleanup_stale_races, auto_block_suspicious_ips,
)

# ── CORS origin list ──────────────────────────────────────────────────────────
# In development: allow all.
# In production:  set ALLOWED_ORIGINS=https://yourdomain.com in .env
_raw_origins = os.environ.get("ALLOWED_ORIGINS", "*")
ALLOWED_ORIGINS = [o.strip() for o in _raw_origins.split(",")] if _raw_origins != "*" else ["*"]


# ── Lifespan ──────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    os.makedirs("assets/mazes/custom", exist_ok=True)
    await create_tables()

    # Start background security tasks
    asyncio.create_task(cleanup_stale_races(active_races))
    asyncio.create_task(auto_block_suspicious_ips())

    yield


# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="maze-rl",
    lifespan=lifespan,
    # Hide /docs and /redoc in production to reduce attack surface
    docs_url="/docs" if os.environ.get("ENV", "dev") == "dev" else None,
    redoc_url=None,
)

# Order matters: SecurityMiddleware runs before CORSMiddleware
app.add_middleware(SecurityMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "Authorization"],
)

# Rate limiter error handler
if SLOWAPI_AVAILABLE:
    from slowapi import _rate_limit_exceeded_handler
    from slowapi.errors import RateLimitExceeded
    from slowapi.middleware import SlowAPIMiddleware
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    app.add_middleware(SlowAPIMiddleware)

app.mount("/assets", StaticFiles(directory="assets"), name="assets")
app.include_router(auth_router)
app.include_router(scores_router)

maze_parser  = MazeParser()
active_races: dict[str, RaceEngine] = {}

TIER_EPISODES = {"easy": 200, "medium": 500, "hard": 1000}


def _episodes_for_maze(grid: list, tier: str) -> int:
    n_cells     = sum(1 for row in grid for cell in row if cell == 0)
    multipliers = {"easy": 12, "medium": 18, "hard": 25}
    floors      = {"easy": 200, "medium": 500,  "hard": 1200}
    ceilings    = {"easy": 500, "medium": 1200, "hard": 3000}
    raw         = n_cells * multipliers.get(tier, 15)
    return max(floors.get(tier, 200), min(ceilings.get(tier, 2000), raw))


# ── Models ────────────────────────────────────────────────────────────────────

class StartRaceRequest(BaseModel):
    maze_path:  str
    tier:       str   = "easy"
    agent_fps:  float = DEFAULT_FPS

class PlayerFinishRequest(BaseModel):
    time_seconds: float
    steps:        int
    solved:       bool = True

class DifficultyRequest(BaseModel):
    direction: str


# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    """Health check — used by uptime monitors and load balancers."""
    return {"status": "ok"}


@app.get("/mazes/{tier}")
@limiter.limit("60/minute")
async def list_mazes(request: Request, tier: str):
    tier_dir = f"assets/mazes/{tier}"
    if not os.path.isdir(tier_dir):
        return {"mazes": [], "tier": tier}
    mazes = []
    for fname in sorted(os.listdir(tier_dir)):
        if fname.lower().endswith(".png"):
            stem = fname[:-4]
            mazes.append({
                "id":        f"{tier}/{stem}",
                "name":      stem.replace("_", " ").title(),
                "thumbnail": f"/assets/mazes/{tier}/{fname}",
                "file_path": f"assets/mazes/{tier}/{fname}",
                "tier":      tier,
            })
    return {"mazes": mazes, "tier": tier}


@app.get("/maze/debug")
@limiter.limit("10/minute")
async def debug_maze(request: Request, path: str):
    if not os.path.exists(path):
        return JSONResponse(status_code=404, content={"error": "File not found"})
    grid, start, end = maze_parser.parse(path)
    rows, cols = len(grid), len(grid[0])
    return {
        "grid_size": {"rows": rows, "cols": cols},
        "start": list(start),
        "end":   list(end),
    }


@app.post("/maze/upload")
@limiter.limit("5/minute")
async def upload_maze(request: Request, file: UploadFile = File(...)):
    # Validate file type
    if not file.filename.lower().endswith(".png"):
        return JSONResponse(status_code=400, content={"ok": False, "error": "Only PNG files accepted."})

    # Cap upload size at 5 MB
    content = await file.read(5 * 1024 * 1024 + 1)
    if len(content) > 5 * 1024 * 1024:
        return JSONResponse(status_code=413, content={"ok": False, "error": "File too large (max 5 MB)."})

    maze_id = uuid.uuid4().hex[:10]
    dest    = f"assets/mazes/custom/{maze_id}.png"
    with open(dest, "wb") as f:
        f.write(content)
    try:
        grid, start, end = maze_parser.parse(dest)
        rows, cols = len(grid), len(grid[0])
        return {
            "ok": True, "maze_id": maze_id,
            "thumbnail": f"/assets/mazes/custom/{maze_id}.png",
            "file_path": dest,
            "grid_size": {"rows": rows, "cols": cols},
            "start": start, "end": end,
        }
    except Exception as exc:
        if os.path.exists(dest):
            os.remove(dest)
        return JSONResponse(status_code=422, content={"ok": False, "error": str(exc)})


@app.post("/race/start")
@limiter.limit("20/minute")
async def start_race(request: Request, req: StartRaceRequest):
    # Validate tier
    if req.tier not in ("easy", "medium", "hard"):
        return JSONResponse(status_code=400, content={"error": "Invalid tier."})

    # Block path traversal attacks
    safe_path = os.path.normpath(req.maze_path)
    if ".." in safe_path or safe_path.startswith("/"):
        return JSONResponse(status_code=400, content={"error": "Invalid maze path."})

    if not os.path.exists(safe_path):
        return JSONResponse(status_code=404, content={"error": "Maze file not found."})

    grid, start, end = maze_parser.parse(safe_path)
    rows, cols       = len(grid), len(grid[0])
    n_eps            = _episodes_for_maze(grid, req.tier)
    agent            = QAgent(grid, start, end)
    tracker          = SkillTracker()
    engine           = RaceEngine(grid, start, end, agent, tracker,
                                  n_episodes=n_eps, agent_fps=req.agent_fps)
    engine._created_at = time.time()   # used by stale race cleanup
    race_id            = uuid.uuid4().hex[:10]
    active_races[race_id] = engine

    return {
        "race_id":           race_id,
        "grid":              grid,
        "start":             list(start),
        "end":               list(end),
        "grid_size":         {"rows": rows, "cols": cols},
        "training_episodes": n_eps,
        "agent_fps":         req.agent_fps,
    }


@app.post("/race/{race_id}/player_finish")
@limiter.limit("30/minute")
async def player_finish(request: Request, race_id: str, req: PlayerFinishRequest):
    engine = active_races.get(race_id)
    if not engine:
        return JSONResponse(status_code=404, content={"error": "Race not found"})
    engine.record_player_finish(req.time_seconds, req.steps, req.solved)
    return {"ok": True}


@app.post("/race/{race_id}/difficulty")
@limiter.limit("30/minute")
async def set_difficulty(request: Request, race_id: str, req: DifficultyRequest):
    if req.direction not in ("increase", "decrease"):
        return JSONResponse(status_code=400, content={"error": "direction must be increase or decrease"})
    engine = active_races.get(race_id)
    if not engine:
        return JSONResponse(status_code=404, content={"error": "Race not found"})
    new_fps = engine.adapt_speed(req.direction)
    return {"ok": True, "agent_fps": new_fps}


@app.post("/race/{race_id}/rematch")
@limiter.limit("10/minute")
async def rematch(request: Request, race_id: str):
    engine = active_races.get(race_id)
    if not engine:
        return JSONResponse(status_code=404, content={"error": "Race not found"})
    engine.reset_for_rematch()
    return {"ok": True, "race_id": race_id, "agent_fps": round(engine.agent_fps, 2)}


# ── WebSocket stream ──────────────────────────────────────────────────────────

@app.websocket("/race/stream/{race_id}")
async def race_stream(websocket: WebSocket, race_id: str):
    ip = _get_ip(websocket)

    # ── WebSocket connection cap ──────────────────────────────────────────────
    try:
        ws_connect(ip)
    except Exception:
        await websocket.close(code=1008)
        return

    await websocket.accept()
    engine = active_races.get(race_id)

    if engine is None:
        await websocket.send_json({"type": "error", "message": "Race not found"})
        await websocket.close()
        ws_disconnect(ip)
        return

    async def listen_controls():
        try:
            while True:
                raw = await websocket.receive_text()
                try:
                    msg = json.loads(raw)
                except Exception:
                    continue
                action = msg.get("action")
                if action == "pause":          engine.pause()
                elif action == "resume":       engine.resume()
                elif action == "step":         engine.step()
                elif action == "set_speed":    engine.set_speed(float(msg.get("fps", engine.agent_fps)))
        except Exception:
            pass

    ctrl = asyncio.create_task(listen_controls())
    try:
        async for update in engine.run():
            await websocket.send_json(update)
            await asyncio.sleep(0)

        result = engine.get_result()
        await websocket.send_json({"type": "complete", **(result or {})})

    except WebSocketDisconnect:
        pass
    except Exception as exc:
        try:
            await websocket.send_json({"type": "error", "message": str(exc)})
        except Exception:
            pass
    finally:
        ctrl.cancel()
        ws_disconnect(ip)
