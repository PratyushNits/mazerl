"""
race_engine.py
Orchestrates a SIMULTANEOUS race between the RL agent and the human player.

Phase flow
──────────
  1. training   – Q-learning runs N episodes, streams progress updates
  2. racing     – agent replays greedy path at `agent_fps`; player is controlled
                  client-side and reports finish via a WS control message
  3. complete   – emits final result with both player and agent stats

Adaptive difficulty
───────────────────
  adapt_speed("increase") → agent_fps *= 1.20   (+20 %)
  adapt_speed("decrease") → agent_fps *= 0.50   (-50 %)
Called by main.py between rounds when the user clicks a difficulty button.
"""

from __future__ import annotations

import asyncio
import time
from typing import AsyncGenerator, Any

from q_agent import QAgent
from skill_tracker import SkillTracker

DEFAULT_FPS = 8      # intentionally slow start so the player can win early
MIN_FPS     = 0.5
MAX_FPS     = 60.0


class RaceEngine:
    def __init__(
        self,
        grid:       list[list[int]],
        start:      tuple[int, int],
        end:        tuple[int, int],
        agent:      QAgent,
        tracker:    SkillTracker,
        n_episodes: int   = 200,
        agent_fps:  float = DEFAULT_FPS,
    ) -> None:
        self.grid        = grid
        self.start       = tuple(start)
        self.end         = tuple(end)
        self.agent       = agent
        self.tracker     = tracker
        self.n_episodes  = n_episodes
        self.agent_fps   = float(agent_fps)

        self._result:    dict[str, Any] | None = None
        self._running:   bool  = False
        self._paused:    bool  = False
        self._step_evt:  asyncio.Event = asyncio.Event()

        # Written by record_player_finish() mid-race
        self.player_time_seconds: float | None = None
        self.player_steps:        int   | None = None
        self.player_solved:       bool         = False

    # ── Difficulty API ────────────────────────────────────────────────────────

    def adapt_speed(self, direction: str) -> float:
        """Adjust agent fps. Returns the new fps value."""
        if direction == "increase":
            self.agent_fps = min(MAX_FPS, self.agent_fps * 1.20)
        elif direction == "decrease":
            self.agent_fps = max(MIN_FPS, self.agent_fps * 0.50)
        return round(self.agent_fps, 2)

    # ── Live playback controls ────────────────────────────────────────────────

    def set_speed(self, fps: float) -> None:
        self.agent_fps = max(MIN_FPS, min(MAX_FPS, float(fps)))

    def pause(self)  -> None: self._paused = True
    def resume(self) -> None:
        self._paused = False
        self._step_evt.set()
    def step(self)   -> None: self._step_evt.set()

    def record_player_finish(self, time_seconds: float, steps: int, solved: bool = True) -> None:
        self.player_time_seconds = round(time_seconds, 2)
        self.player_steps        = steps
        self.player_solved       = solved

    # ── Main generator ────────────────────────────────────────────────────────

    async def run(self) -> AsyncGenerator[dict, None]:
        if self._running:
            return
        self._running = True

        # ── Phase 1: Training ─────────────────────────────────────────────────
        yield {
            "type":    "phase",
            "phase":   "training",
            "message": f"Agent training… (up to {self.n_episodes} episodes)",
        }

        UPDATE_EVERY   = max(1, self.n_episodes // 40)
        first_solve_ep = None
        # After the agent first solves the maze, run this many more consolidation
        # episodes so it reinforces the winning path before we stop.
        CONSOLIDATE    = max(30, self.n_episodes // 6)

        for ep in range(self.n_episodes):
            path, reward, solved = self.agent.train_episode()
            self.tracker.record(ep, path, reward, solved, self.agent.epsilon)

            if solved and first_solve_ep is None:
                first_solve_ep = ep

            if ep % UPDATE_EVERY == 0 or ep == self.n_episodes - 1:
                yield {
                    "type":     "training_update",
                    "episode":  ep + 1,
                    "total":    self.n_episodes,
                    "progress": round((ep + 1) / self.n_episodes * 100),
                    "metrics":  self.tracker.get_metrics(),
                }
                await asyncio.sleep(0)

            # Early stop: once solved + consolidation episodes done
            if first_solve_ep is not None:
                if ep >= first_solve_ep + CONSOLIDATE:
                    # Emit a final 100% update so the UI bar fills
                    yield {
                        "type":     "training_update",
                        "episode":  ep + 1,
                        "total":    self.n_episodes,
                        "progress": 100,
                        "metrics":  self.tracker.get_metrics(),
                    }
                    await asyncio.sleep(0)
                    break

        # ── Phase 2: Race ─────────────────────────────────────────────────────
        yield {
            "type":      "phase",
            "phase":     "racing",
            "message":   "GO! Race the agent!",
            "agent_fps": round(self.agent_fps, 2),
        }

        best_path = self.agent.greedy_path()
        total     = len(best_path)
        t0        = time.time()

        for i, pos in enumerate(best_path):
            # Pause gate
            while self._paused:
                self._step_evt.clear()
                await self._step_evt.wait()
                if not self._paused:
                    break
                break   # single step

            yield {
                "type":        "agent_move",
                "position":    list(pos),
                "step":        i,
                "total_steps": total,
                "progress":    round(i / max(total - 1, 1) * 100),
            }

            if self._paused:
                continue

            await asyncio.sleep(1.0 / max(MIN_FPS, min(MAX_FPS, self.agent_fps)))

        agent_time   = round(time.time() - t0, 2)
        agent_solved = tuple(best_path[-1]) == self.end if best_path else False

        # ── Determine winner ──────────────────────────────────────────────────
        # DRAW only when both finish AND their times are within 1 second of each other.
        # If neither finishes → agent_dnf (agent ran out of path, player didn't solve).
        # Individual DNF → the other side wins by default.
        p_time  = self.player_time_seconds
        p_solve = self.player_solved

        if agent_solved and p_solve:
            diff = abs(agent_time - (p_time or 0))
            if diff <= 1.0:
                winner = "draw"
            else:
                winner = "player" if (p_time is not None and p_time < agent_time) else "agent"
        elif agent_solved and not p_solve:
            winner = "agent"
        elif p_solve and not agent_solved:
            winner = "player"
        else:
            # Neither finished — show as agent DNF (agent ran out of steps)
            winner = "none"

        self._result = {
            "winner":              winner,
            # agent
            "agent_solved":        agent_solved,
            "agent_path":          [list(p) for p in best_path],
            "agent_steps":         total,
            "agent_time_seconds":  agent_time,
            "agent_fps":           round(self.agent_fps, 2),
            # player
            "player_solved":       self.player_solved,
            "player_time_seconds": p_time,
            "player_steps":        self.player_steps,
            # training
            "metrics":             self.tracker.get_metrics(),
        }
        self._running = False

    # ── Helpers ───────────────────────────────────────────────────────────────

    def get_result(self) -> dict[str, Any] | None:
        return self._result

    def reset_for_rematch(self) -> None:
        """Keep Q-table and agent_fps; reset race state for another round."""
        self._result             = None
        self._running            = False
        self._paused             = False
        self.player_time_seconds = None
        self.player_steps        = None
        self.player_solved       = False
        self.tracker.reset()
        self.agent.epsilon       = max(0.08, self.agent.epsilon)
