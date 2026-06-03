"""
scores.py — Score tracking for MAZE·RL ranked mode.

Rules
-----
  - Each user can have at most 3 scores: one per tier (easy / medium / hard).
  - Only the personal BEST score per tier is kept.
  - "Best" = solved beats unsolved; among solved → lower time wins;
    among unsolved → lower step_count wins.

Endpoints
---------
  POST /scores/submit          JWT required — submit race result
  GET  /scores/me              JWT required — personal best per tier
  GET  /scores/leaderboard     public — top 5 unique players per tier
                               ?tier=easy|medium|hard
"""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db import get_db, Score, User
from auth import get_current_user
from security import limiter

router = APIRouter(prefix="/scores", tags=["scores"])

VALID_TIERS = {"easy", "medium", "hard"}


# ── Schemas ───────────────────────────────────────────────────────────────────

class SubmitScoreRequest(BaseModel):
    tier:         str
    solved:       bool
    step_count:   int
    time_seconds: float


# ── "Is new score better?" ────────────────────────────────────────────────────

def _is_better(new: SubmitScoreRequest, existing: Score) -> bool:
    if new.solved and not existing.solved:
        return True
    if not new.solved and existing.solved:
        return False
    if new.solved:                            # both solved → lower time wins
        return new.time_seconds < existing.time_seconds
    return new.step_count < existing.step_count   # both unsolved → fewer steps wins


def _score_dict(score: Score, username: str = None) -> dict:
    d = {
        "id":           str(score.id),
        "user_id":      str(score.user_id),
        "tier":         score.tier,
        "solved":       score.solved,
        "step_count":   score.step_count,
        "time_seconds": score.time_seconds,
        "achieved_at":  score.achieved_at.isoformat(),
    }
    if username is not None:
        d["username"] = username
    return d


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/submit")
@limiter.limit("30/minute")
async def submit_score(
    request: Request,
    req: SubmitScoreRequest,
    current_user: User   = Depends(get_current_user),
    db: AsyncSession     = Depends(get_db),
):
    if req.tier not in VALID_TIERS:
        raise HTTPException(400, f"tier must be one of {VALID_TIERS}")

    result   = await db.execute(
        select(Score).where(Score.user_id == current_user.id, Score.tier == req.tier)
    )
    existing = result.scalar_one_or_none()

    if existing is None:
        score = Score(
            user_id      = current_user.id,
            tier         = req.tier,
            solved       = req.solved,
            step_count   = req.step_count,
            time_seconds = req.time_seconds,
        )
        db.add(score)
        await db.commit()
        await db.refresh(score)
        return {"saved": True, "new_record": True, "score": _score_dict(score)}

    if _is_better(req, existing):
        existing.solved       = req.solved
        existing.step_count   = req.step_count
        existing.time_seconds = req.time_seconds
        existing.achieved_at  = datetime.utcnow()
        await db.commit()
        await db.refresh(existing)
        return {"saved": True, "new_record": True, "score": _score_dict(existing)}

    return {"saved": False, "new_record": False, "score": _score_dict(existing)}


@router.get("/me")
@limiter.limit("30/minute")
async def my_scores(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession   = Depends(get_db),
):
    """Return the current user's best score for each tier (up to 3 rows)."""
    result = await db.execute(
        select(Score).where(Score.user_id == current_user.id)
    )
    scores  = result.scalars().all()
    by_tier = {s.tier: _score_dict(s) for s in scores}
    return {
        "easy":   by_tier.get("easy"),
        "medium": by_tier.get("medium"),
        "hard":   by_tier.get("hard"),
    }


@router.get("/leaderboard")
@limiter.limit("30/minute")
async def leaderboard(
    request: Request,
    tier: str        = Query("easy", description="easy | medium | hard"),
    db: AsyncSession = Depends(get_db),
):
    """
    Top 5 unique players for the given tier.
    Sorted: solved first → lowest time → fewest steps.
    No login required — public endpoint.
    """
    if tier not in VALID_TIERS:
        raise HTTPException(400, f"tier must be one of {VALID_TIERS}")

    result = await db.execute(
        select(Score, User.username)
        .join(User, Score.user_id == User.id)
        .where(Score.tier == tier)
        .order_by(
            Score.solved.desc(),
            Score.time_seconds.asc(),
            Score.step_count.asc(),
        )
        .limit(5)
    )
    rows = result.all()

    board = []
    for rank, (score, username) in enumerate(rows, start=1):
        entry         = _score_dict(score, username=username)
        entry["rank"] = rank
        board.append(entry)

    return {"tier": tier, "leaderboard": board}
