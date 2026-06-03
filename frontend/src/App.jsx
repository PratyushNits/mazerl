/**
 * App.jsx — root screen state machine
 *
 * Screens
 * ───────
 *   landing     → LandingPage   (choose Free Play, Ranked, or Leaderboard)
 *   leaderboard → LeaderboardPage (public top-5 per tier)
 *   auth        → AuthPage      (login / register — ranked only)
 *   ranked      → RankedScreen  (pre-existing mazes only, auth-gated)
 *   upload      → UploadScreen  (pick / upload maze — free play)
 *   racing      → RaceScreen    (player + agent simultaneous race)
 *   result      → ResultScreen  (who won + difficulty controls for next round)
 */

import { useState, useEffect } from "react";
import LandingPage     from "./components/LandingPage.jsx";
import LeaderboardPage   from "./components/LeaderboardPage.jsx";
import PrivacyPolicyPage from "./components/PrivacyPolicyPage.jsx";
import AuthPage        from "./components/AuthPage.jsx";
import RankedScreen    from "./components/RankedScreen.jsx";
import UploadScreen    from "./components/UploadScreen.jsx";
import RaceScreen      from "./components/RaceScreen.jsx";
import ResultScreen    from "./components/ResultScreen.jsx";

const API = "https://mazerl.onrender.com";

export default function App() {
  const [screen,     setScreen]     = useState("landing");
  const [mazeData,   setMazeData]   = useState(null);
  const [raceResult, setRaceResult] = useState(null);
  const [mode,       setMode]       = useState(null);
  const [authToken,  setAuthToken]  = useState(null);
  const [authUser,   setAuthUser]   = useState(null);

  // Restore session from localStorage on mount
  useEffect(() => {
    const token = localStorage.getItem("mazerl_token");
    const user  = localStorage.getItem("mazerl_user");
    if (token && user) {
      try {
        setAuthToken(token);
        setAuthUser(JSON.parse(user));
      } catch {}
    }
  }, []);

  // ── Navigation ──────────────────────────────────────────────────────────────

  function handleFreePlay() {
    setMode("free");
    setScreen("upload");
  }

  function handleRanked() {
    setMode("ranked");
    setScreen(authToken ? "ranked" : "auth");
  }

  function handleLeaderboard() {
    setScreen("leaderboard");
  }

  function handlePrivacy() {
    setScreen("privacy");
  }

  function handleAuth(token, user) {
    setAuthToken(token);
    setAuthUser(user);
    setScreen("ranked");
  }

  function handleLogout() {
    localStorage.removeItem("mazerl_token");
    localStorage.removeItem("mazerl_user");
    setAuthToken(null);
    setAuthUser(null);
    setMode(null);
    setScreen("landing");
  }

  function handleMazeReady(data) {
    setMazeData(data);
    setScreen("racing");
  }

  function handleRaceComplete(result) {
    setRaceResult(result);
    setScreen("result");
  }

  function handleRematch(updatedMazeData) {
    setRaceResult(null);
    setMazeData(updatedMazeData);
    setScreen("racing");
  }

  function handleNewMaze() {
    setMazeData(null);
    setRaceResult(null);
    setScreen(mode === "ranked" ? "ranked" : "upload");
  }

  function handleHome() {
    setMazeData(null);
    setRaceResult(null);
    setMode(null);
    setScreen("landing");
  }

  // ── Header ──────────────────────────────────────────────────────────────────

  const noHeader = ["landing", "auth", "leaderboard", "privacy"];
  const showHeader = !noHeader.includes(screen);

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>

      {showHeader && (
        <header style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 28px",
          borderBottom: "1px solid var(--border)",
          background: "var(--bg2)",
          flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              onClick={handleHome}
              style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 12, padding: 0 }}
            >
              <span
                style={{ fontFamily: "var(--font-head)", fontSize: 18, fontWeight: 900, letterSpacing: "0.12em" }}
                className="text-mint glow-mint"
              >MAZE·RL</span>
            </button>

            {mode === "ranked" ? (
              <span style={{ fontSize: 9, fontFamily: "var(--font-head)", letterSpacing: "0.16em", color: "var(--pink)", border: "1px solid var(--pink-dim)", borderRadius: 3, padding: "2px 8px" }}>★ RANKED</span>
            ) : (
              <span style={{ fontSize: 9, fontFamily: "var(--font-head)", letterSpacing: "0.16em", color: "var(--cyan)", border: "1px solid rgba(0,200,255,0.3)", borderRadius: 3, padding: "2px 8px" }}>FREE PLAY</span>
            )}

            {screen !== "upload" && screen !== "ranked" && (
              <span style={{ fontSize: 11, color: "var(--text-muted)", borderLeft: "1px solid var(--border2)", paddingLeft: 12, letterSpacing: "0.08em" }}>
                RACE THE AGENT
              </span>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {mode === "ranked" && authUser && (
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)", letterSpacing: "0.06em" }}>
                {authUser.username}
              </span>
            )}
            {(screen === "racing" || screen === "result") && (
              <button className="btn btn-ghost" style={{ fontSize: 11 }} onClick={handleNewMaze}>
                ↩ NEW MAZE
              </button>
            )}
          </div>
        </header>
      )}

      <main style={{ flex: 1, overflow: "auto" }}>
        {screen === "landing" && (
          <LandingPage
            onFreePlay={handleFreePlay}
            onRanked={handleRanked}
            onLeaderboard={handleLeaderboard}
            onPrivacy={handlePrivacy}
          />
        )}
        {screen === "leaderboard" && (
          <LeaderboardPage onBack={handleHome} />
        )}
        {screen === "privacy" && (
          <PrivacyPolicyPage onBack={handleHome} />
        )}
        {screen === "auth" && (
          <AuthPage onAuth={handleAuth} onBack={() => setScreen("landing")} />
        )}
        {screen === "ranked" && (
          <RankedScreen
            api={API}
            user={authUser}
            token={authToken}
            onReady={handleMazeReady}
            onLogout={handleLogout}
          />
        )}
        {screen === "upload" && (
          <UploadScreen api={API} onReady={handleMazeReady} />
        )}
        {screen === "racing" && mazeData && (
          <RaceScreen api={API} mazeData={mazeData} onComplete={handleRaceComplete} />
        )}
        {screen === "result" && raceResult && mazeData && (
          <ResultScreen
            api={API}
            result={raceResult}
            mazeData={mazeData}
            onRematch={handleRematch}
            onNewMaze={handleNewMaze}
          />
        )}
      </main>
    </div>
  );
}
