/**
 * PrivacyPolicyPage.jsx
 *
 * Full-page privacy policy. Linked from the LandingPage footer.
 * Props: onBack() — navigate back to landing.
 */

import { useState, useEffect } from "react";

export default function PrivacyPolicyPage({ onBack }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 60);
    return () => clearTimeout(t);
  }, []);

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--bg)",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Grid bg */}
      <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.12, pointerEvents: "none" }} xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="ppgrid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1a2744" strokeWidth="0.8" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#ppgrid)" />
      </svg>

      <div style={{
        position: "relative", zIndex: 1,
        maxWidth: 760, margin: "0 auto", padding: "40px 24px 80px",
        opacity: mounted ? 1 : 0,
        transform: mounted ? "translateY(0)" : "translateY(16px)",
        transition: "opacity 0.5s ease, transform 0.5s ease",
      }}>
        <button onClick={onBack} className="btn btn-ghost"
          style={{ fontSize: 11, marginBottom: 36, letterSpacing: "0.1em" }}>
          ← BACK TO HOME
        </button>

        {/* Header */}
        <div style={{ marginBottom: 48 }}>
          <div style={{
            fontFamily: "var(--font-head)",
            fontSize: "clamp(22px, 4vw, 36px)",
            fontWeight: 900,
            letterSpacing: "0.14em",
            color: "var(--mint)",
            marginBottom: 8,
          }}>
            PRIVACY POLICY
          </div>
          <div style={{
            fontFamily: "var(--font-mono)", fontSize: 11,
            color: "var(--text-muted)", letterSpacing: "0.1em",
          }}>
            MAZE·RL · Last updated: May 2026
          </div>
          <div style={{
            marginTop: 20, height: 1,
            background: "linear-gradient(90deg, var(--mint), transparent)",
          }} />
        </div>

        {/* Sections */}
        <PPSection title="1. OVERVIEW">
          MAZE·RL ("we", "our", "the game") is a reinforcement-learning maze game
          built for educational and entertainment purposes. This Privacy Policy
          explains what information we collect, how we use it, and your rights
          regarding that data. By creating an account or using ranked mode, you
          agree to this policy.
        </PPSection>

        <PPSection title="2. INFORMATION WE COLLECT">
          <b style={{ color: "var(--text)" }}>Account information</b> — When you
          register, we collect your username, email address, and a bcrypt-hashed
          version of your password. We never store your password in plain text.
          <br /><br />
          <b style={{ color: "var(--text)" }}>Game scores</b> — When you complete
          a ranked maze, we store your best result per difficulty tier: whether
          you solved it, how many steps you took, and how long it took in seconds.
          <br /><br />
          <b style={{ color: "var(--text)" }}>Free Play</b> — No account is required
          and no personal data is collected when using Free Play mode.
        </PPSection>

        <PPSection title="3. HOW WE USE YOUR INFORMATION">
          <ul style={{ paddingLeft: 20, lineHeight: 2 }}>
            <li>To authenticate your account and maintain your session via JWT tokens.</li>
            <li>To record and display your personal best scores per difficulty tier.</li>
            <li>To populate the public leaderboard (shows your username and best time).</li>
            <li>To send a one-time welcome email when you register.</li>
            <li>To send a password reset code if you request one.</li>
          </ul>
          We do not use your data for advertising, analytics platforms, or any
          third-party marketing.
        </PPSection>

        <PPSection title="4. EMAIL COMMUNICATION">
          We send emails only in two situations:
          <br /><br />
          <b style={{ color: "var(--text)" }}>Welcome email</b> — A single email
          sent to your address when you first register. It contains no tracking
          pixels or links.
          <br /><br />
          <b style={{ color: "var(--text)" }}>Password reset</b> — A one-time reset
          code sent on your explicit request. Codes expire after 30 minutes and
          can only be used once. We will never send unsolicited emails.
          <br /><br />
          Emails are sent from <span style={{ color: "var(--mint)" }}>mail.mazex@gmail.com</span>.
        </PPSection>

        <PPSection title="5. DATA STORAGE & SECURITY">
          All account and score data is stored in a PostgreSQL database. Passwords
          are hashed using bcrypt before storage — we cannot recover your password.
          Sessions are managed with signed JWT tokens (HS256) that expire after
          72 hours. Reset codes are held in server memory and expire after 30 minutes.
          <br /><br />
          We take reasonable technical precautions, but no system is perfectly
          secure. Use a unique password for your MAZE·RL account.
        </PPSection>

        <PPSection title="6. DATA SHARING">
          We do not sell, rent, or share your personal information with any third
          parties. The only public-facing data is your username and best score,
          which appear on the leaderboard.
        </PPSection>

        <PPSection title="7. DATA RETENTION & DELETION">
          Your account and scores are retained as long as your account exists.
          To request deletion of your account and all associated data, contact us
          at <span style={{ color: "var(--mint)" }}>mail.mazex@gmail.com</span> with
          the subject "Account Deletion Request". We will process requests within
          14 days.
        </PPSection>

        <PPSection title="8. COOKIES & LOCAL STORAGE">
          MAZE·RL does not use cookies. We store your JWT token and user object in
          your browser's <code style={{ color: "var(--cyan)", fontSize: 11 }}>localStorage</code>.
          This data stays on your device and is cleared when you sign out. You can
          also clear it manually by clearing your browser's site data.
        </PPSection>

        <PPSection title="9. CHILDREN'S PRIVACY">
          MAZE·RL is not directed at children under 13. We do not knowingly collect
          personal information from anyone under 13. If you believe a child has
          created an account, please contact us for immediate removal.
        </PPSection>

        <PPSection title="10. CHANGES TO THIS POLICY">
          We may update this policy as the game evolves. Changes will be noted by
          updating the "Last updated" date above. Continued use of ranked mode
          after a policy change constitutes acceptance of the updated terms.
        </PPSection>

        <PPSection title="11. CONTACT">
          For any privacy-related questions or data requests, contact:<br /><br />
          <span style={{ color: "var(--mint)" }}>mail.mazex@gmail.com</span>
        </PPSection>

        {/* Footer bar */}
        <div style={{
          marginTop: 56, paddingTop: 24,
          borderTop: "1px solid var(--border)",
          fontFamily: "var(--font-mono)", fontSize: 10,
          color: "var(--text-muted)", letterSpacing: "0.08em",
          textAlign: "center",
        }}>
          MAZE·RL · PRIVACY POLICY · MAY 2026
        </div>
      </div>
    </div>
  );
}

function PPSection({ title, children }) {
  return (
    <div style={{ marginBottom: 36 }}>
      <div style={{
        fontFamily: "var(--font-head)", fontSize: 11,
        letterSpacing: "0.16em", color: "var(--mint)",
        marginBottom: 14,
      }}>
        {title}
      </div>
      <div style={{
        fontFamily: "var(--font-mono)", fontSize: 12,
        color: "var(--text-dim)", lineHeight: 1.9,
        letterSpacing: "0.03em",
      }}>
        {children}
      </div>
    </div>
  );
}
