/**
 * LeaderboardPage.jsx
 *
 * Full-page public leaderboard.
 * Shows top 5 unique players per tier, ranked by time.
 * Accessed from the landing page LEADERBOARD button.
 *
 * Props:
 *   onBack()  — navigate back to landing
 */

import { useState, useEffect } from "react";

const TIERS = ["easy", "medium", "hard"];

const TIER_META = {
  easy:   { label: "EASY",   color: "var(--mint)",  dim: "var(--mint-dim)",  rgb: "15,255,160",  glow: "rgba(15,255,160,0.15)"  },
  medium: { label: "MEDIUM", color: "var(--amber)", dim: "var(--amber-dim)", rgb: "255,215,0",   glow: "rgba(255,215,0,0.15)"   },
  hard:   { label: "HARD",   color: "var(--pink)",  dim: "var(--pink-dim)",  rgb: "255,61,127",  glow: "rgba(255,61,127,0.15)"  },
};

const API = "https://mazerl-production.up.railway.app";

export default function LeaderboardPage({ onBack }) {
  const [tier,    setTier]    = useState("easy");
  const [data,    setData]    = useState({});      // cache per tier
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 60);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    fetchTier(tier);
  }, [tier]);

  async function fetchTier(t) {
    if (data[t]) return;           // already cached
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/scores/leaderboard?tier=${t}`);
      if (!res.ok) throw new Error("Failed to load leaderboard.");
      const json = await res.json();
      setData(prev => ({ ...prev, [t]: json.leaderboard || [] }));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const rows  = data[tier] || [];
  const meta  = TIER_META[tier];

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--bg)",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Grid bg */}
      <GridBg />

      {/* Glow orb */}
      <div style={{
        position: "absolute",
        top: "10%", right: "5%",
        width: 400, height: 400,
        borderRadius: "50%",
        background: `radial-gradient(circle, rgba(${meta.rgb},0.06) 0%, transparent 70%)`,
        pointerEvents: "none",
        transition: "background 0.4s",
      }} />

      <div style={{
        position: "relative",
        zIndex: 1,
        maxWidth: 760,
        margin: "0 auto",
        padding: "40px 24px",
        opacity: mounted ? 1 : 0,
        transform: mounted ? "translateY(0)" : "translateY(16px)",
        transition: "opacity 0.5s ease, transform 0.5s ease",
      }}>

        {/* Back */}
        <button
          onClick={onBack}
          className="btn btn-ghost"
          style={{ fontSize: 11, marginBottom: 32, letterSpacing: "0.1em" }}
        >
          ← BACK TO HOME
        </button>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{
            fontFamily: "var(--font-head)",
            fontSize: "clamp(28px, 5vw, 48px)",
            fontWeight: 900,
            letterSpacing: "0.16em",
            color: "var(--amber)",
            textShadow: "0 0 20px rgba(255,215,0,0.4), 0 0 60px rgba(255,215,0,0.15)",
          }}>
            🏆 LEADERBOARD
          </div>
          <div style={{
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            color: "var(--text-muted)",
            letterSpacing: "0.16em",
            marginTop: 10,
          }}>
            TOP 5 PLAYERS · RANKED BY COMPLETION TIME
          </div>
        </div>

        {/* Tier selector buttons */}
        <div style={{
          display: "flex",
          justifyContent: "center",
          gap: 12,
          marginBottom: 32,
        }}>
          {TIERS.map(t => {
            const m      = TIER_META[t];
            const active = t === tier;
            return (
              <button
                key={t}
                onClick={() => setTier(t)}
                style={{
                  background:   active ? `rgba(${m.rgb},0.12)` : "var(--bg2)",
                  border:       `1px solid ${active ? m.color : "var(--border)"}`,
                  borderRadius: "var(--radius)",
                  padding:      "10px 28px",
                  cursor:       "pointer",
                  fontFamily:   "var(--font-head)",
                  fontSize:     11,
                  letterSpacing:"0.14em",
                  color:        active ? m.color : "var(--text-dim)",
                  transition:   "all 0.2s",
                  boxShadow:    active ? `0 0 14px ${m.glow}` : "none",
                  borderBottom: active ? `2px solid ${m.color}` : "1px solid var(--border)",
                }}
              >
                {m.label}
              </button>
            );
          })}
        </div>

        {/* Table card */}
        <div style={{
          background:   "var(--bg2)",
          border:       `1px solid ${meta.dim}`,
          borderTop:    `2px solid ${meta.color}`,
          borderRadius: "var(--radius-lg)",
          overflow:     "hidden",
          boxShadow:    `0 0 30px rgba(${meta.rgb},0.06)`,
          transition:   "border-color 0.3s, box-shadow 0.3s",
        }}>

          {/* Table header */}
          <div style={{
            display:          "grid",
            gridTemplateColumns: "60px 1fr 100px 120px 100px",
            padding:          "12px 20px",
            background:       `rgba(${meta.rgb},0.05)`,
            borderBottom:     `1px solid ${meta.dim}`,
          }}>
            {["RANK", "PLAYER", "SOLVED", "TIME", "STEPS"].map(h => (
              <div key={h} style={{
                fontFamily:    "var(--font-head)",
                fontSize:      9,
                letterSpacing: "0.18em",
                color:         "var(--text-muted)",
                textAlign:     h === "PLAYER" ? "left" : "center",
              }}>{h}</div>
            ))}
          </div>

          {/* Rows */}
          {loading ? (
            <LoadingRow />
          ) : error ? (
            <ErrorRow message={error} />
          ) : rows.length === 0 ? (
            <EmptyRow tier={meta.label} />
          ) : (
            rows.map((row, i) => (
              <TableRow key={row.id || i} row={row} index={i} meta={meta} />
            ))
          )}
        </div>

        {/* Footer note */}
        <div style={{
          marginTop:     24,
          textAlign:     "center",
          fontFamily:    "var(--font-mono)",
          fontSize:      10,
          color:         "var(--text-muted)",
          letterSpacing: "0.08em",
        }}>
          Rankings update after every ranked race · Sign in to compete
        </div>
      </div>
    </div>
  );
}


// ── Table row ─────────────────────────────────────────────────────────────────

function TableRow({ row, index, meta }) {
  const [hovered, setHovered] = useState(false);

  const medals = ["🥇", "🥈", "🥉"];
  const rank   = medals[index] || `#${row.rank}`;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display:             "grid",
        gridTemplateColumns: "60px 1fr 100px 120px 100px",
        padding:             "14px 20px",
        borderBottom:        "1px solid var(--border)",
        background:          hovered ? `rgba(${meta.rgb},0.04)` : "transparent",
        transition:          "background 0.15s",
        alignItems:          "center",
      }}
    >
      {/* Rank */}
      <div style={{
        fontFamily:    "var(--font-head)",
        fontSize:      index < 3 ? 18 : 13,
        color:         index === 0 ? "var(--amber)" : index === 1 ? "var(--text)" : "var(--text-dim)",
        textAlign:     "center",
      }}>
        {rank}
      </div>

      {/* Username */}
      <div style={{
        fontFamily:    "var(--font-mono)",
        fontSize:      13,
        color:         hovered ? meta.color : "var(--text)",
        letterSpacing: "0.04em",
        transition:    "color 0.15s",
      }}>
        {row.username}
      </div>

      {/* Solved */}
      <div style={{
        textAlign:  "center",
        fontSize:   14,
        color:      row.solved ? "var(--mint)" : "var(--pink)",
      }}>
        {row.solved ? "✓" : "✗"}
      </div>

      {/* Time */}
      <div style={{
        textAlign:     "center",
        fontFamily:    "var(--font-head)",
        fontSize:      13,
        color:         hovered ? meta.color : "var(--text)",
        letterSpacing: "0.06em",
        transition:    "color 0.15s",
      }}>
        {row.time_seconds != null ? `${row.time_seconds.toFixed(2)}s` : "—"}
      </div>

      {/* Steps */}
      <div style={{
        textAlign:  "center",
        fontFamily: "var(--font-mono)",
        fontSize:   12,
        color:      "var(--text-dim)",
      }}>
        {row.step_count ?? "—"}
      </div>
    </div>
  );
}


