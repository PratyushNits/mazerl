/**
 * ResultScreen.jsx
 *
 * Shows race outcome with:
 *  - Winner banner (Player / Agent / Draw)
 *  - Side-by-side player vs agent stats
 *  - Difficulty adjustment (+20% / -50% agent speed)
 *  - RACE AGAIN button (starts a fresh race via POST /race/start)
 *  - NEW MAZE button
 */

import { useState, useEffect } from "react";
import MazeCanvas from "./MazeCanvas.jsx";

export default function ResultScreen({ api, result, mazeData, onRematch, onNewMaze }) {
  const {
    winner,
    agent_solved, agent_path = [], agent_steps, agent_time_seconds, agent_fps,
    player_solved, player_time_seconds, player_steps,
    metrics = {},
  } = result;

  const { grid, start, end, ranked, tier, token, maze_path } = mazeData;

  const [pendingFps,  setPendingFps]  = useState(agent_fps ?? 8);
  const [adjusting]   = useState(false); // kept for button disabled state compatibility
  const [rematching,  setRematching]  = useState(false);
  const [error,       setError]       = useState(null);
  const [scoreMsg,    setScoreMsg]    = useState(null);

  // Submit score once on mount (ranked mode only)
  useEffect(() => {
    if (!ranked || !tier || !token) return;
    if (player_steps == null || player_time_seconds == null) return;
    (async () => {
      try {
        const res  = await fetch(`/scores/submit`, {
          method:  "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
          body: JSON.stringify({
            tier,
            solved:       player_solved ?? false,
            step_count:   player_steps,
            time_seconds: player_time_seconds,
          }),
        });
        const data = await res.json();
        if (res.ok) setScoreMsg(data.new_record ? "🏅 NEW PERSONAL BEST!" : "Score recorded.");
      } catch {}
    })();
  }, []);

  // ── Difficulty buttons ────────────────────────────────────────────────────
  // Adjust fps locally — applied when the next race starts
  function handleDifficulty(direction) {
    setPendingFps(prev => {
      if (direction === "increase") return Math.min(parseFloat((prev * 1.2).toFixed(2)), 60);
      if (direction === "decrease") return Math.max(parseFloat((prev * 0.5).toFixed(2)), 1);
      return prev;
    });
  }

  // ── Rematch ───────────────────────────────────────────────────────────────
  // Start a completely fresh race with the same maze + adjusted fps
  async function handleRematch() {
    setRematching(true);
    setError(null);
    try {
      const headers = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res  = await fetch(`${api}/race/start`, {
        method:  "POST",
        headers,
        body: JSON.stringify({ maze_path, tier: tier || "easy", agent_fps: pendingFps }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Rematch failed");
      onRematch({ ...mazeData, ...data, agent_fps: pendingFps });
    } catch (e) {
      setError(e.message);
      setRematching(false);
    }
  }

  // ── Winner config ─────────────────────────────────────────────────────────
  const winnerCfg = {
    player: { label: "YOU WIN!",        color: "var(--cyan)",  sub: "You outran the agent 🏆" },
    agent:  { label: "AGENT WINS",      color: "var(--mint)",  sub: "The machine was faster 🤖" },
    draw:   { label: "DRAW!",           color: "var(--amber)", sub: "Both finished within 1 second of each other ⚡" },
    none:   { label: "AGENT DID NOT FINISH", color: "var(--pink)", sub: "Agent ran out of steps — keep training!" },
  }[winner] ?? { label: "RACE OVER", color: "var(--text)", sub: "" };

  const fpsChange = pendingFps !== agent_fps;

  return (
    <div style={{ maxWidth: 1040, margin: "0 auto", padding: "32px 24px" }} className="fade-up">

      {/* ── Winner banner ─────────────────────────────────────────────────── */}
      <div style={{ textAlign: "center", marginBottom: 36 }}>
        <div style={{
          fontFamily: "var(--font-head)",
          fontSize: "clamp(26px, 5vw, 52px)",
          fontWeight: 900,
          letterSpacing: "0.12em",
          color: winnerCfg.color,
          textShadow: `0 0 20px ${winnerCfg.color}, 0 0 50px ${winnerCfg.color}40`,
        }}>
          {winnerCfg.label}
        </div>
        <div style={{ fontSize: 13, color: "var(--text-dim)", marginTop: 6, letterSpacing: "0.08em" }}>
          {winnerCfg.sub}
        </div>
        {scoreMsg && (
          <div style={{ marginTop: 14, padding: "6px 18px", display: "inline-block", background: "rgba(15,255,160,0.08)", border: "1px solid var(--mint-dim)", borderRadius: "var(--radius)", fontFamily: "var(--font-head)", fontSize: 11, letterSpacing: "0.1em", color: "var(--mint)" }}>
            {scoreMsg}
          </div>
        )}
      </div>

      {/* ── Stats + canvases ──────────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 32 }}>

        {/* Player */}
        <ResultPane
          label="👤 YOU"
          color="var(--cyan)"
          won={winner === "player"}
          solved={player_solved}
          steps={player_steps}
          time={player_time_seconds}
          grid={grid}
          start={start}
          end={end}
          path={[]}
          currentPos={player_solved && player_steps ? end : start}
          accentColor="var(--cyan)"
        />

        {/* Agent */}
        <ResultPane
          label="🤖 AGENT"
          color="var(--mint)"
          won={winner === "agent"}
          solved={agent_solved}
          steps={agent_steps}
          time={agent_time_seconds}
          grid={grid}
          start={start}
          end={end}
          path={agent_path}
          currentPos={agent_path[agent_path.length - 1] ?? start}
          accentColor="var(--mint)"
        />
      </div>

      {/* ── Difficulty + rematch ───────────────────────────────────────────── */}
      <div className="card" style={{ maxWidth: 560, margin: "0 auto" }}>
        <div style={{
          fontFamily: "var(--font-head)",
          fontSize: 11,
          letterSpacing: "0.12em",
          color: "var(--text-muted)",
          marginBottom: 16,
          textAlign: "center",
        }}>
          ADJUST DIFFICULTY FOR NEXT ROUND
        </div>

        {/* Current fps display */}
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 10, color: "var(--text-muted)", letterSpacing: "0.08em", marginBottom: 4 }}>
            AGENT SPEED
          </div>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 6 }}>
            <span style={{ fontFamily: "var(--font-head)", fontSize: 32, color: "var(--mint)" }}>
              {pendingFps.toFixed(1)}
            </span>
            <span style={{ fontSize: 12, color: "var(--text-dim)" }}>FPS</span>
            {fpsChange && (
              <span style={{ fontSize: 10, color: "var(--amber)", marginLeft: 4 }}>
                (was {agent_fps?.toFixed(1)})
              </span>
            )}
          </div>
          <SpeedBar fps={pendingFps} />
        </div>

        {/* Difficulty buttons */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
          <DiffBtn
            label="🐢 EASIER"
            sub="Agent −50% speed"
            color="var(--cyan)"
            disabled={adjusting || pendingFps <= 0.5}
            onClick={() => handleDifficulty("decrease")}
          />
          <DiffBtn
            label="🔥 HARDER"
            sub="Agent +20% speed"
            color="var(--pink)"
            disabled={adjusting || pendingFps >= 60}
            onClick={() => handleDifficulty("increase")}
          />
        </div>

        {/* Race again / new maze */}
        <div style={{ display: "flex", gap: 10 }}>
          <button
            className="btn btn-mint"
            style={{ flex: 1, fontSize: 13 }}
            disabled={rematching}
            onClick={handleRematch}
          >
            {rematching ? "⏳ LOADING…" : "▶ RACE AGAIN"}
          </button>
          <button
            className="btn btn-ghost"
            style={{ flex: 1, fontSize: 13 }}
            onClick={onNewMaze}
          >
            ↩ NEW MAZE
          </button>
        </div>

        {error && (
          <div style={{ marginTop: 12, color: "var(--pink)", fontSize: 11 }}>⚠ {error}</div>
        )}
      </div>

      {/* Learning curve */}
      {metrics?.curve && metrics.curve.length > 1 && (
        <div className="card" style={{ maxWidth: 560, margin: "20px auto 0" }}>
          <div style={{ fontFamily: "var(--font-head)", fontSize: 10, letterSpacing: "0.12em", color: "var(--text-muted)", marginBottom: 10 }}>
            AGENT LEARNING CURVE
          </div>
          <LearningCurve curve={metrics.curve} />
        </div>
      )}
    </div>
  );
}

