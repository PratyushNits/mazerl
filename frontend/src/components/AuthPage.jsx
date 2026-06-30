/**
 * AuthPage.jsx
 *
 * Three tabs: LOGIN | REGISTER | RESET PASSWORD
 *
 * LOGIN      — username + password → POST /auth/login
 * REGISTER   — username + email + password + confirm password → POST /auth/register
 *              Shows welcome email confirmation note on success.
 * RESET      — Step 1: enter email → POST /auth/forgot-password
 *              Step 2: enter code + new password → POST /auth/reset-password
 *              On success, auto-switches to LOGIN tab after 2s.
 */

import { useState, useEffect } from "react";

const API = "https://mazerl-production.up.railway.app";

const TABS = [
  { id: "login",    label: "LOGIN"          },
  { id: "register", label: "REGISTER"       },
  { id: "reset",    label: "RESET PASSWORD" },
];

export default function AuthPage({ onAuth, onBack }) {
  const [mode,    setMode]    = useState("login");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 60);
    return () => clearTimeout(t);
  }, []);

  function switchMode(m) { setMode(m); }

  const headerText = {
    login:    { title: "SIGN IN",        sub: "Sign in to access ranked maze challenges." },
    register: { title: "CREATE ACCOUNT", sub: "Register to start competing on the leaderboard." },
    reset:    { title: "RESET PASSWORD", sub: "Enter your email to receive a reset code." },
  }[mode];

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "var(--bg)",
      position: "relative",
      overflow: "hidden",
    }}>
      <GridBg />

      <div style={{
        position: "absolute", top: "20%", right: "15%",
        width: 300, height: 300, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(255,61,127,0.07) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute", bottom: "15%", left: "10%",
        width: 240, height: 240, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(15,255,160,0.05) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      <div style={{
        position: "relative", zIndex: 1,
        width: "100%", maxWidth: 440, padding: "0 20px",
        opacity: mounted ? 1 : 0,
        transform: mounted ? "translateY(0)" : "translateY(20px)",
        transition: "opacity 0.5s ease, transform 0.5s ease",
      }}>
        <button onClick={onBack} className="btn btn-ghost"
          style={{ fontSize: 11, marginBottom: 28, letterSpacing: "0.1em" }}>
          ← BACK
        </button>

        <div style={{
          background: "var(--bg2)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)",
          padding: "36px 32px",
          position: "relative",
          overflow: "hidden",
        }}>
          {/* Top accent bar */}
          <div style={{
            position: "absolute", top: 0, left: 0,
            width: "100%", height: 2,
            background: "linear-gradient(90deg, var(--pink), var(--pink-dim), transparent)",
          }} />

          {/* Header */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontFamily: "var(--font-head)", fontSize: 11, letterSpacing: "0.2em", color: "var(--pink)", marginBottom: 6 }}>
              ★ RANKED MODE
            </div>
            <div style={{ fontFamily: "var(--font-head)", fontSize: 22, fontWeight: 700, letterSpacing: "0.1em", color: "var(--text)" }}>
              {headerText.title}
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-muted)", marginTop: 6, letterSpacing: "0.06em" }}>
              {headerText.sub}
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", borderBottom: "1px solid var(--border)", marginBottom: 24 }}>
            {TABS.map(tab => (
              <button key={tab.id} onClick={() => switchMode(tab.id)} style={{
                background: "none", border: "none",
                borderBottom: mode === tab.id ? "2px solid var(--pink)" : "2px solid transparent",
                cursor: "pointer", padding: "8px 14px",
                fontFamily: "var(--font-head)", fontSize: 10, letterSpacing: "0.1em",
                color: mode === tab.id ? "var(--pink)" : "var(--text-muted)",
                transition: "all 0.18s", textTransform: "uppercase", marginBottom: -1,
                whiteSpace: "nowrap",
              }}>
                {tab.label}
              </button>
            ))}
          </div>

          {/* Panel content */}
          {mode === "login"    && <LoginPanel    onAuth={onAuth} onSwitch={switchMode} />}
          {mode === "register" && <RegisterPanel onAuth={onAuth} onSwitch={switchMode} />}
          {mode === "reset"    && <ResetPanel    onSwitch={switchMode} />}
        </div>

        <div style={{
          marginTop: 16, textAlign: "center",
          fontFamily: "var(--font-mono)", fontSize: 9,
          color: "var(--text-muted)", letterSpacing: "0.1em",
        }}>
          🔒 SECURED WITH JWT · SESSION PERSISTS LOCALLY
        </div>
      </div>
    </div>
  );
}


