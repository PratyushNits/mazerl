"""
generate_mazes.py
Generates sample PNG maze files for easy / medium / hard tiers.
Uses recursive back-tracker (DFS) which produces long, winding corridors —
ideal for Q-learning demos.

Usage
-----
  python generate_mazes.py          # generates 3 mazes per tier
  python generate_mazes.py --count 5
"""

from __future__ import annotations

import argparse
import os
import random
import sys

import numpy as np
from PIL import Image


# ── maze generator ────────────────────────────────────────────────────────────

def _carve(grid: np.ndarray, r: int, c: int, rows: int, cols: int) -> None:
    """Iterative DFS back-tracker (avoids Python recursion limit)."""
    stack = [(r, c)]
    while stack:
        cr, cc = stack[-1]
        dirs = [(0, 2), (0, -2), (2, 0), (-2, 0)]
        random.shuffle(dirs)
        moved = False
        for dr, dc in dirs:
            nr, nc = cr + dr, cc + dc
            if 0 <= nr < rows and 0 <= nc < cols and grid[nr][nc] == 1:
                grid[cr + dr // 2][cc + dc // 2] = 0   # carve wall between
                grid[nr][nc] = 0
                stack.append((nr, nc))
                moved = True
                break
        if not moved:
            stack.pop()


def generate_maze(rows: int, cols: int, seed: int | None = None) -> np.ndarray:
    """
    Returns a binary numpy array: 1 = wall, 0 = path.
    rows and cols must be odd.
    """
    if rows % 2 == 0:
        rows += 1
    if cols % 2 == 0:
        cols += 1

    if seed is not None:
        random.seed(seed)

    grid = np.ones((rows, cols), dtype=np.uint8)
    grid[1][1] = 0
    _carve(grid, 1, 1, rows, cols)

    # Open top-left entry and bottom-right exit
    grid[0][1]         = 0
    grid[rows - 1][cols - 2] = 0

    return grid


def save_maze_png(grid: np.ndarray, path: str, cell_px: int = 12) -> None:
    rows, cols = grid.shape
    h, w = rows * cell_px, cols * cell_px
    img_arr = np.zeros((h, w, 3), dtype=np.uint8)

    for r in range(rows):
        for c in range(cols):
            color = (20, 20, 35) if grid[r][c] == 1 else (245, 245, 255)
            rr, cc = r * cell_px, c * cell_px
            img_arr[rr : rr + cell_px, cc : cc + cell_px] = color

    Image.fromarray(img_arr).save(path)


# ── tier configs ──────────────────────────────────────────────────────────────

TIERS: dict[str, list[tuple[int, int]]] = {
    "easy":   [(11, 11), (13, 13), (15, 15)],
    "medium": [(21, 21), (25, 25), (29, 29)],
    "hard":   [(41, 41), (51, 51), (61, 61)],
}

CELL_PX = {"easy": 18, "medium": 12, "hard": 8}


# ── main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="Generate maze PNG assets")
    parser.add_argument("--count", type=int, default=3, help="Mazes per tier")
    parser.add_argument("--out",   type=str, default="assets/mazes")
    args = parser.parse_args()

    for tier, sizes in TIERS.items():
        tier_dir = os.path.join(args.out, tier)
        os.makedirs(tier_dir, exist_ok=True)

        for i in range(args.count):
            rows, cols = sizes[i % len(sizes)]
            grid  = generate_maze(rows, cols, seed=i * 31 + hash(tier))
            fname = f"maze_{tier[0]}{i + 1}.png"
            fpath = os.path.join(tier_dir, fname)
            save_maze_png(grid, fpath, cell_px=CELL_PX[tier])
            print(f"  ✓  {fpath}  ({rows}×{cols})")

    print("\nDone.  Run the backend with:  uvicorn main:app --reload")


if __name__ == "__main__":
    main()
