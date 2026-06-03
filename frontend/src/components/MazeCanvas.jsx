/**
 * MazeCanvas.jsx
 *
 * Renders the maze grid and animated agent onto an HTML5 Canvas.
 *
 * Props
 * -----
 *   grid        : number[][]    – 0=path, 1=wall
 *   start       : [r,c]
 *   end         : [r,c]
 *   agentPath   : [r,c][]      – accumulated positions (trail)
 *   currentPos  : [r,c]        – agent head
 *   phase       : string       – "training" | "racing" | "complete"
 */

import { useRef, useEffect, useMemo } from "react";

// ── colours ───────────────────────────────────────────────────────────────────
const C = {
  wall:     "#1a2744",   // was #10192e — brighter blue-grey wall
  wallEdge: "#243460",   // was #0a1020 — visible edge lines
  path:     "#050810",   // path stays dark
  start:    "#00ff88",   // bright green S
  end:      "#ffd700",   // bright gold E
};

// Max canvas dimension — responsive to viewport so both canvases fit side by side
// In the race layout there are two canvases; each gets roughly half the viewport.
const getMaxPx = () => Math.min(480, Math.floor((window.innerWidth - 120) / 2));

export default function MazeCanvas({
  grid,
  start,
  end,
  agentPath   = [],
  currentPos  = null,
  phase       = "training",
  accentColor = null,
}) {
  const canvasRef = useRef(null);

  // Compute cell size — recalculate if window resizes
  const { rows, cols, cellPx } = useMemo(() => {
    if (!grid || !grid.length) return { rows: 0, cols: 0, cellPx: 10 };
    const r   = grid.length;
    const c   = grid[0].length;
    const max = getMaxPx();
    const px  = Math.max(3, Math.floor(max / Math.max(r, c)));
    return { rows: r, cols: c, cellPx: px };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grid]);

  const canvasW = cols * cellPx;
  const canvasH = rows * cellPx;

  // ── Resolve accent colours (used in both useEffect and JSX) ─────────────────
  const isCyan   = accentColor && accentColor.includes("cyan");
  const dotColor = isCyan ? "#00c8ff" : "#0fffa0";
  const dotGlow  = isCyan ? "rgba(0,200,255,0.7)"  : "rgba(15,255,160,0.7)";
  const trailRgb = isCyan ? "0,200,255"            : "15,255,160";
  const glowBox  = isCyan ? "rgba(0,200,255,0.15)" : "rgba(15,255,160,0.15)";

  useEffect(() => {
    if (!grid || !grid.length) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    // ── Clear ──────────────────────────────────────────────────────────────
    ctx.clearRect(0, 0, canvasW, canvasH);

    // ── Draw grid ──────────────────────────────────────────────────────────
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        ctx.fillStyle = grid[r][c] === 1 ? C.wall : C.path;
        ctx.fillRect(c * cellPx, r * cellPx, cellPx, cellPx);
      }
    }

    // Wall edges — always draw for contrast regardless of cell size
    ctx.strokeStyle = C.wallEdge;
    ctx.lineWidth   = cellPx >= 6 ? 0.8 : 0.4;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (grid[r][c] === 1) {
          ctx.strokeRect(c * cellPx + 0.5, r * cellPx + 0.5, cellPx - 1, cellPx - 1);
        }
      }
    }

    // Subtle path grid lines to help player navigation
    if (cellPx >= 6) {
      ctx.strokeStyle = "rgba(255,255,255,0.05)";
      ctx.lineWidth   = 0.4;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (grid[r][c] === 0) {
            ctx.strokeRect(c * cellPx, r * cellPx, cellPx, cellPx);
          }
        }
      }
    }

    // ── Start marker ───────────────────────────────────────────────────────
    if (start) {
      drawMarker(ctx, start[0], start[1], cellPx, C.start, "S");
    }

    // ── End marker ─────────────────────────────────────────────────────────
    if (end) {
      drawMarker(ctx, end[0], end[1], cellPx, C.end, "E");
    }

    // ── Agent trail ────────────────────────────────────────────────────────
    if (agentPath.length > 1) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (let i = 1; i < agentPath.length; i++) {
        const alpha = 0.04 + (i / agentPath.length) * 0.35;
        ctx.fillStyle = `rgba(${trailRgb},${alpha.toFixed(3)})`;
        const [r, c] = agentPath[i];
        ctx.fillRect(c * cellPx, r * cellPx, cellPx, cellPx);
      }
      ctx.restore();
    }

    // ── Agent head ─────────────────────────────────────────────────────────
    if (currentPos) {
      const [r, c] = currentPos;
      const cx     = c * cellPx + cellPx / 2;
      const cy     = r * cellPx + cellPx / 2;
      const radius = Math.max(1.5, cellPx * 0.38);

      const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 3);
      grd.addColorStop(0, dotGlow);
      grd.addColorStop(1, "transparent");
      ctx.fillStyle = grd;
      ctx.fillRect(cx - radius * 3, cy - radius * 3, radius * 6, radius * 6);

      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fillStyle   = dotColor;
      ctx.shadowColor = dotColor;
      ctx.shadowBlur  = cellPx * 1.5;
      ctx.fill();
      ctx.shadowBlur  = 0;
    }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grid, agentPath, currentPos, rows, cols, cellPx, accentColor]);

  return (
    <div style={{ position: "relative", lineHeight: 0 }}>
      <canvas
        ref={canvasRef}
        width={canvasW}
        height={canvasH}
        style={{
          display: "block",
          borderRadius: "var(--radius)",
          border: "1px solid var(--border)",
          boxShadow: phase === "racing"
            ? `0 0 30px ${glowBox}`
            : "none",
          imageRendering: "pixelated",
          maxWidth: "100%",
        }}
      />

      {/* Phase label overlay */}
      <div style={{
        position: "absolute",
        top: 8,
        right: 8,
        fontSize: 10,
        letterSpacing: "0.1em",
        color: phase === "racing" ? dotColor : "var(--text-muted)",
        background: "rgba(5,8,16,0.8)",
        padding: "3px 8px",
        borderRadius: "var(--radius)",
        fontFamily: "var(--font-head)",
        border: "1px solid var(--border)",
      }}>
        {phase.toUpperCase()}
      </div>
    </div>
  );
}

// ── helpers ───────────────────────────────────────────────────────────────────

function drawMarker(ctx, row, col, cellPx, color, label) {
  const x = col * cellPx;
  const y = row * cellPx;
  const pad = Math.max(1, Math.floor(cellPx * 0.1));

  ctx.fillStyle = color + "33";   // translucent fill
  ctx.fillRect(x + pad, y + pad, cellPx - pad * 2, cellPx - pad * 2);

  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1, cellPx * 0.12);
  ctx.strokeRect(x + pad, y + pad, cellPx - pad * 2, cellPx - pad * 2);

  if (cellPx >= 12) {
    ctx.fillStyle = color;
    ctx.font = `bold ${Math.floor(cellPx * 0.55)}px var(--font-head, monospace)`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, x + cellPx / 2, y + cellPx / 2);
  }
}
