"""
maze_parser.py
Converts a maze PNG into a 2-D binary grid.

Convention
----------
  0 = passable cell (white / light pixel)
  1 = wall          (dark pixel)

Terminal detection (robust)
──────────────────────────
1. Pre-binarise the image to pure black/white BEFORE scaling.
   This eliminates JPEG compression artifacts that create false openings.

2. Scan all 4 borders and collect every contiguous run of open cells,
   skipping the outermost 10% at each end (corner exclusion zone).

3. For each run, take the centre cell and validate it has an open
   inward neighbour (the cell one step into the maze interior).
   This filters isolated border pixels that don't connect to anything.

4. From validated candidates:
     - If top AND bottom openings exist → top=start, bottom=end
     - Otherwise → pick the two candidates furthest apart (Euclidean)

5. Hard fallback if no validated openings: raw first-open-cell scan,
   then hardcoded (1,1) / (rows-2, cols-2).
"""

from __future__ import annotations

import numpy as np
from PIL import Image


MAX_DIM = 81


class MazeParser:
    def parse(
        self, image_path: str
    ) -> tuple[list[list[int]], tuple[int, int], tuple[int, int]]:
        img   = self._load_and_scale(image_path)
        grid  = self._to_binary(img)
        start, end = self._find_terminals(grid)
        return grid, start, end

    # ── image loading ─────────────────────────────────────────────────────────

    def _load_and_scale(self, path: str) -> Image.Image:
        img = Image.open(path).convert("RGB")

        # ── Step 1: Hard-threshold to pure B&W ────────────────────────────────
        arr  = np.array(img, dtype=np.float32)
        gray = arr.mean(axis=2)
        bw   = np.where(gray < 128, 0, 255).astype(np.uint8)
        h_img, w_img = bw.shape

        # ── Step 2: Auto-crop uniform-colour padding ───────────────────────────
        # Detect the dominant border colour (top-left 3×3 corner average).
        # If the border is mostly that colour, crop it away.
        corner_val = int(bw[:3, :3].mean())        # 0 = black border, 255 = white
        pad_color  = 0 if corner_val < 128 else 255

        if pad_color == 0:
            # Crop black padding: find rows/cols that contain at least one white pixel
            content_rows = np.any(bw == 255, axis=1)
            content_cols = np.any(bw == 255, axis=0)
        else:
            # Crop white padding: find rows/cols that contain at least one black pixel
            content_rows = np.any(bw == 0, axis=1)
            content_cols = np.any(bw == 0, axis=0)

        if content_rows.any() and content_cols.any():
            r_min = int(np.argmax(content_rows))
            r_max = int(h_img - 1 - np.argmax(content_rows[::-1]))
            c_min = int(np.argmax(content_cols))
            c_max = int(w_img - 1 - np.argmax(content_cols[::-1]))

            # Only crop if padding is at least 3% on any side — avoids
            # accidentally cropping single-pixel outer walls of the maze itself
            if (r_min > h_img * 0.03 or r_max < h_img * 0.97 or
                c_min > w_img * 0.03 or c_max < w_img * 0.97):
                bw = bw[r_min : r_max + 1, c_min : c_max + 1]

        # ── Step 3: Downscale with NEAREST ────────────────────────────────────
        bw3    = np.stack([bw, bw, bw], axis=2).astype(np.uint8)
        img    = Image.fromarray(bw3)
        cw, ch = img.size
        scale  = max(cw / MAX_DIM, ch / MAX_DIM, 1)
        new_w  = max(3, int(cw / scale))
        new_h  = max(3, int(ch / scale))
        img    = img.resize((new_w, new_h), Image.NEAREST)
        return img

    def _to_binary(self, img: Image.Image) -> list[list[int]]:
        arr    = np.array(img, dtype=np.float32)
        gray   = arr.mean(axis=2)
        binary = (gray < 128).astype(np.int8)
        return binary.tolist()

    # ── terminal detection ────────────────────────────────────────────────────

    def _find_terminals(
        self, grid: list[list[int]]
    ) -> tuple[tuple[int, int], tuple[int, int]]:
        rows = len(grid)
        cols = len(grid[0])

        top_gaps    = self._border_gap_centres(grid, "top",    rows, cols)
        bottom_gaps = self._border_gap_centres(grid, "bottom", rows, cols)
        left_gaps   = self._border_gap_centres(grid, "left",   rows, cols)
        right_gaps  = self._border_gap_centres(grid, "right",  rows, cols)

        all_candidates = top_gaps + bottom_gaps + left_gaps + right_gaps

        if len(all_candidates) >= 2:
            # Ideal case: one opening on top, one on bottom
            if top_gaps and bottom_gaps:
                return top_gaps[0], bottom_gaps[-1]
            # One on left, one on right
            if left_gaps and right_gaps:
                return left_gaps[0], right_gaps[-1]
            # Mix — pick the pair with greatest spatial separation
            return self._most_distant_pair(all_candidates)

        if len(all_candidates) == 1:
            only = all_candidates[0]
            fallback = (rows - 2, cols - 2)
            if only == fallback:
                fallback = (1, 1)
            return only, fallback

        # Hard fallback: raw scan without validation
        start = (self._first_open(grid, "top",    rows, cols) or
                 self._first_open(grid, "left",   rows, cols) or
                 (1, 1))
        end   = (self._first_open(grid, "bottom", rows, cols) or
                 self._first_open(grid, "right",  rows, cols) or
                 (rows - 2, cols - 2))
        if start == end:
            end = (rows - 2, cols - 2)
        return start, end

    # ── gap detection ─────────────────────────────────────────────────────────

    def _border_gap_centres(
        self,
        grid:   list[list[int]],
        border: str,
        rows:   int,
        cols:   int,
    ) -> list[tuple[int, int]]:
        """
        Find all validated entrance gaps on one border.

        Scans ALL cells on the border (no corner margin — pre-binarisation
        already eliminated compression artifacts). Groups contiguous open
        cells into runs and takes the centre of each run. Validates that
        the centre has an open cell within 3 steps inward (handles 1, 2,
        or 3-cell-thick outer walls).
        """
        if border == "top":
            cells = [(0, c) for c in range(cols)]
        elif border == "bottom":
            cells = [(rows - 1, c) for c in range(cols)]
        elif border == "left":
            cells = [(r, 0) for r in range(rows)]
        else:
            cells = [(r, cols - 1) for r in range(rows)]

        # Group consecutive open cells into runs
        runs: list[list[tuple[int, int]]] = []
        cur:  list[tuple[int, int]] = []
        for r, c in cells:
            if grid[r][c] == 0:
                cur.append((r, c))
            else:
                if cur:
                    runs.append(cur)
                    cur = []
        if cur:
            runs.append(cur)

        # For each run take centre cell and validate inward connectivity
        results: list[tuple[int, int]] = []
        for run in runs:
            centre = run[len(run) // 2]
            if self._has_inward_path(grid, centre, border, rows, cols):
                results.append(centre)

        return results

    def _has_inward_path(
        self,
        grid:   list[list[int]],
        cell:   tuple[int, int],
        border: str,
        rows:   int,
        cols:   int,
    ) -> bool:
        """
        Return True if there is any open cell within 3 steps inward.
        Walks all 3 steps so thick outer walls (up to 3 cells) are handled.
        """
        r, c = cell
        if border == "top":
            steps = [(r + i, c) for i in range(1, 4)]
        elif border == "bottom":
            steps = [(r - i, c) for i in range(1, 4)]
        elif border == "left":
            steps = [(r, c + i) for i in range(1, 4)]
        else:
            steps = [(r, c - i) for i in range(1, 4)]

        for nr, nc in steps:
            if 0 <= nr < rows and 0 <= nc < cols:
                if grid[nr][nc] == 0:
                    return True

        return False

    # ── utilities ─────────────────────────────────────────────────────────────

    @staticmethod
    def _most_distant_pair(
        candidates: list[tuple[int, int]]
    ) -> tuple[tuple[int, int], tuple[int, int]]:
        best_d = -1.0
        best   = (candidates[0], candidates[-1])
        for i in range(len(candidates)):
            for j in range(i + 1, len(candidates)):
                a, b = candidates[i], candidates[j]
                d    = ((a[0]-b[0])**2 + (a[1]-b[1])**2) ** 0.5
                if d > best_d:
                    best_d = d
                    best   = (a, b)
        return best

    @staticmethod
    def _first_open(
        grid: list[list[int]], border: str, rows: int, cols: int
    ) -> tuple[int, int] | None:
        if border == "top":
            for c in range(cols):
                if grid[0][c] == 0:       return (0, c)
        elif border == "bottom":
            for c in range(cols):
                if grid[rows-1][c] == 0:  return (rows-1, c)
        elif border == "left":
            for r in range(rows):
                if grid[r][0] == 0:       return (r, 0)
        elif border == "right":
            for r in range(rows):
                if grid[r][cols-1] == 0:  return (r, cols-1)
        return None