// ── LOGIN PANEL ───────────────────────────────────────────────────────────────

function LoginPanel({ onAuth, onSwitch }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(null);

  async function handleSubmit() {
    if (!username.trim() || !password.trim()) { setError("Username and password are required."); return; }
    setLoading(true); setError(null);
    try {
      const res  = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Authentication failed.");
      localStorage.setItem("mazerl_token", data.access_token);
      localStorage.setItem("mazerl_user",  JSON.stringify(data.user));
      onAuth(data.access_token, data.user);
    } catch (e) { setError(e.message); }
    finally     { setLoading(false); }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Field label="USERNAME" type="text"     value={username} onChange={setUsername} onKeyDown={e => e.key === "Enter" && handleSubmit()} placeholder="agent_zero" autoFocus />
      <Field label="PASSWORD" type="password" value={password} onChange={setPassword} onKeyDown={e => e.key === "Enter" && handleSubmit()} placeholder="••••••••" />
      <ErrorBox error={error} />
      <SubmitButton loading={loading} onClick={handleSubmit} label="ENTER THE ARENA" />
      <FooterSwitch text="No account?" linkText="Register here" onClick={() => onSwitch("register")} />
      <div style={{ textAlign: "center" }}>
        <button onClick={() => onSwitch("reset")} style={{
          background: "none", border: "none", cursor: "pointer",
          fontFamily: "var(--font-mono)", fontSize: 10,
          color: "var(--text-muted)", letterSpacing: "0.06em",
          textDecoration: "underline",
        }}>Forgot password?</button>
      </div>
    </div>
  );
}


// ── REGISTER PANEL ────────────────────────────────────────────────────────────

