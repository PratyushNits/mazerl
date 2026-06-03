/**
 * LandingPage.jsx
 *
 * Entry point: choose Free Play or Ranked mode.
 * Free Play → UploadScreen (existing flow)
 * Ranked    → AuthPage (login/register) → MazeSelectGrid only
 */

import { useState, useEffect } from "react";

export default function LandingPage({ onFreePlay, onRanked, onLeaderboard, onPrivacy }) {
  const [hovered, setHovered] = useState(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 80);
    return () => clearTimeout(t);
  }, []);

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      position: "relative",
      overflow: "hidden",
      background: "var(--bg)",
    }}>
      {/* Animated grid background */}
      <GridBg />

      {/* Glowing orbs */}
      <div style={{
        position: "absolute",
        top: "15%", left: "10%",
        width: 340, height: 340,
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(15,255,160,0.06) 0%, transparent 70%)",
        pointerEvents: "none",
        animation: "pulseOrb 4s ease-in-out infinite",
      }} />
      <div style={{
        position: "absolute",
        bottom: "10%", right: "8%",
        width: 280, height: 280,
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(255,61,127,0.06) 0%, transparent 70%)",
        pointerEvents: "none",
        animation: "pulseOrb 5s ease-in-out infinite 1.5s",
      }} />

      {/* Center content */}
      <div style={{
        position: "relative",
        zIndex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 0,
        opacity: mounted ? 1 : 0,
        transform: mounted ? "translateY(0)" : "translateY(24px)",
        transition: "opacity 0.6s ease, transform 0.6s ease",
      }}>

        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 12 }}>
          <div style={{
            fontFamily: "var(--font-head)",
            fontSize: "clamp(48px, 8vw, 80px)",
            fontWeight: 900,
            letterSpacing: "0.18em",
            color: "var(--mint)",
            textShadow: "0 0 20px var(--mint), 0 0 60px var(--mint-glow), 0 0 100px var(--mint-glow)",
            lineHeight: 1,
          }}>MAZE·RL</div>
          <div style={{
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            letterSpacing: "0.25em",
            color: "var(--text-muted)",
            marginTop: 10,
            textTransform: "uppercase",
          }}>
            Reinforcement Learning Maze Solver
          </div>
        </div>

        {/* Divider */}
        <div style={{
          width: 200,
          height: 1,
          background: "linear-gradient(90deg, transparent, var(--border2), transparent)",
          margin: "28px 0",
        }} />

        {/* Subtitle */}
        <div style={{
          fontFamily: "var(--font-mono)",
          fontSize: 13,
          color: "var(--text-dim)",
          letterSpacing: "0.08em",
          marginBottom: 48,
          textAlign: "center",
          maxWidth: 400,
          lineHeight: 1.8,
        }}>
          Choose your mode. Race the agent or climb the leaderboard.
        </div>

        {/* Mode cards */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 20,
          width: "100%",
          maxWidth: 580,
        }}>
          <ModeCard
            id="free"
            title="FREE PLAY"
            subtitle="No account needed"
            description="Upload any maze or pick from our library. Race the RL agent at your own pace."
            icon={<FreeIcon />}
            accent="var(--cyan)"
            glow="rgba(0,200,255,0.18)"
            glowSoft="rgba(0,200,255,0.06)"
            badge="OPEN ACCESS"
            badgeColor="var(--cyan)"
            hovered={hovered === "free"}
            onHover={setHovered}
            onClick={onFreePlay}
          />
          <ModeCard
            id="ranked"
            title="RANKED"
            subtitle="Sign in to compete"
            description="Challenge pre-built mazes, earn a score, and climb the global leaderboard."
            icon={<RankedIcon />}
            accent="var(--pink)"
            glow="rgba(255,61,127,0.18)"
            glowSoft="rgba(255,61,127,0.06)"
            badge="LOGIN REQUIRED"
            badgeColor="var(--pink)"
            hovered={hovered === "ranked"}
            onHover={setHovered}
            onClick={onRanked}
          />
        </div>

        {/* Leaderboard button */}
        <button
          onClick={onLeaderboard}
          style={{
            marginTop: 32,
            background: "transparent",
            border: "1px solid var(--amber)",
            borderRadius: "var(--radius)",
            padding: "10px 32px",
            cursor: "pointer",
            fontFamily: "var(--font-head)",
            fontSize: 11,
            letterSpacing: "0.16em",
            color: "var(--amber)",
            transition: "all 0.2s",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = "rgba(255,215,0,0.08)";
            e.currentTarget.style.boxShadow  = "0 0 16px rgba(255,215,0,0.2)";
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.boxShadow  = "none";
          }}
        >
          🏆 LEADERBOARD
        </button>

        {/* Footer note */}
        <div style={{
          marginTop: 28,
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          color: "var(--text-muted)",
          letterSpacing: "0.1em",
          textAlign: "center",
        }}>
          POWERED BY Q-LEARNING · BUILT WITH REACT + FASTAPI
        </div>
      </div>

      <style>{`
        @keyframes pulseOrb {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.15); opacity: 0.6; }
        }
        @keyframes gridMove {
          from { transform: translateY(0); }
          to { transform: translateY(40px); }
        }
        @keyframes borderGlow {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>

      {/* Privacy Policy footer */}
      <div style={{
        position: "absolute",
        bottom: 0, left: 0, right: 0,
        padding: "16px 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        borderTop: "1px solid var(--border)",
        background: "rgba(5,8,16,0.7)",
        backdropFilter: "blur(4px)",
        zIndex: 2,
      }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-muted)", letterSpacing: "0.08em" }}>
          © 2026 MAZE·RL
        </span>
        <span style={{ color: "var(--border2)", fontSize: 9 }}>·</span>
        <button
          onClick={onPrivacy}
          style={{
            background: "none", border: "none", cursor: "pointer",
            fontFamily: "var(--font-mono)", fontSize: 9,
            color: "var(--text-muted)", letterSpacing: "0.08em",
            textDecoration: "underline",
            transition: "color 0.15s",
          }}
          onMouseEnter={e => e.currentTarget.style.color = "var(--mint)"}
          onMouseLeave={e => e.currentTarget.style.color = "var(--text-muted)"}
        >
          Privacy Policy
        </button>
        <span style={{ color: "var(--border2)", fontSize: 9 }}>·</span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-muted)", letterSpacing: "0.08em" }}>
          BUILT WITH REACT + FASTAPI
        </span>
      </div>
    </div>
  );
}

// ── Mode Card ─────────────────────────────────────────────────────────────────

function ModeCard({ id, title, subtitle, description, icon, accent, glow, glowSoft, badge, badgeColor, hovered, onHover, onClick }) {
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => onHover(id)}
      onMouseLeave={() => onHover(null)}
      style={{
        background: hovered ? glowSoft : "var(--bg2)",
        border: `1px solid ${hovered ? accent : "var(--border)"}`,
        borderRadius: "var(--radius-lg)",
        padding: "28px 24px",
        cursor: "pointer",
        textAlign: "left",
        transition: "all 0.22s ease",
        boxShadow: hovered ? `0 0 30px ${glow}, 0 0 60px ${glow}` : "none",
        transform: hovered ? "translateY(-4px)" : "none",
        display: "flex",
        flexDirection: "column",
        gap: 14,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Top corner accent line */}
      {hovered && (
        <div style={{
          position: "absolute",
          top: 0, left: 0,
          width: "100%", height: 2,
          background: `linear-gradient(90deg, ${accent}, transparent)`,
        }} />
      )}

      {/* Badge */}
      <div style={{
        alignSelf: "flex-start",
        fontSize: 9,
        fontFamily: "var(--font-head)",
        letterSpacing: "0.14em",
        color: badgeColor,
        border: `1px solid ${badgeColor}`,
        borderRadius: 3,
        padding: "2px 8px",
        opacity: 0.8,
      }}>{badge}</div>

      {/* Icon */}
      <div style={{
        width: 48, height: 48,
        borderRadius: 10,
        background: `${glow}`,
        border: `1px solid ${hovered ? accent : "var(--border)"}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 22,
        transition: "all 0.22s",
      }}>
        {icon}
      </div>

      {/* Title */}
      <div>
        <div style={{
          fontFamily: "var(--font-head)",
          fontSize: 16,
          fontWeight: 700,
          letterSpacing: "0.12em",
          color: hovered ? accent : "var(--text)",
          transition: "color 0.2s",
          marginBottom: 4,
        }}>{title}</div>
        <div style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          color: "var(--text-muted)",
          letterSpacing: "0.08em",
        }}>{subtitle}</div>
      </div>

      {/* Description */}
      <div style={{
        fontFamily: "var(--font-mono)",
        fontSize: 11,
        color: "var(--text-dim)",
        lineHeight: 1.7,
        letterSpacing: "0.04em",
      }}>{description}</div>

      {/* CTA */}
      <div style={{
        fontFamily: "var(--font-head)",
        fontSize: 11,
        color: accent,
        letterSpacing: "0.1em",
        marginTop: 4,
        opacity: hovered ? 1 : 0.5,
        transition: "opacity 0.2s",
      }}>
        {hovered ? "▶  ENTER" : "——  SELECT"}
      </div>
    </button>
  );
}

// ── Grid background ────────────────────────────────────────────────────────────

function GridBg() {
  return (
    <svg
      style={{
        position: "absolute", inset: 0,
        width: "100%", height: "100%",
        opacity: 0.18, pointerEvents: "none",
      }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1a2744" strokeWidth="0.8" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#grid)" />
    </svg>
  );
}

// ── Icons ──────────────────────────────────────────────────────────────────────

function FreeIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="3" width="18" height="18" rx="2" stroke="#00c8ff" strokeWidth="1.5"/>
      <path d="M7 12h10M12 7v10" stroke="#00c8ff" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

function RankedIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M12 2L14.5 8.5H21L15.7 12.7L17.8 19L12 15L6.2 19L8.3 12.7L3 8.5H9.5L12 2Z"
        stroke="#ff3d7f" strokeWidth="1.5" strokeLinejoin="round"/>
    </svg>
  );
}
