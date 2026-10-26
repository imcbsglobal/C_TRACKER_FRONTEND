import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { getSprints } from "../api/sprints";
import { getComplaints, selfAssignComplaint } from "../api/complaints";
import { useProjects } from "../projects";
import { isAdminUser, STATUSES } from "../constants";
import "./Mysprints.scss";

// ---------- helpers ----------
const toDate = (d) => {
  if (!d) return null;
  const s = String(d);
  const dt = new Date(s.length === 10 ? `${s}T00:00:00` : s);
  return Number.isNaN(dt.getTime()) ? null : dt;
};

const fmtShort = (d) => {
  const dt = toDate(d);
  if (!dt) return "—";
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

const fmtYear = (d) => {
  const dt = toDate(d);
  return dt ? dt.getFullYear() : "";
};

const ORDER = { active: 0, planned: 1, completed: 2 };
const LABEL = { active: "Active", planned: "Planned", completed: "Completed" };

const SORTS = [
  ["newest", "Newest First"],
  ["oldest", "Oldest First"],
  ["ending", "Ending Soon"],
  ["progress", "Most Progress"],
];

const pctOf = (s) => {
  const total = s.total_count || 0;
  return total ? Math.round(((s.done_count || 0) / total) * 100) : 0;
};

const sorters = {
  newest: (a, b) => String(b.start_date || "").localeCompare(String(a.start_date || "")),
  oldest: (a, b) => String(a.start_date || "9999").localeCompare(String(b.start_date || "9999")),
  ending: (a, b) => String(a.end_date || "9999").localeCompare(String(b.end_date || "9999")),
  progress: (a, b) => pctOf(b) - pctOf(a),
};

// one stable colour per project name
const PALETTE = [
  ["#dff3e4", "#17673a"],
  ["#dbeafe", "#1d4ed8"],
  ["#ede4ff", "#5b2fb8"],
  ["#ffe4ee", "#b3205a"],
  ["#ffecd2", "#a8560a"],
  ["#d5f3f1", "#0f6f6a"],
  ["#fff5c2", "#7a5d00"],
];
const hash = (str = "") => {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
};
const colorFor = (name) => PALETTE[hash(name) % PALETTE.length];

const initials = (name = "") =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join("") || "?";

// ---------- icons ----------
const ICONS = {
  layers: (
    <>
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 15.5 14" />
    </>
  ),
  check: (
    <>
      <circle cx="12" cy="12" r="9" />
      <polyline points="8 12.5 11 15.5 16 9.5" />
    </>
  ),
  play: (
    <>
      <circle cx="12" cy="12" r="9" />
      <polygon points="10 8.5 16 12 10 15.5" fill="currentColor" />
    </>
  ),
  list: (
    <>
      <line x1="9" y1="6" x2="20" y2="6" />
      <line x1="9" y1="12" x2="20" y2="12" />
      <line x1="9" y1="18" x2="20" y2="18" />
      <circle cx="4.5" cy="6" r="1" fill="currentColor" />
      <circle cx="4.5" cy="12" r="1" fill="currentColor" />
      <circle cx="4.5" cy="18" r="1" fill="currentColor" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </>
  ),
  sort: (
    <>
      <polyline points="7 4 7 20" />
      <polyline points="3 16 7 20 11 16" />
      <polyline points="17 20 17 4" />
      <polyline points="13 8 17 4 21 8" />
    </>
  ),
  cal: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="3" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <line x1="8" y1="3" x2="8" y2="7" />
      <line x1="16" y1="3" x2="16" y2="7" />
    </>
  ),
  arrow: (
    <>
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="13 6 19 12 13 18" />
    </>
  ),
};

const Icon = ({ name, size = 16 }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {ICONS[name]}
  </svg>
);

// ---------- pieces ----------
function MiniRing({ pct }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  return (
    <span className={`ms-ring ${pct === 100 ? "is-full" : ""}`} role="img" aria-label={`${pct}% completed`}>
      <svg viewBox="0 0 64 64" width="64" height="64">
        <circle className="ms-ring-bg" cx="32" cy="32" r={r} fill="none" strokeWidth="6" />
        <circle
          className="ms-ring-fg"
          cx="32"
          cy="32"
          r={r}
          fill="none"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (c * pct) / 100}
        />
      </svg>
      <b>{pct}%</b>
    </span>
  );
}

function Avatars({ list }) {
  if (!list || list.length === 0) return null;
  const shown = list.slice(0, 3);
  const extra = list.length - shown.length;
  return (
    <span className="ms-avs">
      {shown.map((u) => {
        const [bg, fg] = colorFor(u.name || String(u.id));
        return u.avatar ? (
          <img key={u.id} className="ms-avatar" src={u.avatar} alt={u.name} title={u.name} />
        ) : (
          <span key={u.id} className="ms-avatar" style={{ background: bg, color: fg }} title={u.name}>
            {initials(u.name)}
          </span>
        );
      })}
      {extra > 0 && <span className="ms-avatar is-more">+{extra}</span>}
    </span>
  );
}

