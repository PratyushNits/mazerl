/**
 * MazeSelectGrid.jsx
 *
 * Fetches maze list for a given tier and renders a thumbnail grid.
 * Calls props.onSelect(maze) when the user chooses one.
 */

import { useEffect, useState } from "react";

const TIER_COLORS = {
  easy:   { accent: "var(--mint)",  glow: "rgba(15,255,160,0.2)" },
  medium: { accent: "var(--amber)", glow: "rgba(255,215,0,0.2)"  },
  hard:   { accent: "var(--pink)",  glow: "rgba(255,61,127,0.2)" },
};

export default function MazeSelectGrid({ api, tier, onSelect }) {
  const [mazes,   setMazes]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const [hovered, setHovered] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`${api}/mazes/${tier}`)
      .then(r => r.json())
      .then(d => { setMazes(d.mazes ?? []); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [tier, api]);

  const { accent, glow } = TIER_COLORS[tier] ?? TIER_COLORS.easy;

  if (loading) return (
    <div style={{ textAlign: "center", padding: 48, color: "var(--text-dim)" }}>
      <div style={{
        width: 28, height: 28, margin: "0 auto 12px",
        border: "2px solid var(--border2)",
        borderTopColor: accent,
        borderRadius: "50%",
      }} className="spin" />
      <div style={{ fontSize: 11, letterSpacing: "0.08em" }}>LOADING MAZES…</div>
    </div>
  );

  if (error) return (
    <div style={{ color: "var(--pink)", padding: 24, fontSize: 12 }}>
      ⚠ {error} — make sure the backend is running and mazes are generated.
    </div>
  );

  if (mazes.length === 0) return (
    <div style={{ color: "var(--text-muted)", padding: 24, fontSize: 12 }}>
      No mazes found for tier "{tier}".<br />
      Run <code style={{ color: "var(--mint)" }}>python generate_mazes.py</code> first.
    </div>
  );

  return (
    <div>
      <div style={{
        fontSize: 11,
        letterSpacing: "0.1em",
        color: "var(--text-muted)",
        marginBottom: 16,
      }}>
        {mazes.length} MAZE{mazes.length !== 1 ? "S" : ""} AVAILABLE — SELECT ONE TO BEGIN
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
        gap: 14,
      }}>
        {mazes.map(maze => (
          <MazeTile
            key={maze.id}
            maze={maze}
            accent={accent}
            glow={glow}
            hovered={hovered === maze.id}
            onHover={id => setHovered(id)}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  );
}

// ── Tile ──────────────────────────────────────────────────────────────────────

function MazeTile({ maze, accent, glow, hovered, onHover, onSelect }) {
  return (
    <button
      onClick={() => onSelect(maze)}
      onMouseEnter={() => onHover(maze.id)}
      onMouseLeave={() => onHover(null)}
      style={{
        background: hovered ? "rgba(255,255,255,0.02)" : "var(--bg2)",
        border: `1px solid ${hovered ? accent : "var(--border)"}`,
        borderRadius: "var(--radius-lg)",
        padding: 0,
        cursor: "pointer",
        overflow: "hidden",
        transition: "all 0.18s",
        boxShadow: hovered ? `0 0 18px ${glow}` : "none",
        display: "flex",
        flexDirection: "column",
        transform: hovered ? "translateY(-2px)" : "none",
      }}
    >
      {/* Thumbnail */}
      <div style={{
        width: "100%",
        aspectRatio: "1 / 1",
        background: "var(--bg3)",
        overflow: "hidden",
        position: "relative",
      }}>
        <img
          src={`https://mazerl.onrender.com${maze.thumbnail}`}
          alt={maze.name}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            imageRendering: "pixelated",
            opacity: hovered ? 1 : 0.8,
            transition: "opacity 0.18s",
          }}
        />
        {/* Hover overlay */}
        {hovered && (
          <div style={{
            position: "absolute",
            inset: 0,
            background: `${glow}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}>
            <span style={{
              fontFamily: "var(--font-head)",
              fontSize: 11,
              color: accent,
              letterSpacing: "0.12em",
              background: "rgba(5,8,16,0.85)",
              padding: "6px 12px",
              borderRadius: "var(--radius)",
              border: `1px solid ${accent}`,
            }}>
              SELECT ▶
            </span>
          </div>
        )}
      </div>

      {/* Label */}
      <div style={{
        padding: "10px 12px",
        textAlign: "left",
        borderTop: `1px solid var(--border)`,
      }}>
        <div style={{
          fontFamily: "var(--font-head)",
          fontSize: 11,
          letterSpacing: "0.08em",
          color: hovered ? accent : "var(--text)",
          transition: "color 0.15s",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}>
          {maze.name}
        </div>
        <div style={{
          fontSize: 10,
          color: "var(--text-muted)",
          marginTop: 2,
          letterSpacing: "0.06em",
        }}>
          {maze.tier.toUpperCase()}
        </div>
      </div>
    </button>
  );
}