// ── State rows ────────────────────────────────────────────────────────────────

function LoadingRow() {
  return (
    <div style={{ padding: "36px 20px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
      <div style={{ width: 24, height: 24, border: "2px solid var(--border2)", borderTopColor: "var(--amber)", borderRadius: "50%" }} className="spin" />
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-muted)", letterSpacing: "0.1em" }}>
        LOADING…
      </div>
    </div>
  );
}

function ErrorRow({ message }) {
  return (
    <div style={{ padding: "28px 20px", textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--pink)", letterSpacing: "0.06em" }}>
      ⚠ {message}
    </div>
  );
}

function EmptyRow({ tier }) {
  return (
    <div style={{ padding: "36px 20px", textAlign: "center" }}>
      <div style={{ fontFamily: "var(--font-head)", fontSize: 11, color: "var(--text-muted)", letterSpacing: "0.14em", marginBottom: 8 }}>
        NO SCORES YET
      </div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-muted)" }}>
        Be the first to complete a {tier.toLowerCase()} maze in ranked mode!
      </div>
    </div>
  );
}


// ── Grid background ───────────────────────────────────────────────────────────

function GridBg() {
  return (
    <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.15, pointerEvents: "none" }} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="lbgrid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1a2744" strokeWidth="0.8" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#lbgrid)" />
    </svg>
  );
}