function SprintRow({ s, project }) {
  const total = s.total_count || 0;
  const done = s.done_count || 0;
  const pct = pctOf(s);
  const hasBreakdown = s.in_progress_count !== undefined && s.in_progress_count !== null;
  const inProgress = hasBreakdown ? s.in_progress_count : 0;
  const notStarted = hasBreakdown
    ? s.not_started_count ?? Math.max(total - done - inProgress, 0)
    : Math.max(total - done, 0);

  const hasDays = s.days_left !== null && s.days_left !== undefined;
  const overdue = s.closing_state === "overdue" || (hasDays && s.days_left < 0);
  const soon = s.closing_state === "closing_soon" || (hasDays && s.days_left >= 0 && s.days_left <= 2);

  let left = null;
  if (s.status === "active" && hasDays) {
    left =
      s.days_left < 0
        ? `${Math.abs(s.days_left)}d past end`
        : s.days_left === 0
          ? "Ends today"
          : `${s.days_left}d left`;
  }

  const edge = s.status === "active" ? (overdue ? "is-overdue" : soon ? "is-soon" : "") : "";
  const hasGoal = s.goal && s.goal.trim() && s.goal.trim().toLowerCase() !== "goal";

  return (
    <Link
      to={`/my-sprints/${s.id}${project ? `?project=${project}` : ""}`}
      className={`ms-card is-${s.status} ${edge}`}
      title={hasGoal ? `Goal: ${s.goal}` : undefined}
    >
      <div className="ms-main">
        <div className="ms-line1">
          <h3 className="ms-card-title">{s.name}</h3>
          <span className={`ms-tag is-${s.status}`}>
            <i className="ms-dot" />
            {LABEL[s.status] || s.status}
          </span>
          {left && (
            <span className={`ms-left ${overdue || soon ? "is-late" : ""}`}>
              <Icon name="clock" size={13} />
              {left}
            </span>
          )}
        </div>

        <div className="ms-line2">
          <span className="ms-meta">
            <Icon name="cal" size={15} />
            {fmtShort(s.start_date)} – {fmtShort(s.end_date)}, {fmtYear(s.end_date)}
          </span>
          {(s.project_names || []).map((n) => {
            const [bg, fg] = colorFor(n);
            return (
              <span key={n} className="ms-chip" style={{ background: bg, color: fg }}>
                {n}
              </span>
            );
          })}
          <Avatars list={s.assignees} />
        </div>
      </div>

      <div className="ms-prog">
        <MiniRing pct={pct} />
        <span className="ms-prog-tx">
          <b>{done}/{total} tasks</b>
          <small>
            {done} done
            {hasBreakdown && ` · ${inProgress} in progress`}
            {` · ${notStarted} ${hasBreakdown ? "not started" : "left"}`}
          </small>
        </span>
      </div>

      <span className="ms-view">
        View Sprint <Icon name="arrow" size={16} />
      </span>
    </Link>
  );
}

