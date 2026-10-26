import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getComplaints } from "../api/complaints";
import { getSprints } from "../api/sprints";
import { useAccess } from "../auth/access";
import { STATUSES, useConfig } from "../constants";
import "./Dashboard.scss";

/* ---------- helpers ---------- */

const currentUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user") || "{}");
  } catch {
    return {};
  }
};

const FALLBACK_CLOSED = ["resolved", "closed"];
const isClosedValue = (value) => {
  const s = STATUSES.find((x) => x.value === value);
  if (s && (s.is_closed !== undefined || s.isClosed !== undefined)) {
    return Boolean(s.is_closed ?? s.isClosed);
  }
  return FALLBACK_CLOSED.includes(value);
};

const greeting = () => {
  const hour = new Date().getHours();
  return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
};

const svgProps = {
  viewBox: "0 0 24 24",
  width: 16,
  height: 16,
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
};

const RefreshIcon = () => (
  <svg {...svgProps}>
    <path d="M20 11a8 8 0 0 0-14.5-4M4 13a8 8 0 0 0 14.5 4" />
    <polyline points="5 3 5.5 7.5 10 7" />
    <polyline points="19 21 18.5 16.5 14 17" />
  </svg>
);

const PlusIcon = () => (
  <svg {...svgProps} strokeWidth={2}>
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

/* ---------- building blocks ---------- */

function Header({ title, onRefresh, loading }) {
  const user = useMemo(currentUser, []);
  const firstName = (user.full_name || user.email || "there").split(" ")[0];
  return (
    <div className="db-top">
      <div>
        <h1>
          {greeting()}, {firstName}
        </h1>
        <p>{title}</p>
      </div>
      <div className="db-tools">
        <button type="button" className="db-btn" onClick={onRefresh} disabled={loading}>
          <RefreshIcon />
          <span>{loading ? "Loading…" : "Refresh"}</span>
        </button>
        <Link to="/new" className="db-btn db-btn-primary">
          <PlusIcon />
          <span>New task</span>
        </Link>
      </div>
    </div>
  );
}

function Kpi({ label, value, tone = "green" }) {
  return (
    <div className={`db-kpi tone-${tone}`}>
      <span className="db-kpi-label">{label}</span>
      <strong className="db-kpi-value">{value}</strong>
    </div>
  );
}

/* ---------- developers: active sprint numbers ---------- */

function DevDashboard() {
  useConfig();

  const [sprints, setSprints] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [s, c] = await Promise.all([getSprints(), getComplaints()]);
      setSprints(s);
      setItems(c);
    } catch {
      setError("Could not load the dashboard. Is the backend running?");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const stats = useMemo(() => {
    const active = sprints.filter((sp) => sp.status === "active");
    const ids = new Set(active.map((sp) => sp.id));
    const tasks = items.filter(
      (c) => (c.kind === "task" || c.kind === "bug") && ids.has(c.sprint)
    );
    return {
      activeSprints: active.length,
      total: tasks.length,
      closed: tasks.filter((c) => isClosedValue(c.status)).length,
    };
  }, [sprints, items]);

  return (
    <div className="db">
      <Header title="Active sprint overview" onRefresh={load} loading={loading} />

      {error && <div className="db-alert">{error}</div>}

      <div className="db-kpis">
        <Kpi label="Active sprints" value={stats.activeSprints} tone="blue" />
        <Kpi label="Total tasks" value={stats.total} tone="purple" />
        <Kpi label="Closed tasks" value={stats.closed} tone="green" />
      </div>
    </div>
  );
}

/* ---------- everyone else: simple totals ---------- */

function GeneralDashboard() {
  useConfig();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setItems(await getComplaints());
    } catch {
      setError("Could not load the dashboard. Is the backend running?");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const closed = items.filter((c) => isClosedValue(c.status)).length;

  return (
    <div className="db">
      <Header title="Your workspace" onRefresh={load} loading={loading} />

      {error && <div className="db-alert">{error}</div>}

      <div className="db-kpis">
        <Kpi label="Total tasks" value={items.length} tone="blue" />
        <Kpi label="Open" value={items.length - closed} tone="yellow" />
        <Kpi label="Closed" value={closed} tone="green" />
      </div>
    </div>
  );
}

/* ---------- entry ---------- */

export default function Dashboard() {
  const { access } = useAccess();
  return access === "developer" ? <DevDashboard /> : <GeneralDashboard />;
}