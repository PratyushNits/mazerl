"""
q_agent.py
Tabular Q-learning agent for maze navigation.

State  : (row, col)
Actions: 0=up  1=down  2=left  3=right

Design principles
─────────────────
1. Hyperparameters are calibrated per maze size (passed in at init).
   Small maze → faster decay, shorter episodes.
   Large maze → slower decay, longer episodes.

2. Training uses a HARD episode step cap proportional to maze size so the
   agent isn't wasting update budget on aimless wandering.

3. Shaping coefficient is mild (0.4) — enough to bias toward the goal but
   not so strong it overrides learned dead-end knowledge.

4. Revisit penalty is quadratic but capped so it can't make reward so
   negative that it swamps the +100 goal signal.

5. greedy_path uses a visit-frequency adjusted Q score with hard-bans on
   detected ping-pong cells, AND directly poisons Q-values of stuck cells
   so rematches benefit from the correction too.
"""

from __future__ import annotations

import math
import random
from collections import defaultdict

import numpy as np


ACTIONS = [(-1, 0), (1, 0), (0, -1), (0, 1)]


class QAgent:
    def __init__(
        self,
        grid:  list[list[int]],
        start: tuple[int, int],
        end:   tuple[int, int],
    ) -> None:
        self.grid  = grid
        self.rows  = len(grid)
        self.cols  = len(grid[0])
        self.start = tuple(start)
        self.end   = tuple(end)

        # Count passable cells — used to calibrate all hyperparameters
        n_cells = sum(1 for r in range(self.rows)
                        for c in range(self.cols)
                        if grid[r][c] == 0)
        self._n_cells = max(1, n_cells)

        # ── Calibrate hyperparameters to maze size ────────────────────────
        # Small maze (≤50 cells):  fast decay, short episodes
        # Large maze (≥400 cells): slow decay, long episodes
        size_factor = math.log(self._n_cells + 1) / math.log(50)   # ~1 for small, ~2.5 for hard

        self.alpha         = 0.45                                   # stable convergence
        self.gamma         = 0.98                                   # strongly value long paths
        self.epsilon       = 1.0
        # Decay reaches ~0.01 after (n_cells * 4) episodes
        # e.g. 50-cell maze: reaches min in ~200 eps; 400-cell: ~1600 eps
        n_target_eps       = max(100, self._n_cells * 4)
        self.epsilon_decay = 0.99   # faster convergence
        self.epsilon_min   = 0.01

        # Max steps per training episode = 10× the number of passable cells
        self._max_train_steps = min(10000, max(500, self._n_cells * 10))

        self.q: dict[tuple, np.ndarray] = defaultdict(lambda: np.zeros(4))
        self.episode       = 0
        self.best_path_len = float("inf")

    # ── training ──────────────────────────────────────────────────────────────

    def train_episode(self) -> tuple[list, float, bool]:
        """
        ε-greedy episode with quadratic revisit penalties (capped).
        """
        state   = self.start
        visited: dict[tuple, int] = {}
        path    = [state]
        total_r = 0.0
        solved  = False

        for _ in range(self._max_train_steps):
            action = self._choose(state)
            next_state, reward, done = self._step(state, action)

            # Quadratic revisit penalty, capped at -4 so goal signal dominates
            v = visited.get(next_state, 0)
            if v > 0:
                penalty = min(4.0, 0.4 * (1 + v * v * 0.1))
                reward -= penalty

            self._update(state, action, reward, next_state, done)

            visited[state] = visited.get(state, 0) + 1
            state   = next_state
            path.append(state)
            total_r += reward

            if done:
                solved = True
                break

        self._decay_epsilon()
        self.episode += 1

        if solved and len(path) < self.best_path_len:
            self.best_path_len = len(path)

        return path, total_r, solved

    # ── inference ─────────────────────────────────────────────────────────────

    def greedy_path(self, max_steps: int = 30000) -> list[tuple]:
        """
        Frequency-penalised greedy path with hard-ban recovery.

        At every step, adjusted score = Q(s,a) − FREQ_W × visits(next)²
        On ping-pong detection:
          - Hard-ban both cells for HARD_BAN_TTL steps
          - Directly lower Q-values of actions leading to stuck cells
          - Backtrack BACK steps and resume
        """
        DETECT      = 8       # oscillation window
        BACK        = 14      # backtrack distance
        BAN_TTL     = 150     # hard-ban duration
        FREQ_W      = 0.6     # frequency penalty weight
        MAX_REC     = 200     # max recovery attempts

        state      = self.start
        path       = [state]
        freq:  dict[tuple, int] = defaultdict(int)
        bans:  dict[tuple, int] = {}
        recs   = 0
        step   = 0

        while step < max_steps:
            step += 1

            # expire bans
            bans = {c: e for c, e in bans.items() if e > step}

            # detect ping-pong
            if len(path) >= DETECT * 2:
                tail  = path[-(DETECT * 2):]
                evens = set(tail[::2])
                odds  = set(tail[1::2])
                if len(evens) == 1 and len(odds) == 1:
                    if recs >= MAX_REC:
                        break
                    recs += 1

                    for cell in (evens | odds):
                        bans[cell] = step + BAN_TTL
                        # Poison Q: lower every action that leads to this cell
                        for nb in self._neighbours(cell):
                            for a, (dr, dc) in enumerate(ACTIONS):
                                if (nb[0]+dr, nb[1]+dc) == cell:
                                    self.q[nb][a] = min(self.q[nb][a], -1.5)

                    back  = min(BACK, len(path) - 1)
                    path  = path[:-back]
                    state = path[-1]
                    continue

            # build adjusted Q scores
            q_adj = self.q[state].copy().astype(float)
            for a, (dr, dc) in enumerate(ACTIONS):
                nr, nc = state[0]+dr, state[1]+dc
                nxt    = (nr, nc)
                if not self._valid(nr, nc) or nxt in bans:
                    q_adj[a] = -1e9
                else:
                    q_adj[a] -= FREQ_W * freq[nxt] ** 2

            chosen = int(np.argmax(q_adj))

            # all blocked → clear bans and fall back to raw Q
            if q_adj[chosen] <= -1e8:
                bans.clear()
                chosen = int(np.argmax(self.q[state]))

            next_state, _, done = self._step(state, chosen)
            freq[next_state] += 1
            path.append(next_state)
            state = next_state

            if done:
                break

        return path

    # ── internals ─────────────────────────────────────────────────────────────

    def _neighbours(self, cell: tuple) -> list[tuple]:
        r, c = cell
        return [(r+dr, c+dc) for dr, dc in ACTIONS if self._valid(r+dr, c+dc)]

    def _choose(self, state: tuple) -> int:
        if random.random() < self.epsilon:
            return random.randint(0, 3)
        return int(np.argmax(self.q[state]))

    def _step(self, state: tuple, action: int) -> tuple[tuple, float, bool]:
        dr, dc = ACTIONS[action]
        nr, nc = state[0]+dr, state[1]+dc

        if not self._valid(nr, nc):
            return state, -1.8, False

        next_state = (nr, nc)
        if next_state == self.end:
            return next_state, 100.0, True

        # Mild distance shaping — guides without overwhelming learned knowledge
        curr_d  = abs(state[0]-self.end[0]) + abs(state[1]-self.end[1])
        next_d  = abs(nr-self.end[0])        + abs(nc-self.end[1])
        shaping = (curr_d - next_d) * 0.4    # was 1.2 — much gentler now

        return next_state, -0.03 + shaping, False

    def _update(self, s: tuple, a: int, r: float, ns: tuple, done: bool) -> None:
        target = r if done else r + self.gamma * float(np.max(self.q[ns]))
        self.q[s][a] += self.alpha * (target - self.q[s][a])

    def _valid(self, r: int, c: int) -> bool:
        return (0 <= r < self.rows and 0 <= c < self.cols
                and self.grid[r][c] == 0)

    def _decay_epsilon(self) -> None:
        self.epsilon = max(self.epsilon_min, self.epsilon * self.epsilon_decay)


