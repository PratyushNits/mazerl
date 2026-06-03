/**
 * UploadScreen.jsx
 *
 * Two modes:
 *   "pick"    → tier tabs → MazeSelectGrid thumbnail gallery
 *   "upload"  → drag-and-drop / file picker
 *
 * On selection the component calls POST /race/start and returns
 * the raceData object to props.onReady(raceData).
 */

import { useState, useRef } from "react";
import MazeSelectGrid from "./MazeSelectGrid.jsx";

const TIERS = ["easy", "medium", "hard"];

export default function UploadScreen({ api, onReady }) {
  const [mode,      setMode]      = useState(null);           // "pick" | "upload"
  const [tier,      setTier]      = useState("easy");
  const [dragOver,  setDragOver]  = useState(false);
  const [uploading, setUploading] = useState(false);
  const [starting,  setStarting]  = useState(false);
  const [error,     setError]     = useState(null);
  const fileRef = useRef();

  // ── Helpers ────────────────────────────────────────────────────────────────

  async function startRace(filePath) {
    setStarting(true);
    setError(null);
    try {
      const res  = await fetch(`${api}/race/start`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ maze_path: filePath, tier }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to start race");
      onReady(data);
    } catch (e) {
      setError(e.message);
      setStarting(false);
    }
  }

  async function handleFile(file) {
    if (!file || !file.type.startsWith("image/")) {
      setError("Please upload a PNG or JPG maze image.");
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res  = await fetch(`${api}/maze/upload`, { method: "POST", body: form });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Upload failed");
      await startRace(data.file_path);
    } catch (e) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  }

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  // ── Render helpers ─────────────────────────────────────────────────────────

  if (starting) return <Spinner label="INITIALISING RACE…" />;

  return (
    <div style={{
      maxWidth: 860,
      margin: "0 auto",
      padding: "48px 24px",
    }} className="fade-up">

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      {!mode && (
        <div style={{ textAlign: "center", marginBottom: 56 }}>
          <div style={{
            fontFamily: "var(--font-head)",
            fontSize: "clamp(28px, 5vw, 52px)",
            fontWeight: 900,
            letterSpacing: "0.1em",
            lineHeight: 1.1,
          }} className="text-mint glow-mint">
            TRAIN AN AGENT
          </div>
          <div style={{
            fontFamily: "var(--font-head)",
            fontSize: "clamp(16px, 2.5vw, 24px)",
            color: "var(--text-dim)",
            letterSpacing: "0.2em",
            marginTop: 6,
          }}>
            WATCH IT ESCAPE
          </div>
          <p style={{
            marginTop: 20,
            color: "var(--text-dim)",
            fontSize: 13,
            maxWidth: 480,
            margin: "20px auto 0",
          }}>
            Upload your own maze image or pick from our curated library.
            The Q-learning agent trains in real-time then races to the exit.
          </p>

          <div style={{
            display: "flex",
            gap: 16,
            justifyContent: "center",
            marginTop: 40,
            flexWrap: "wrap",
          }}>
            <ModeCard
              icon="⬡"
              label="PICK A DEFAULT MAZE"
              sub="Curated easy · medium · hard"
              onClick={() => setMode("pick")}
              accent="var(--mint)"
            />
            <ModeCard
              icon="⬆"
              label="UPLOAD YOUR OWN"
              sub="PNG or JPG maze image"
              onClick={() => setMode("upload")}
              accent="var(--cyan)"
            />
          </div>
        </div>
      )}

      {/* ── Pick mode ────────────────────────────────────────────────────── */}
      {mode === "pick" && (
        <div>
          <BackButton onClick={() => setMode(null)} />

          {/* Tier tabs */}
          <div style={{
            display: "flex",
            gap: 4,
            marginBottom: 28,
            borderBottom: "1px solid var(--border)",
          }}>
            {TIERS.map(t => (
              <button
                key={t}
                onClick={() => setTier(t)}
                style={{
                  padding: "10px 22px",
                  background: "none",
                  border: "none",
                  borderBottom: t === tier ? "2px solid var(--mint)" : "2px solid transparent",
                  color: t === tier ? "var(--mint)" : "var(--text-dim)",
                  fontFamily: "var(--font-head)",
                  fontSize: 12,
                  letterSpacing: "0.12em",
                  cursor: "pointer",
                  textTransform: "uppercase",
                  transition: "all 0.15s",
                }}
              >
                {t}
              </button>
            ))}
          </div>

          <MazeSelectGrid
            api={api}
            tier={tier}
            onSelect={(maze) => startRace(maze.file_path)}
          />
        </div>
      )}

      {/* ── Upload mode ──────────────────────────────────────────────────── */}
      {mode === "upload" && (
        <div>
          <BackButton onClick={() => setMode(null)} />

          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            style={{
              border: `2px dashed ${dragOver ? "var(--cyan)" : "var(--border2)"}`,
              borderRadius: "var(--radius-lg)",
              padding: "64px 24px",
              textAlign: "center",
              cursor: "pointer",
              background: dragOver ? "rgba(0,200,255,0.04)" : "var(--bg2)",
              transition: "all 0.2s",
              boxShadow: dragOver ? "0 0 24px rgba(0,200,255,0.15)" : "none",
            }}
          >
            <div style={{ fontSize: 40, marginBottom: 12 }}>⬆</div>
            <div style={{
              fontFamily: "var(--font-head)",
              fontSize: 14,
              letterSpacing: "0.1em",
              color: dragOver ? "var(--cyan)" : "var(--text)",
            }}>
              {uploading ? "UPLOADING…" : "DROP MAZE IMAGE HERE"}
            </div>
            <div style={{
              fontSize: 12,
              color: "var(--text-muted)",
              marginTop: 8,
            }}>
              or click to browse · PNG / JPG supported
            </div>
            <div style={{
              marginTop: 20,
              fontSize: 11,
              color: "var(--text-muted)",
              lineHeight: 1.8,
            }}>
              White = paths &nbsp;·&nbsp; Black = walls<br />
              Top opening = start &nbsp;·&nbsp; Bottom opening = end
            </div>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg"
            style={{ display: "none" }}
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
        </div>
      )}

      {/* ── Error ────────────────────────────────────────────────────────── */}
      {error && (
        <div style={{
          marginTop: 24,
          padding: "12px 16px",
          background: "rgba(255,61,127,0.08)",
          border: "1px solid var(--pink-dim)",
          borderRadius: "var(--radius)",
          color: "var(--pink)",
          fontSize: 12,
        }}>
          ⚠ {error}
        </div>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ModeCard({ icon, label, sub, onClick, accent }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: 240,
        padding: "28px 20px",
        background: hover ? "rgba(255,255,255,0.03)" : "var(--bg2)",
        border: `1px solid ${hover ? accent : "var(--border)"}`,
        borderRadius: "var(--radius-lg)",
        cursor: "pointer",
        textAlign: "center",
        transition: "all 0.2s",
        boxShadow: hover ? `0 0 20px ${accent}30` : "none",
      }}
    >
      <div style={{ fontSize: 30, marginBottom: 10, color: accent }}>{icon}</div>
      <div style={{
        fontFamily: "var(--font-head)",
        fontSize: 12,
        letterSpacing: "0.1em",
        color: hover ? accent : "var(--text)",
        marginBottom: 6,
      }}>
        {label}
      </div>
      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{sub}</div>
    </button>
  );
}

function BackButton({ onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: "none",
        border: "none",
        color: "var(--text-dim)",
        fontFamily: "var(--font-mono)",
        fontSize: 12,
        cursor: "pointer",
        letterSpacing: "0.06em",
        marginBottom: 24,
        padding: "4px 0",
        display: "flex",
        alignItems: "center",
        gap: 6,
        transition: "color 0.15s",
      }}
      onMouseEnter={e => e.currentTarget.style.color = "var(--mint)"}
      onMouseLeave={e => e.currentTarget.style.color = "var(--text-dim)"}
    >
      ← BACK
    </button>
  );
}

function Spinner({ label }) {
  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      height: "60vh",
      gap: 16,
    }}>
      <div style={{
        width: 36,
        height: 36,
        border: "2px solid var(--border2)",
        borderTopColor: "var(--mint)",
        borderRadius: "50%",
      }} className="spin" />
      <div style={{
        fontFamily: "var(--font-head)",
        fontSize: 12,
        letterSpacing: "0.1em",
        color: "var(--mint)",
      }} className="pulse">
        {label}
      </div>
    </div>
  );
}