// ── Result pane (one side) ────────────────────────────────────────────────────

function ResultPane({ label, color, won, solved, steps, time, grid, start, end, path, currentPos, accentColor }) {
  return (
    <div style={{
      border: `1px solid ${won ? color : "var(--border)"}`,
      borderRadius: "var(--radius-lg)",
      overflow: "hidden",
      boxShadow: won ? `0 0 20px ${color}30` : "none",
      transition: "box-shadow 0.3s",
    }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 14px",
        background: won ? `${color}12` : "var(--bg2)",
        borderBottom: `1px solid ${won ? color + "40" : "var(--border)"}`,
      }}>
        <span style={{ fontFamily: "var(--font-head)", fontSize: 12, letterSpacing: "0.1em", color }}>{label}</span>
        {won && <span style={{ fontSize: 11, color, fontFamily: "var(--font-head)", letterSpacing: "0.08em" }}>★ WINNER</span>}
      </div>

      {/* Canvas */}
      <div style={{ padding: 10, background: "var(--bg)" }}>
        <MazeCanvas
          grid={grid}
          start={start}
          end={end}
          agentPath={path}
          currentPos={currentPos}
          phase="complete"
          accentColor={accentColor}
        />
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 0, borderTop: "1px solid var(--border)" }}>
        <StatCell label="SOLVED"  value={solved ? "YES" : "NO"} color={solved ? "var(--mint)" : "var(--pink)"} />
        <StatCell label="STEPS"   value={steps ?? "—"} />
        <StatCell label="TIME"    value={time != null ? `${time}s` : "—"} color={won ? color : "var(--text)"} />
      </div>
    </div>
  );
}