function RegisterPanel({ onAuth, onSwitch }) {
  const [username,        setUsername]        = useState("");
  const [email,           setEmail]           = useState("");
  const [password,        setPassword]        = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading,         setLoading]         = useState(false);
  const [error,           setError]           = useState(null);
  const [welcomeNote,     setWelcomeNote]      = useState(null);

  async function handleSubmit() {
    if (!username.trim())      { setError("Username is required."); return; }
    if (!email.trim())         { setError("Email is required."); return; }
    if (!password.trim())      { setError("Password is required."); return; }
    if (password !== confirmPassword) { setError("Passwords do not match."); return; }

    setLoading(true); setError(null);
    try {
      const res  = await fetch(`${API}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim(),
          email: email.trim(),
          password,
          confirm_password: confirmPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Registration failed.");

      setWelcomeNote(`📧 A welcome email has been sent to ${email.trim()}`);
      localStorage.setItem("mazerl_token", data.access_token);
      localStorage.setItem("mazerl_user",  JSON.stringify(data.user));

      // Small delay so user sees the welcome note before navigating
      setTimeout(() => onAuth(data.access_token, data.user), 1800);
    } catch (e) { setError(e.message); }
    finally     { setLoading(false); }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Field label="USERNAME"        type="text"     value={username}        onChange={setUsername}        onKeyDown={e => e.key === "Enter" && handleSubmit()} placeholder="agent_zero" autoFocus />
      <Field label="EMAIL"           type="email"    value={email}           onChange={setEmail}           onKeyDown={e => e.key === "Enter" && handleSubmit()} placeholder="you@example.com" />
      <Field label="PASSWORD"        type="password" value={password}        onChange={setPassword}        onKeyDown={e => e.key === "Enter" && handleSubmit()} placeholder="Min 6 characters" />
      <Field label="CONFIRM PASSWORD" type="password" value={confirmPassword} onChange={setConfirmPassword} onKeyDown={e => e.key === "Enter" && handleSubmit()} placeholder="Repeat password" />
      <ErrorBox error={error} />
      {welcomeNote && (
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-muted)", letterSpacing: "0.06em", textAlign: "center", lineHeight: 1.6 }}>
          {welcomeNote}
        </div>
      )}
      <SubmitButton loading={loading} onClick={handleSubmit} label="CREATE ACCOUNT" />
      <FooterSwitch text="Already registered?" linkText="Sign in" onClick={() => onSwitch("login")} />
    </div>
  );
}


// ── RESET PASSWORD PANEL ──────────────────────────────────────────────────────

function ResetPanel({ onSwitch }) {
  const [step,        setStep]        = useState(1);   // 1 = email, 2 = code + new pw
  const [email,       setEmail]       = useState("");
  const [code,        setCode]        = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState(null);
  const [success,     setSuccess]     = useState(null);

  async function handleRequestCode() {
    if (!email.trim()) { setError("Email is required."); return; }
    setLoading(true); setError(null);
    try {
      const res  = await fetch(`${API}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Request failed.");
      setSuccess("✓ " + data.message);
      setTimeout(() => { setSuccess(null); setStep(2); }, 1500);
    } catch (e) { setError(e.message); }
    finally     { setLoading(false); }
  }

  async function handleResetPassword() {
    if (!code.trim())        { setError("Reset code is required."); return; }
    if (!newPassword.trim()) { setError("New password is required."); return; }
    if (newPassword.length < 6) { setError("Password must be at least 6 characters."); return; }
    setLoading(true); setError(null);
    try {
      const res  = await fetch(`${API}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: code.trim(), new_password: newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Reset failed.");
      setSuccess("✓ Password updated! You can now sign in.");
      setTimeout(() => onSwitch("login"), 2000);
    } catch (e) { setError(e.message); }
    finally     { setLoading(false); }
  }

  if (step === 1) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)", lineHeight: 1.7 }}>
          Enter the email address on your account. We'll send a reset code.
        </div>
        <Field label="EMAIL" type="email" value={email} onChange={setEmail}
          onKeyDown={e => e.key === "Enter" && handleRequestCode()} placeholder="you@example.com" autoFocus />
        <ErrorBox error={error} />
        {success && <SuccessBox message={success} />}
        <SubmitButton loading={loading} onClick={handleRequestCode} label="SEND RESET CODE" />
        <FooterSwitch text="Remembered it?" linkText="Sign in" onClick={() => onSwitch("login")} />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{
        padding: "10px 14px", background: "rgba(15,255,160,0.05)",
        border: "1px solid var(--mint-dim)", borderRadius: "var(--radius)",
        fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)", lineHeight: 1.7,
      }}>
        ✓ Code sent to <span style={{ color: "var(--mint)" }}>{email}</span><br />
        Check your inbox and paste the code below.
      </div>
      <Field label="RESET CODE"    type="text"     value={code}        onChange={setCode}        onKeyDown={e => e.key === "Enter" && handleResetPassword()} placeholder="Paste code from email" />
      <Field label="NEW PASSWORD"  type="password" value={newPassword} onChange={setNewPassword} onKeyDown={e => e.key === "Enter" && handleResetPassword()} placeholder="Min 6 characters" />
      <ErrorBox error={error} />
      {success && <SuccessBox message={success} />}
      <SubmitButton loading={loading} onClick={handleResetPassword} label="UPDATE PASSWORD" />
      <div style={{ textAlign: "center" }}>
        <button onClick={() => setStep(1)} style={{
          background: "none", border: "none", cursor: "pointer",
          fontFamily: "var(--font-mono)", fontSize: 10,
          color: "var(--text-muted)", letterSpacing: "0.06em", textDecoration: "underline",
        }}>← Re-enter email</button>
      </div>
    </div>
  );
}


// ── Shared sub-components ─────────────────────────────────────────────────────

function Field({ label, type, value, onChange, onKeyDown, placeholder, autoFocus }) {
  const [focused,  setFocused]  = useState(false);
  const [visible,  setVisible]  = useState(false);   // for password fields
  const isPassword = type === "password";
  const inputType  = isPassword ? (visible ? "text" : "password") : type;

  return (
    <div>
      <label style={{
        display: "block", fontFamily: "var(--font-head)", fontSize: 9,
        letterSpacing: "0.18em", color: focused ? "var(--pink)" : "var(--text-muted)",
        marginBottom: 6, transition: "color 0.15s",
      }}>{label}</label>
      <div style={{ position: "relative" }}>
        <input
          type={inputType} value={value} autoFocus={autoFocus} placeholder={placeholder}
          onChange={e => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            width: "100%",
            background: focused ? "rgba(255,61,127,0.04)" : "var(--bg3)",
            border: `1px solid ${focused ? "var(--pink)" : "var(--border2)"}`,
            borderRadius: "var(--radius)",
            padding: isPassword ? "10px 40px 10px 14px" : "10px 14px",
            fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--text)",
            outline: "none", transition: "all 0.18s", letterSpacing: "0.04em",
            boxShadow: focused ? "0 0 10px rgba(255,61,127,0.1)" : "none",
          }}
        />
        {isPassword && (
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setVisible(v => !v)}
            style={{
              position: "absolute", right: 10, top: "50%",
              transform: "translateY(-50%)",
              background: "none", border: "none", cursor: "pointer",
              padding: 4, display: "flex", alignItems: "center",
              color: focused ? "var(--pink)" : "var(--text-muted)",
              transition: "color 0.15s",
            }}
            title={visible ? "Hide password" : "Show password"}
          >
            {visible ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Eye icons (inline SVG, no library needed) ─────────────────────────────────

function EyeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  );
}

function ErrorBox({ error }) {
  if (!error) return null;
  return (
    <div style={{
      padding: "10px 14px", background: "rgba(255,61,127,0.07)",
      border: "1px solid var(--pink-dim)", borderRadius: "var(--radius)",
      fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--pink)", letterSpacing: "0.04em",
    }}>⚠ {error}</div>
  );
}

function SuccessBox({ message }) {
  return (
    <div style={{
      padding: "10px 14px", background: "rgba(15,255,160,0.07)",
      border: "1px solid var(--mint-dim)", borderRadius: "var(--radius)",
      fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--mint)", letterSpacing: "0.04em",
    }}>{message}</div>
  );
}

function SubmitButton({ loading, onClick, label }) {
  return (
    <button onClick={onClick} disabled={loading} style={{
      width: "100%", marginTop: 6, padding: "13px 0",
      background: "transparent", border: "1px solid var(--pink)",
      borderRadius: "var(--radius)", cursor: loading ? "not-allowed" : "pointer",
      fontFamily: "var(--font-head)", fontSize: 12, letterSpacing: "0.14em",
      color: "var(--pink)", opacity: loading ? 0.5 : 1,
      transition: "all 0.18s", textTransform: "uppercase",
      boxShadow: loading ? "none" : "0 0 12px rgba(255,61,127,0.2)",
    }}
    onMouseEnter={e => { if (!loading) { e.currentTarget.style.background = "var(--pink)"; e.currentTarget.style.color = "#fff"; e.currentTarget.style.boxShadow = "0 0 24px rgba(255,61,127,0.4)"; } }}
    onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--pink)"; e.currentTarget.style.boxShadow = "0 0 12px rgba(255,61,127,0.2)"; }}
    >
      {loading ? "PLEASE WAIT…" : label}
    </button>
  );
}

function FooterSwitch({ text, linkText, onClick }) {
  return (
    <div style={{ textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-muted)", letterSpacing: "0.08em" }}>
      {text}{" "}
      <button onClick={onClick} style={{
        background: "none", border: "none", cursor: "pointer",
        color: "var(--pink)", fontFamily: "var(--font-mono)", fontSize: 10,
        letterSpacing: "0.08em", textDecoration: "underline",
      }}>{linkText}</button>
    </div>
  );
}

function GridBg() {
  return (
    <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.15, pointerEvents: "none" }} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="grid2" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1a2744" strokeWidth="0.8" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#grid2)" />
    </svg>
  );
}