// Tasks and bugs the support team handed up to this development project, newest first,
// with the name of the person who escalated each one and who is working on it.
// Open ones show by default; a "Completed" button switches to the finished ones.
function EscalatedTasks({ list, admin, onUpdated }) {
  const [busyId, setBusyId] = useState(null);
  const [err, setErr] = useState("");
  const [view, setView] = useState(null); // null = not chosen yet, "open" or "done"
  if (!list || list.length === 0) return null;

  const pick = async (c) => {
    setBusyId(c.id);
    setErr("");
    try {
      onUpdated(await selfAssignComplaint(c.id));
    } catch (e) {
      setErr(e?.response?.data?.detail || "Could not assign this task.");
    }
    setBusyId(null);
  };

  const byNewest = (a, b) =>
    String(b.escalated_from?.at || "").localeCompare(String(a.escalated_from?.at || ""));
  const openList = list.filter((c) => !c.is_closed).sort(byNewest);
  const doneList = list.filter((c) => !!c.is_closed).sort(byNewest);

  // if nothing is open, fall back to the completed ones (unless the user already chose)
  const current = view || (openList.length > 0 ? "open" : "done");
  const sorted = current === "done" ? doneList : openList;

  const pill = (bg, fg) => ({
    padding: "2px 10px",
    borderRadius: 999,
    background: bg,
    color: fg,
    fontSize: 12,
    fontWeight: 600,
    whiteSpace: "nowrap",
  });
  const tab = (on, bg, fg) => ({
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    border: `1.5px solid ${on ? fg : "#e3e9de"}`,
    borderRadius: 999,
    padding: "6px 14px",
    background: on ? bg : "#fff",
    color: on ? fg : "#5d685a",
    font: "inherit",
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
  });
  const count = (n) => <span style={{ opacity: 0.75, fontWeight: 600 }}>{n}</span>;

  return (
    <section
      style={{ border: "1px solid #e3e9de", borderRadius: 14, background: "#fff", padding: 16, marginBottom: 16 }}
      aria-label="Escalated from support"
    >
      <h2 style={{ margin: "0 0 4px", fontSize: 16 }}>
        Escalated from support <span style={{ opacity: 0.6, fontWeight: 500 }}>({list.length})</span>
      </h2>
      <p style={{ margin: "0 0 12px", fontSize: 13, opacity: 0.7 }}>
        Tasks and bugs the support team handed to this project's developers. Take one with
        Self assign so everyone knows who is on it.
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
        <button
          type="button"
          style={tab(current === "open", "#fde3e0", "#d23a30")}
          onClick={() => setView("open")}
          aria-pressed={current === "open"}
        >
          Open {count(openList.length)}
        </button>
        <button
          type="button"
          style={tab(current === "done", "#d8f3de", "#17673a")}
          onClick={() => setView("done")}
          aria-pressed={current === "done"}
        >
          Completed escalations {count(doneList.length)}
        </button>
      </div>

      {err && (
        <div className="ms-alert" style={{ marginBottom: 10 }}>
          {err}
        </div>
      )}

      {sorted.length === 0 && (
        <p style={{ margin: 0, fontSize: 13, opacity: 0.7 }}>
          {current === "done" ? "No completed escalations yet." : "No open escalations."}
        </p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {sorted.map((c) => {
          const e = c.escalated_from || {};
          const status = STATUSES.find((s) => s.value === c.status)?.label || c.status;
          return (
            <div
              key={c.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                flexWrap: "wrap",
                padding: "10px 12px",
                border: "1px solid #e3e9de",
                borderLeft: `4px solid ${c.is_closed ? "#2f9e55" : "#d23a30"}`,
                borderRadius: 10,
                opacity: c.is_closed ? 0.75 : 1,
              }}
            >
              <Link
                to={`/complaints/${c.id}`}
                style={{ flex: "1 1 240px", minWidth: 0, color: "inherit", textDecoration: "none" }}
              >
                <b style={{ display: "block" }}>{c.title}</b>
                <small style={{ opacity: 0.75 }}>
                  Escalated by <b>{e.by || "Support"}</b>
                  {e.case_number ? ` from case ${e.case_number}` : ""}
                  {e.at ? ` · ${fmtShort(e.at)}` : ""}
                </small>
                {e.note && <small style={{ display: "block", opacity: 0.75 }}>Note: {e.note}</small>}
              </Link>
              <span style={pill("#fde3e0", "#d23a30")}>{c.kind === "bug" ? "Bug" : "Task"}</span>
              <span style={pill("#e4ede0", "#3f6839")}>{status}</span>
              {c.assigned_to_name ? (
                <span style={pill("#dfeafb", "#2461c4")} title="Working on it">
                  {c.is_mine ? "You" : c.assigned_to_name}
                </span>
              ) : admin || c.is_closed ? (
                <span style={pill("#ecefe9", "#566052")}>Unassigned</span>
              ) : (
                <button
                  type="button"
                  className="pj-btn pj-btn-primary"
                  style={{
                    border: 0,
                    borderRadius: 10,
                    padding: "7px 14px",
                    background: "#4f7a46",
                    color: "#fff",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                  disabled={busyId === c.id}
                  onClick={() => pick(c)}
                >
                  {busyId === c.id ? "Assigning..." : "Self assign"}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ---------- page ----------
export default function MySprints() {
  const [params] = useSearchParams();
  const project = params.get("project") || ""; // set when a project is clicked in the sidebar
  const { projects } = useProjects();
  const projectName = projects.find((p) => String(p.id) === String(project))?.name;
  const admin = isAdminUser(); // the admin sees every sprint and opens it to see the team's tasks
  const [sprints, setSprints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("active"); // default: show only active sprints
  const [touched, setTouched] = useState(false); // true once the user picks a filter themselves
  const [sort, setSort] = useState("newest");
  const [q, setQ] = useState("");
  const [escalated, setEscalated] = useState([]); // tasks support escalated to this project

  // With a project picked, also load the tasks support escalated to it. They have no
  // sprint yet, so they would otherwise never show on this page.
  useEffect(() => {
    if (!project) {
      setEscalated([]);
      return;
    }
    getComplaints({ project })
      .then((list) => setEscalated(list.filter((c) => c.escalated_from)))
      .catch(() => setEscalated([]));
  }, [project]);

  useEffect(() => {
    getSprints()
      .then(setSprints)
      .catch(() => setError("Could not load your sprints."))
      .finally(() => setLoading(false));
  }, []);

  // With a project picked, keep only the sprints that include that project.
  const scoped = useMemo(
    () =>
      project
        ? sprints.filter((s) => (s.projects || []).some((id) => String(id) === String(project)))
        : sprints,
    [sprints, project]
  );

  // If there are no active sprints, fall back to showing all (unless the user already chose a filter).
  useEffect(() => {
    if (!loading && !touched && scoped.length > 0 && !scoped.some((x) => x.status === "active")) {
      setStatus("all");
    }
  }, [loading, scoped, touched]);

  const counts = {
    all: scoped.length,
    active: scoped.filter((x) => x.status === "active").length,
    planned: scoped.filter((x) => x.status === "planned").length,
    completed: scoped.filter((x) => x.status === "completed").length,
  };

  const visible = useMemo(() => {
    const term = q.trim().toLowerCase();
    return scoped
      .filter((s) => status === "all" || s.status === status)
      .filter(
        (s) =>
          !term ||
          (s.name || "").toLowerCase().includes(term) ||
          (s.goal || "").toLowerCase().includes(term) ||
          (s.project_names || []).some((n) => n.toLowerCase().includes(term))
      )
      .sort(
        (a, b) => (status === "all" ? (ORDER[a.status] ?? 9) - (ORDER[b.status] ?? 9) : 0) || sorters[sort](a, b)
      );
  }, [scoped, status, q, sort]);

  const STATS = [
    ["active", "Active", counts.active, "play"],
    ["planned", "Planned", counts.planned, "clock"],
    ["completed", "Completed", counts.completed, "check"],
    ["all", "Total Sprints", counts.all, "list"],
  ];

  return (
    <div className="ms">
      <header className="ms-head">
        <span className="ms-head-icon">
          <Icon name="layers" size={24} />
        </span>
        <div>
          <h1>{projectName ? `${projectName} sprints` : admin ? "Sprints" : "My sprints"}</h1>
          <p>
            {admin
              ? projectName
                ? `Every ${projectName} sprint. Open one to see the tasks the team added, as a board or a table.`
                : "Every sprint. Open one to see the tasks the team added, as a board or a table."
              : projectName
                ? `The ${projectName} sprints the admin gave you. Open one to add tasks and update their status.`
                : "The sprints the admin gave you. Open one to add tasks and update their status."}
          </p>
        </div>
      </header>

      {error && <div className="ms-alert">{error}</div>}

      <EscalatedTasks
        list={escalated}
        admin={admin}
        onUpdated={(u) => setEscalated((prev) => prev.map((x) => (x.id === u.id ? u : x)))}
      />

      {!loading && !error && scoped.length > 0 && (
        <>
          <div className="ms-stats">
            {STATS.map(([key, label, n, icon]) => (
              <button
                key={label}
                type="button"
                className={`ms-stat is-${key} ${status === key ? "is-on" : ""}`}
                onClick={() => {
                  setStatus(key);
                  setTouched(true);
                }}
              >
                <span className="ms-stat-ic">
                  <Icon name={icon} size={21} />
                </span>
                <span className="ms-stat-tx">
                  <span>{label}</span>
                  <b>{n}</b>
                </span>
              </button>
            ))}
          </div>

          <div className="ms-toolbar">
            <label className="ms-search">
              <Icon name="search" size={18} />
              <input
                type="search"
                placeholder="Search sprints..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </label>

            <label className="ms-select">
              <select
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setTouched(true);
                }}
                aria-label="Filter by status"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="planned">Planned</option>
                <option value="completed">Completed</option>
              </select>
            </label>

            <label className="ms-select has-icon">
              <Icon name="sort" size={17} />
              <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort sprints">
                {SORTS.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </>
      )}

      {loading && (
        <div className="ms-list">
          {[1, 2, 3].map((i) => (
            <div key={i} className="ms-skel" />
          ))}
        </div>
      )}

      {!loading && !error && visible.length === 0 && (
        <div className="ms-empty">
          <strong>{scoped.length === 0 ? "No sprint yet" : "No sprints match"}</strong>
          <p>
            {scoped.length === 0
              ? admin
                ? "No sprint has been created for this project yet."
                : projectName
                  ? `When the admin adds you to a ${projectName} sprint, it will show up here.`
                  : "When the admin adds you to a sprint, it will show up here."
              : "Try a different status or search."}
          </p>
        </div>
      )}

      {!loading && visible.length > 0 && (
        <div className="ms-list">
          {visible.map((s) => (
            <SprintRow key={s.id} s={s} project={project} />
          ))}
        </div>
      )}
    </div>
  );
}