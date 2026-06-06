/**
 * RaceScreen.jsx
 *
 * Two canvases side by side:
 *   LEFT  — Player canvas (you control with WASD / arrow keys)
 *   RIGHT — Agent canvas  (RL agent plays automatically)
 *
 * Flow
 * ────
 *  1. Training phase  → agent trains; player canvas shows maze (frozen)
 *  2. Racing phase    → BOTH move simultaneously; player timer starts
 *  3. Either finishes → POST /race/{id}/player_finish if player finishes
 *  4. Agent completes → WS sends "complete"; we call props.onComplete(result)
 *
 * Player controls: Arrow keys or WASD (captured globally during racing phase)
 */

import { useEffect, useRef, useState, useCallback } from "react";
import MazeCanvas from "./MazeCanvas.jsx";

export default function RaceScreen({ api, mazeData, onComplete }) {
  const { race_id, grid, start, end, training_episodes, agent_fps: initFps } = mazeData;

  // ── shared state ────────────────────────────────────────────────────────────
  const [phase,          setPhase]          = useState("connecting");
  const [training,       setTraining]       = useState({ episode: 0, total: training_episodes, progress: 0, metrics: null });

  // agent
  const [agentPath,      setAgentPath]      = useState([start]);
  const [agentPos,       setAgentPos]       = useState(start);

  // player
  const [playerPos,      setPlayerPos]      = useState(start);
  const [playerPath,     setPlayerPath]     = useState([start]);
  const [playerFinished, setPlayerFinished] = useState(false);
  const [playerWon,      setPlayerWon]      = useState(false);

  // timers
  const [agentFps,       setAgentFps]       = useState(initFps ?? 8);
  const [wsError,        setWsError]        = useState(null);

  const wsRef           = useRef(null);
  const phaseRef        = useRef("connecting");
  const playerPosRef    = useRef(start);
  const playerPathRef   = useRef([start]);
  const playerFinRef    = useRef(false);
  const raceStartRef    = useRef(null);   // Date.now() when racing phase begins
  const playerStepsRef  = useRef(0);

  useEffect(() => { phaseRef.current = phase; }, [phase]);

  // ── WebSocket ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (wsRef.current) return;

    const wsBase = api
      ? api.replace(/^http/, "ws")
      : `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}`;
    const ws = new WebSocket(`${wsBase}/race/stream/${race_id}`);
    wsRef.current = ws;
    let dead = false;

    ws.onopen  = () => { if (!dead) setPhase("connecting"); };
    ws.onerror = () => { if (!dead) setWsError("WebSocket error — backend running?"); };

    ws.onmessage = (e) => {
      if (dead) return;
      let msg;
      try { msg = JSON.parse(e.data); } catch { return; }

      switch (msg.type) {
        case "phase":
          setPhase(msg.phase);
          phaseRef.current = msg.phase;
          if (msg.phase === "racing") {
            raceStartRef.current = Date.now();
            if (msg.agent_fps) setAgentFps(msg.agent_fps);
          }
          break;
        case "training_update":
          setTraining({ episode: msg.episode, total: msg.total, progress: msg.progress, metrics: msg.metrics });
          break;
        case "agent_move":
          setAgentPos(msg.position);
          setAgentPath(prev => {
            const next = [...prev, msg.position];
            return next.length > 800 ? next.slice(-800) : next;
          });
          break;
        case "complete":
          setPhase("complete");
          onComplete(msg);
          break;
        case "error":
          setWsError(msg.message);
          break;
        default: break;
      }
    };

    return () => { dead = true; ws.close(); wsRef.current = null; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [race_id]);

  // ── Player movement ─────────────────────────────────────────────────────────
  const movePlayer = useCallback((dr, dc) => {
    if (phaseRef.current !== "racing") return;
    if (playerFinRef.current) return;

    const [r, c] = playerPosRef.current;
    const nr = r + dr;
    const nc = c + dc;

    // bounds + wall check
    if (nr < 0 || nr >= grid.length || nc < 0 || nc >= grid[0].length) return;
    if (grid[nr][nc] === 1) return;

    const newPos = [nr, nc];
    playerPosRef.current = newPos;
    playerStepsRef.current += 1;

    const newPath = [...playerPathRef.current, newPos];
    playerPathRef.current = newPath;

    setPlayerPos(newPos);
    setPlayerPath(newPath);

    // Check if player reached end
    if (nr === end[0] && nc === end[1]) {
      playerFinRef.current = true;
      setPlayerFinished(true);

      const elapsed = raceStartRef.current
        ? (Date.now() - raceStartRef.current) / 1000
        : 0;

      // Tell backend
      fetch(`${api}/race/${race_id}/player_finish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          time_seconds: parseFloat(elapsed.toFixed(2)),
          steps:        playerStepsRef.current,
          solved:       true,
        }),
      }).catch(() => {});

      setPlayerWon(true);   // optimistic; server resolves true winner at complete
    }
  }, [grid, end, api, race_id]);

  // ── Keyboard handler ────────────────────────────────────────────────────────
  useEffect(() => {
    const DIRS = {
      ArrowUp:    [-1,  0], KeyW: [-1,  0],
      ArrowDown:  [ 1,  0], KeyS: [ 1,  0],
      ArrowLeft:  [ 0, -1], KeyA: [ 0, -1],
      ArrowRight: [ 0,  1], KeyD: [ 0,  1],
    };

    const onKey = (e) => {
      const dir = DIRS[e.code];
      if (!dir) return;
      // Prevent page scroll while racing
      if (phaseRef.current === "racing") e.preventDefault();
      movePlayer(dir[0], dir[1]);
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [movePlayer]);

  const isTraining = phase === "training" || phase === "connecting";
  const isRacing   = phase === "racing";

  return (
    <div style={{
      maxWidth: 1100,
      margin: "0 auto",
      padding: "24px 20px",
    }} className="fade-up">

      {/* ── Top status bar ────────────────────────────────────────────────── */}
      <StatusBar
        phase={phase}
        training={training}
        agentFps={agentFps}
        playerFinished={playerFinished}
        playerWon={playerWon}
      />

      {/* ── Dual canvas ───────────────────────────────────────────────────── */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 20,
        marginTop: 20,
        alignItems: "start",
      }}>
        {/* Player side */}
        <div>
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            marginBottom: 8,
          }}>
            <Label color="var(--cyan)">👤 YOU</Label>
            {playerFinished && (
              <span style={{ fontSize: 11, color: "var(--mint)", fontFamily: "var(--font-head)", letterSpacing: "0.08em" }}>
                ✓ FINISHED
              </span>
            )}
          </div>
          <MazeCanvas
            grid={grid}
            start={start}
            end={end}
            agentPath={playerPath}
            currentPos={playerPos}
            phase={phase}
            accentColor="var(--cyan)"
          />
          {isRacing && !playerFinished && (
            <div style={{ marginTop: 6, fontSize: 10, color: "var(--text-muted)", textAlign: "center", letterSpacing: "0.06em" }}>
              WASD or ARROW KEYS to move
            </div>
          )}
        </div>

        {/* Agent side */}
        <div>
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            marginBottom: 8,
          }}>
            <Label color="var(--mint)">🤖 AGENT</Label>
            <span style={{ fontSize: 10, color: "var(--text-muted)", letterSpacing: "0.06em" }}>
              {agentFps.toFixed(1)} FPS
            </span>
          </div>
          <MazeCanvas
            grid={grid}
            start={start}
            end={end}
            agentPath={agentPath}
            currentPos={agentPos}
            phase={phase}
            accentColor="var(--mint)"
          />
          {isTraining && (
            <TrainingOverlay progress={training.progress} />
          )}
        </div>
      </div>

      {wsError && (
        <div style={{
          marginTop: 16, padding: "10px 14px",
          background: "rgba(255,61,127,0.07)", border: "1px solid var(--pink-dim)",
          borderRadius: "var(--radius)", color: "var(--pink)", fontSize: 12,
        }}>⚠ {wsError}</div>
      )}
    </div>
  );
}

// ── Status bar ────────────────────────────────────────────────────────────────

function StatusBar({ phase, training, agentFps, playerFinished }) {
  const phaseColor = {
    connecting: "var(--text-muted)",
    training:   "var(--cyan)",
    racing:     "var(--mint)",
    complete:   "var(--amber)",
  }[phase] ?? "var(--text-muted)";

  const phaseLabel = {
    connecting: "CONNECTING",
    training:   `TRAINING — ${training.progress}%`,
    racing:     "RACE IN PROGRESS",
    complete:   "COMPLETE",
  }[phase] ?? phase.toUpperCase();

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "10px 16px",
      background: "var(--bg2)",
      border: "1px solid var(--border)",
      borderRadius: "var(--radius-lg)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{
          width: 8, height: 8, borderRadius: "50%",
          background: phaseColor, boxShadow: `0 0 6px ${phaseColor}`,
          flexShrink: 0,
          ...((phase === "training" || phase === "racing")
            ? { animation: "pulse 1.2s ease infinite" } : {}),
        }} />
        <span style={{ fontFamily: "var(--font-head)", fontSize: 12, letterSpacing: "0.12em", color: phaseColor }}>
          {phaseLabel}
        </span>
      </div>

      {phase === "training" && (
        <div style={{ width: 160 }}>
          <div className="prog-track">
            <div className="prog-fill" style={{ width: `${training.progress}%` }} />
          </div>
        </div>
      )}

      {phase === "racing" && (
        <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
          <Pill color="var(--cyan)" label="YOU" sub={playerFinished ? "✓ DONE" : "RACING"} />
          <Pill color="var(--mint)" label="AGENT" sub={`${agentFps.toFixed(1)} fps`} />
        </div>
      )}
    </div>
  );
}

function Pill({ color, label, sub }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 9, color: "var(--text-muted)", letterSpacing: "0.08em" }}>{label}</div>
      <div style={{ fontSize: 12, color, fontFamily: "var(--font-head)", letterSpacing: "0.06em" }}>{sub}</div>
    </div>
  );
}

// ── Training overlay on agent canvas ─────────────────────────────────────────

function TrainingOverlay({ progress }) {
  return (
    <div style={{
      marginTop: 8,
      display: "flex",
      alignItems: "center",
      gap: 8,
      padding: "6px 10px",
      background: "var(--bg2)",
      border: "1px solid var(--border)",
      borderRadius: "var(--radius)",
    }}>
      <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--cyan)",
        animation: "pulse 1s ease infinite", flexShrink: 0 }} />
      <div style={{ fontSize: 10, color: "var(--text-dim)", letterSpacing: "0.06em", flex: 1 }}>
        AGENT LEARNING…
      </div>
      <div style={{ fontSize: 11, color: "var(--mint)", fontFamily: "var(--font-head)" }}>
        {progress}%
      </div>
    </div>
  );
}

function Label({ children, color }) {
  return (
    <div style={{
      fontFamily: "var(--font-head)",
      fontSize: 13,
      letterSpacing: "0.1em",
      color: color ?? "var(--text)",
    }}>
      {children}
    </div>
  );
}
