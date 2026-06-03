"""
skill_tracker.py
Records per-episode statistics and exposes aggregated metrics for the UI.
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Any


@dataclass
class EpisodeRecord:
    episode:   int
    steps:     int
    reward:    float
    solved:    bool
    epsilon:   float
    ts:        float = field(default_factory=time.time)


class SkillTracker:
    def __init__(self) -> None:
        self._records: list[EpisodeRecord] = []

    # ── write ─────────────────────────────────────────────────────────────────

    def record(
        self,
        episode: int,
        path:    list,
        reward:  float,
        solved:  bool,
        epsilon: float,
    ) -> None:
        self._records.append(
            EpisodeRecord(
                episode=episode,
                steps=len(path),
                reward=round(reward, 2),
                solved=solved,
                epsilon=round(epsilon, 4),
            )
        )

    # ── read ──────────────────────────────────────────────────────────────────

    def get_metrics(self) -> dict[str, Any]:
        if not self._records:
            return {}

        total      = len(self._records)
        solved_all = [r for r in self._records if r.solved]

        # Recent-window solve rate  (last 25 episodes)
        recent = self._records[-25:]
        recent_rate = sum(1 for r in recent if r.solved) / len(recent)

        best_steps = min((r.steps for r in solved_all), default=0)
        avg_steps  = (
            round(sum(r.steps for r in solved_all) / len(solved_all))
            if solved_all else 0
        )

        # Compact learning curve for chart (last 60 episodes)
        curve = [
            {"ep": r.episode, "steps": r.steps, "solved": r.solved}
            for r in self._records[-60:]
        ]

        return {
            "total_episodes":    total,
            "solve_count":       len(solved_all),
            "recent_solve_rate": round(recent_rate * 100, 1),
            "avg_solution_steps": avg_steps,
            "best_steps":        best_steps,
            "epsilon":           self._records[-1].epsilon,
            "curve":             curve,
        }

    def reset(self) -> None:
        self._records.clear()
