import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import "./Login.scss";

// Decorative tower-from-below pattern for the left panel
function Tower() {
  const vx = 250;
  const vy = -260;
  const leftBase = [-260, -170, -80, 10, 100, 190];
  const rightBase = [290, 380, 470, 560, 650];
  const floors = [80, 150, 215, 275, 330, 380, 425, 465, 500, 530, 556];

  return (
    <svg
      className="lg-tower"
      viewBox="0 0 400 600"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <polygon points="250,-260 -300,600 232,600" className="lg-tower-face-a" />
      <polygon points="250,-260 232,600 720,600" className="lg-tower-face-b" />
      {leftBase.map((x) => (
        <line key={`l${x}`} x1={vx} y1={vy} x2={x} y2="600" />
      ))}
      {rightBase.map((x) => (
        <line key={`r${x}`} x1={vx} y1={vy} x2={x} y2="600" />
      ))}
      {floors.map((y, i) => (
        <g key={y}>
          <line x1={250 - (y + 260) * 0.62} y1={y + i * 0.4} x2="240" y2={y} />
          <line x1="240" y1={y} x2={250 + (y + 260) * 0.62} y2={y + 14 + i * 0.6} />
        </g>
      ))}
      <line x1="250" y1="-260" x2="232" y2="600" className="lg-tower-edge" />
    </svg>
  );
}

const eyeProps = {
  viewBox: "0 0 24 24",
  width: 20,
  height: 20,
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
};

// Eye = password is hidden (click to show). Eye with a slash = password is visible (click to hide).
const EyeIcon = () => (
  <svg {...eyeProps}>
    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const EyeOffIcon = () => (
  <svg {...eyeProps}>
    <path d="M9.9 5.2A9.7 9.7 0 0 1 12 5c6.4 0 10 7 10 7a17.6 17.6 0 0 1-3.3 4.2" />
    <path d="M6.6 6.6A17.4 17.4 0 0 0 2 12s3.6 7 10 7a9.6 9.6 0 0 0 4.4-1.1" />
    <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    <line x1="3" y1="3" x2="21" y2="21" />
  </svg>
);

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const submit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await login(email.trim(), password);
      navigate("/", { replace: true });
    } catch (err) {
      setError(
        err.response?.data?.detail || "Could not sign in. Check that the backend is running."
      );
      setBusy(false);
    }
  };

  return (
    <div className="lg">
      <div className="lg-shell">
        <aside className="lg-visual">
          <Tower />
          <span className="lg-brand">Complaint Followup</span>
          <p className="lg-visual-text">
            Track every complaint from first report to final resolution.
          </p>
        </aside>

        <form className="lg-card" onSubmit={submit} noValidate>
          <div className="lg-top">
            <span className="lg-mark">C</span>
          </div>

          <div className="lg-body">
            <h1>Sign in</h1>
            <p>Enter your email and password to continue.</p>

            {error && <div className="lg-alert">{error}</div>}

            <div className="lg-field">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                autoFocus
              />
            </div>

            <div className="lg-field">
              <label htmlFor="password">Password</label>
              <div className="lg-pass">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Your password"
                />
                <button
                  type="button"
                  className="lg-eye"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  title={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
            </div>

            <button type="submit" className="lg-btn" disabled={busy}>
              {busy ? "Signing in..." : "Sign in"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}