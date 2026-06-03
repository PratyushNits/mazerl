/**
 * RankedScreen.jsx
 *
 * Ranked mode entry: shows only pre-existing maze select options.
 * User must be authenticated (JWT token passed as prop).
 * Calls props.onReady(raceData) when a maze is selected and race starts.
 * Calls props.onLogout() when user signs out.
 */

import { useState } from "react";
import MazeSelectGrid from "./MazeSelectGrid.jsx";

const TIERS = ["easy", "medium", "hard"];

const TIER_META = {
  easy:   { label: "EASY",   color: "var(--mint)",  dim: "var(--mint-dim)",  glow: "rgba(15,255,160,0.15)",  points: "×1.0" },
  medium: { label: "MEDIUM", color: "var(--amber)", dim: "var(--amber-dim)", glow: "rgba(255,215,0,0.15)",   points: "×1.5" },
  hard:   { label: "HARD",   color: "var(--pink)",  dim: "var(--pink-dim)",  glow: "rgba(255,61,127,0.15)",  points: "×2.5" },
};

export default function RankedScreen({ api, user, token, onReady, onLogout }) {
  const [tier,     setTier]     = useState("easy");
  const [starting, setStarting] = useState(false);
  const [error,    setError]    = useState(null);

  async function handleSelect(maze) {
    setStarting(true);
    setError(null);
    try {
      const res  = await fetch(`${api}/race/start`, {
        method:  "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ maze_path: maze.file_path, tier }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to start race");
      onReady({ ...data, ranked: true, tier, token });
    } catch (e) {
      setError(e.message);
      setStarting(false);
    }
  }

  if (starting) {
    return (
      <div style={{
        minHeight: "60vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
      }}>
        <div style={{
          width: 32, height: 32,
          border: "2px solid var(--border2)",
          borderTopColor: "var(--pink)",
          borderRadius: "50%",
        }} className="spin" />
        <div style={{
          fontFamily: "var(--font-head)",
          fontSize: 12,
          letterSpacing: "0.12em",
          color: "var(--pink)",
        }}>LOADING RANKED RACE…</div>
      </div>
    );
  }

  const { color, dim, glow } = TIER_META[tier];

  return (
    <div style={{
      maxWidth: 900,
      margin: "0 auto",
      padding: "32px 24px",
    }}>

      {/* Top bar: ranked badge + user info */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 32,
        paddingBottom: 20,
        borderBottom: "1px solid var(--border)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {/* Ranked badge */}
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 14px",
            background: "rgba(255,61,127,0.08)",
            border: "1px solid var(--pink-dim)",
            borderRadius: "var(--radius)",
          }}>
            <span style={{ color: "var(--pink)", fontSize: 13 }}>★</span>
            <span style={{
              fontFamily: "var(--font-head)",
              fontSize: 11,
              letterSpacing: "0.14em",
              color: "var(--pink)",
            }}>RANKED</span>
          </div>

          <div style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: "var(--text-muted)",
            letterSpacing: "0.06em",
          }}>
            Competing as{" "}
            <span style={{ color: "var(--text)", fontWeight: 600 }}>
              {user?.username || "Unknown"}
            </span>
          </div>
        </div>

        <button
          onClick={onLogout}
          className="btn btn-ghost"
          style={{ fontSize: 11 }}
        >
          SIGN OUT
        </button>
      </div>

      {/* Info strip */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: 14,
        marginBottom: 32,
      }}>
        {[
          { label: "RULES", value: "Agent vs You · Solve fastest" },
          { label: "SCORING", value: "Beat agent for bonus points" },
          { label: "NOTE", value: "Upload mode disabled in Ranked" },
        ].map(({ label, value }) => (
          <div key={label} style={{
            background: "var(--bg2)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            padding: "12px 16px",
          }}>
            <div style={{
              fontFamily: "var(--font-head)",
              fontSize: 9,
              letterSpacing: "0.18em",
              color: "var(--text-muted)",
              marginBottom: 4,
            }}>{label}</div>
            <div style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              color: "var(--text-dim)",
            }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Tier selector */}
      <div style={{ marginBottom: 24 }}>
        <div style={{
          fontFamily: "var(--font-head)",
          fontSize: 10,
          letterSpacing: "0.18em",
          color: "var(--text-muted)",
          marginBottom: 14,
        }}>SELECT DIFFICULTY</div>

        <div style={{ display: "flex", gap: 10 }}>
          {TIERS.map(t => {
            const meta = TIER_META[t];
            const active = t === tier;
            return (
              <button
                key={t}
                onClick={() => setTier(t)}
                style={{
                  background: active ? `rgba(${colorToRgb(meta.color)}, 0.1)` : "var(--bg2)",
                  border: `1px solid ${active ? meta.color : "var(--border)"}`,
                  borderRadius: "var(--radius)",
                  padding: "10px 20px",
                  cursor: "pointer",
                  fontFamily: "var(--font-head)",
                  fontSize: 11,
                  letterSpacing: "0.12em",
                  color: active ? meta.color : "var(--text-dim)",
                  transition: "all 0.18s",
                  boxShadow: active ? `0 0 12px ${meta.glow}` : "none",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                {meta.label}
                <span style={{
                  fontSize: 9,
                  color: active ? meta.color : "var(--text-muted)",
                  borderLeft: "1px solid currentColor",
                  paddingLeft: 8,
                  opacity: 0.8,
                }}>
                  {meta.points}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Active tier banner */}
      <div style={{
        padding: "10px 16px",
        background: `rgba(${colorToRgb(color)}, 0.05)`,
        border: `1px solid ${dim}`,
        borderLeft: `3px solid ${color}`,
        borderRadius: "var(--radius)",
        marginBottom: 24,
        display: "flex",
        alignItems: "center",
        gap: 10,
        fontFamily: "var(--font-mono)",
        fontSize: 11,
        color: "var(--text-dim)",
      }}>
        <span style={{ color, fontSize: 12 }}>⬡</span>
        <span>
          <span style={{ color }}>
            {TIER_META[tier].label}
          </span>
          {" "}difficulty selected — points multiplier{" "}
          <span style={{ color, fontWeight: 600 }}>
            {TIER_META[tier].points}
          </span>
        </span>
      </div>

      {/* Error */}
      {error && (
        <div style={{
          padding: "10px 14px",
          background: "rgba(255,61,127,0.07)",
          border: "1px solid var(--pink-dim)",
          borderRadius: "var(--radius)",
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          color: "var(--pink)",
          marginBottom: 20,
        }}>
          ⚠ {error}
        </div>
      )}

      {/* Maze grid */}
      <MazeSelectGrid api={api} tier={tier} onSelect={handleSelect} />
    </div>
  );
}

// helper: extract rgb values from a CSS var string for rgba() usage
function colorToRgb(cssVar) {
  const map = {
    "var(--mint)":  "15,255,160",
    "var(--amber)": "255,215,0",
    "var(--pink)":  "255,61,127",
    "var(--cyan)":  "0,200,255",
  };
  return map[cssVar] || "255,255,255";
}
