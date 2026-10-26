import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { getComplaints } from "../api/complaints";
import { useProjects } from "../projects";
import { STATUSES, isAdminUser, useConfig } from "../constants";
import "./Mysprints.scss"; // same look as "My sprints" (.ms-*)

// Support-side twin of My sprints: every card is a complaint, its ring follows the
// complaint's own status (Open 0%, In progress 50%, Resolved / Closed 100%), and "View"
// opens the complaint to update its status, follow up or escalate it.

// ---------- helpers ----------
const toDate = (d) => {
  if (!d) return null;
  const s = String(d);
  const dt = new Date(s.length === 10 ? `${s}T00:00:00` : s);
  return Number.isNaN(dt.getTime()) ? null : dt;
};

const fmtShort = (d) => {
  const dt = toDate(d);
  return dt ? dt.toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—";
};

const fmtYear = (d) => {
  const dt = toDate(d);
  return dt ? dt.getFullYear() : "";
};

// days from today to a date (negative = past)
const daysTo = (d) => {
  const dt = toDate(d);
  if (!dt) return null;
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  dt.setHours(0, 0, 0, 0);
  return Math.round((dt - t) / 86400000);
};

// a complaint is: active (being worked on) | planned (still Open) | completed (a done status)
const stateOf = (c) => (c.is_closed ? "completed" : c.status === "open" ? "planned" : "active");
const ORDER = { active: 0, planned: 1, completed: 2 };
const LABEL = { active: "In progress", planned: "Not started", completed: "Completed" };

const SORTS = [
  ["newest", "Newest First"],
  ["oldest", "Oldest First"],
  ["due", "Due Soon"],
  ["progress", "Most Progress"],
];

// the ring: Open 0%, any working status 50%, a done status (Resolved / Closed) 100%
const pctOf = (c) => (c.is_closed ? 100 : c.status === "open" ? 0 : 50);

const sorters = {
  newest: (a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")),
  oldest: (a, b) => String(a.created_at || "9999").localeCompare(String(b.created_at || "9999")),
  due: (a, b) => String(a.due_date || "9999").localeCompare(String(b.due_date || "9999")),
  progress: (a, b) => pctOf(b) - pctOf(a),
};

// one stable colour per name
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

// people on the complaint: assignee first, then helpers
const peopleOf = (c) => {
  const list = [];
  if (c.assigned_to_name) list.push({ id: `a${c.assigned_to}`, name: c.assigned_to_name });
  (c.helpers_names || []).forEach((n, i) => list.push({ id: `h${i}`, name: n }));
  return list;
};

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
  plus: (
    <>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
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
        return (
          <span key={u.id} className="ms-avatar" style={{ background: bg, color: fg }} title={u.name}>
            {initials(u.name)}
          </span>
        );
      })}
      {extra > 0 && <span className="ms-avatar is-more">+{extra}</span>}
    </span>
  );
}

function ComplaintRow({ c, project, admin }) {
  const state = stateOf(c);
  const pct = pctOf(c);
  const esc = (c.tasks || []).find((t) => t.escalation); // hidden task carrying the escalation
  const statusLabel = STATUSES.find((s) => s.value === c.status)?.label || c.status;

  const days = state === "completed" ? null : daysTo(c.due_date);
  const overdue = days !== null && days < 0;
  const soon = days !== null && days >= 0 && days <= 2;
  let left = null;
  if (days !== null) {
    left = days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? "Due today" : `${days}d left`;
  }
  const edge = state === "active" || state === "planned" ? (overdue ? "is-overdue" : soon ? "is-soon" : "") : "";

  const [bg, fg] = colorFor(c.case_number || c.category || "");

  return (
    <Link
      to={`/my-complaints/${c.id}${project ? `?project=${project}` : ""}`}
      className={`ms-card is-${state} ${edge}`}
      title={c.description ? c.description.slice(0, 160) : undefined}
    >
      <div className="ms-main">
        <div className="ms-line1">
          <h3 className="ms-card-title">{c.title}</h3>
          <span className={`ms-tag is-${state}`}>
            <i className="ms-dot" />
            {LABEL[state]}
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
            Filed {fmtShort(c.created_at)}, {fmtYear(c.created_at)}
          </span>
          {(c.case_number || c.category) && (
            <span className="ms-chip" style={{ background: bg, color: fg }}>
              {c.case_number || c.category}
            </span>
          )}
          {c.customer && <span className="ms-meta">{c.customer}</span>}
          {admin && c.created_by_name && <span className="ms-meta">by {c.created_by_name}</span>}
          {admin && !c.assigned_to_name && <span className="ms-meta">Unassigned</span>}
          <Avatars list={peopleOf(c)} />
        </div>
      </div>

      <div className="ms-prog">
        <MiniRing pct={pct} />
        <span className="ms-prog-tx">
          <b>{statusLabel}</b>
          <small>
            {state === "completed" ? "Finished" : state === "planned" ? "Not started yet" : "Being worked on"}
            {esc?.escalation === "admin" ? " · with the admin" : ""}
            {esc?.escalation === "developers"
              ? ` · with developers${esc.dev_task_status_label ? ` (${esc.dev_task_status_label})` : ""}`
              : ""}
          </small>
        </span>
      </div>

      <span className="ms-view">
        View Complaint <Icon name="arrow" size={16} />
      </span>
    </Link>
  );
}