function StatCell({ label, value, color = "var(--text)" }) {
  return (
    <div style={{ padding: "10px 12px", borderRight: "1px solid var(--border)", textAlign: "center" }}>
      <div style={{ fontSize: 9, color: "var(--text-muted)", letterSpacing: "0.08em", marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 15, fontFamily: "var(--font-head)", color }}>{value}</div>
    </div>
  );
}

// ── Speed bar visual ─────────────────────────────────────────────────────────

function SpeedBar({ fps }) {
  const pct = Math.min(100, (fps / 60) * 100);
  const col = fps < 5 ? "var(--cyan)" : fps < 20 ? "var(--mint)" : fps < 40 ? "var(--amber)" : "var(--pink)";
  return (
    <div style={{ marginTop: 8, padding: "0 20px" }}>
      <div className="prog-track">
        <div style={{ height: "100%", width: `${pct}%`, background: col, borderRadius: 2, transition: "width 0.4s ease, background 0.4s ease", boxShadow: `0 0 6px ${col}` }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "var(--text-muted)", marginTop: 4 }}>
        <span>SLOW</span><span>FAST</span>
      </div>
    </div>
  );
}

// ── Difficulty button ─────────────────────────────────────────────────────────

function DiffBtn({ label, sub, color, disabled, onClick }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        padding: "14px 10px",
        background: hover && !disabled ? `${color}10` : "transparent",
        border: `1px solid ${hover && !disabled ? color : "var(--border2)"}`,
        borderRadius: "var(--radius)",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.4 : 1,
        transition: "all 0.15s",
        textAlign: "center",
      }}
    >
      <div style={{ fontFamily: "var(--font-head)", fontSize: 12, letterSpacing: "0.08em", color: hover && !disabled ? color : "var(--text)" }}>
        {label}
      </div>
      <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 4 }}>{sub}</div>
    </button>
  );
}

// ── Learning curve ────────────────────────────────────────────────────────────

function LearningCurve({ curve }) {
  const W = 480, H = 60;
  const maxSteps = Math.max(...curve.map(p => p.steps), 1);
  const pts = curve.map((p, i) => {
    const x = (i / (curve.length - 1)) * W;
    const y = H - (p.steps / maxSteps) * (H - 4);
    return [x.toFixed(1), y.toFixed(1)];
  });
  const polyline = pts.map(p => p.join(",")).join(" ");
  const area = [`0,${H}`, ...pts.map(p => p.join(",")), `${W},${H}`].join(" ");
  const best = Math.min(...curve.map(p => p.steps));
  const bestY = H - (best / maxSteps) * (H - 4);

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: "block", overflow: "visible" }}>
      <polygon points={area} fill="rgba(15,255,160,0.04)" />
      <polyline points={polyline} fill="none" stroke="var(--mint-dim)" strokeWidth="1.5" strokeLinejoin="round" />
      <line x1="0" y1={bestY} x2={W} y2={bestY} stroke="var(--amber)" strokeWidth="0.8" strokeDasharray="4 3" opacity="0.6" />
      {curve.filter(p => p.solved).map((p, i) => {
        const idx = curve.indexOf(p);
        const x = (idx / (curve.length - 1)) * W;
        const y = H - (p.steps / maxSteps) * (H - 4);
        return <circle key={i} cx={x.toFixed(1)} cy={y.toFixed(1)} r="2" fill="var(--mint)" opacity="0.9" />;
      })}
    </svg>
  );
}