// ---------- page ----------
export default function MyComplaints() {
  useConfig(); // re-render when the admin renames statuses
  const [params] = useSearchParams();
  const admin = isAdminUser(); // the admin sees every complaint of the project
  const project = params.get("project") || ""; // set when a project is clicked in the sidebar
  const { projects } = useProjects();
  const projectName = projects.find((p) => String(p.id) === String(project))?.name;
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("newest");
  const [q, setQ] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    getComplaints(project ? { kind: "complaint", project } : { kind: "complaint" })
      .then((rows) => setComplaints(Array.isArray(rows) ? rows : rows?.results || []))
      .catch(() => setError("Could not load your complaints."))
      .finally(() => setLoading(false));
  }, [project]);

  const counts = {
    all: complaints.length,
    active: complaints.filter((x) => stateOf(x) === "active").length,
    planned: complaints.filter((x) => stateOf(x) === "planned").length,
    completed: complaints.filter((x) => stateOf(x) === "completed").length,
  };

  const visible = useMemo(() => {
    const term = q.trim().toLowerCase();
    return complaints
      .filter((c) => status === "all" || stateOf(c) === status)
      .filter(
        (c) =>
          !term ||
          (c.title || "").toLowerCase().includes(term) ||
          (c.customer || "").toLowerCase().includes(term) ||
          (c.case_number || "").toLowerCase().includes(term)
      )
      .sort(
        (a, b) => (status === "all" ? (ORDER[stateOf(a)] ?? 9) - (ORDER[stateOf(b)] ?? 9) : 0) || sorters[sort](a, b)
      );
  }, [complaints, status, q, sort]);

  const STATS = [
    ["active", "Active", counts.active, "play"],
    ["planned", "Not Started", counts.planned, "clock"],
    ["completed", "Completed", counts.completed, "check"],
    ["all", "Total Complaints", counts.all, "list"],
  ];

  return (
    <div className="ms">
      <header className="ms-head">
        <span className="ms-head-icon">
          <Icon name="layers" size={24} />
        </span>
        <div>
          <h1>{projectName ? `${projectName} complaints` : admin ? "All complaints" : "My complaints"}</h1>
          <p>
            {admin
              ? `Every ${projectName ? `${projectName} ` : ""}complaint. Open one to review its status and follow-ups.`
              : projectName
                ? `The ${projectName} complaints you handle. Open one to update its status and follow up.`
                : "The complaints you handle. Open one to update its status and follow up."}
          </p>
        </div>
        {admin && (
          <Link
            to={`/new?kind=complaint${project ? `&project=${project}` : ""}`}
            className="lay-new"
            style={{ marginLeft: "auto" }}
          >
            <Icon name="plus" size={16} />
            <span>New complaint</span>
          </Link>
        )}
      </header>

      {error && <div className="ms-alert">{error}</div>}

      {!loading && !error && complaints.length > 0 && (
        <>
          <div className="ms-stats">
            {STATS.map(([key, label, n, icon]) => (
              <button
                key={label}
                type="button"
                className={`ms-stat is-${key} ${status === key ? "is-on" : ""}`}
                onClick={() => setStatus(key)}
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
                placeholder="Search complaints..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </label>

            <label className="ms-select">
              <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status">
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="planned">Not Started</option>
                <option value="completed">Completed</option>
              </select>
            </label>

            <label className="ms-select has-icon">
              <Icon name="sort" size={17} />
              <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort complaints">
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
          <strong>{complaints.length === 0 ? "No complaint yet" : "No complaints match"}</strong>
          <p>
            {complaints.length === 0
              ? admin
                ? "No complaints in this project yet."
                : "File a complaint from New complaint, then open it here to follow it up."
              : "Try a different status or search."}
          </p>
        </div>
      )}

      {!loading && visible.length > 0 && (
        <div className="ms-list">
          {visible.map((c) => (
            <ComplaintRow key={c.id} c={c} project={project} admin={admin} />
          ))}
        </div>
      )}
    </div>
  );
}