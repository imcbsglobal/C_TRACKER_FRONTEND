import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { getComplaints, getTeam, updateComplaint } from "../api/complaints";
import {
  addCasesToSprint,
  completeSprint,
  createSprint,
  deleteSprint,
  getSprints,
  removeCasesFromSprint,
  startSprint,
  updateSprint,
} from "../api/sprints";
import { STATUSES, isAdminUser } from "../constants";
import { useProjects } from "../projects";
import "./Sprints.scss";
import "./SprintSections.scss";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const errText = (err, fallback) => {
  const d = err?.response?.data;
  if (!d || typeof d === "string") return fallback;
  if (d.detail) return d.detail;
  const first = Object.values(d)[0];
  return (Array.isArray(first) ? first[0] : first) || fallback;
};

// "2026-10-14" is read as a local date (not UTC) so it never shifts by a day.
const toDate = (d) => {
  if (!d) return null;
  const s = String(d);
  const dt = new Date(s.length === 10 ? `${s}T00:00:00` : s);
  return Number.isNaN(dt.getTime()) ? null : dt;
};

const fmtDate = (d) => {
  const dt = toDate(d);
  return dt ? dt.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }) : "—";
};

const todayStart = () => {
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return t;
};

const isoDate = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// WhatsApp number that receives the daily report (country code, no + or spaces).
const WA_NUMBER = import.meta.env.VITE_WA_NUMBER || "919876543210";

const isToday = (d) => {
  const dt = toDate(d);
  return !!dt && dt.toDateString() === new Date().toDateString();
};

const statusLabel = (value) => STATUSES.find((s) => s.value === value)?.label || value;
const statusTone = (value) => STATUSES.find((s) => s.value === value)?.tone || "grey";
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");
const initials = (name) =>
  (name || "").split(" ").filter(Boolean).map((w) => w[0]).join("").slice(0, 2).toUpperCase();

// Closed tasks of the sprint, grouped by project, with the assignee of each task.
const buildReport = (sprint, cases) => {
  const dateText = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  const isClosed = (c) =>
    c.is_closed ||
    String(c.status).toLowerCase() === "closed" ||
    statusLabel(c.status).toLowerCase() === "closed";
  const closed = cases.filter((c) => isClosed(c) && isToday(c.closed_at || c.updated_at));
  const names = sprint.project_names || [];
  const blocks = [];
  (sprint.projects || []).forEach((id, i) => {
    const byPerson = new Map();
    closed
      .filter((c) => c.project === id)
      .forEach((c) => {
        const who = c.assigned_to_name || "Unassigned";
        byPerson.set(who, [...(byPerson.get(who) || []), c]);
      });
    if (byPerson.size === 0) return;
    const people = [...byPerson.entries()].map(
      ([who, tasks]) =>
        `Assignee: ${who}\nSprint: ${sprint.name}\n${tasks.map((c, n) => `${n + 1}. ${c.title} - ${statusLabel(c.status)}`).join("\n")}`
    );
    blocks.push(`*Project: ${names[i] || "Project"}*\n${people.join("\n\n")}`);
  });
  const head = `*Daily report - ${dateText}*`;
  if (blocks.length) return `${head}\n\n${blocks.join("\n\n")}`;
  return `${head}\n\nSprint: ${sprint.name}\n${cases.length === 0 ? "No tasks in this sprint yet." : "No tasks closed today."}`;
};

const daysLeft = (end) => {
  const e = toDate(end);
  if (!e) return null;
  e.setHours(23, 59, 59, 0);
  return Math.ceil((e - new Date()) / 86400000);
};

// Share of the sprint time that has passed (0-100), or null without both dates.
const elapsedPct = (s) => {
  const start = toDate(s.start_date);
  const end = toDate(s.end_date);
  if (!start || !end || end <= start) return null;
  return Math.round(Math.min(100, Math.max(0, ((todayStart() - start) / (end - start)) * 100)));
};

const isOverdueCase = (c) => {
  if (c.is_closed || !c.due_date) return false;
  const due = toDate(c.due_date);
  return !!due && due < todayStart();
};

// Open work first (overdue, then by due date), finished work last.
const caseOrder = (a, b) =>
  Number(a.is_closed) - Number(b.is_closed) ||
  Number(isOverdueCase(b)) - Number(isOverdueCase(a)) ||
  String(a.due_date || "9999").localeCompare(String(b.due_date || "9999")) ||
  a.id - b.id;

const statsFor = (list) => {
  const total = list.length;
  const done = list.filter((c) => c.is_closed).length;
  return {
    total,
    done,
    open: total - done,
    pct: total ? Math.round((done / total) * 100) : 0,
    overdue: list.filter(isOverdueCase).length,
    unassigned: list.filter((c) => !c.is_closed && !c.assigned_to).length,
  };
};

// Compares the work done with the time used.
const paceFor = (sprint, stats) => {
  if (stats.total === 0) return null;
  if (stats.done === stats.total) return { key: "done", label: "All tasks done" };
  const end = toDate(sprint.end_date);
  if (end && todayStart() > end) return { key: "late", label: "Past end date" };
  const elapsed = elapsedPct(sprint);
  if (elapsed === null) return null;
  return stats.pct + 10 >= elapsed ? { key: "ok", label: "On track" } : { key: "behind", label: "Behind schedule" };
};

const leftText = (left) =>
  left < 0 ? `${plural(Math.abs(left), "day")} past the end date` : left === 0 ? "Ends today" : `${plural(left, "day")} left`;

// A project's tasks grouped by its sections. Empty sections are left out; tasks without one come last.
const groupBySection = (list, sections = []) => {
  const known = new Set(sections.map((x) => x.id));
  const groups = sections.map((x) => ({
    key: x.id,
    name: x.name,
    owners: x.owner_names || [],
    mine: !!x.is_mine,
    cases: list.filter((c) => c.section === x.id),
  }));
  const loose = list.filter((c) => !c.section || !known.has(c.section));
  if (loose.length) groups.push({ key: "none", name: "No section", owners: [], cases: loose });
  return groups.filter((g) => g.cases.length > 0);
};

function useModalChrome(onClose) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);
}

/* ------------------------------------------------------------------ */
/* Small pieces                                                        */
/* ------------------------------------------------------------------ */

const iconProps = {
  viewBox: "0 0 24 24",
  width: 15,
  height: 15,
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": "true",
};

const IconEye = () => (
  <svg {...iconProps}>
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);
const IconSend = () => (
  <svg {...iconProps}>
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);
const IconEdit = () => (
  <svg {...iconProps}>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
  </svg>
);
const IconCheck = () => (
  <svg {...iconProps}>
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

const IconTrash = () => (
  <svg {...iconProps}>
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6M14 11v6" />
  </svg>
);

function Bar({ pct, elapsed, label }) {
  return (
    <div className="sx-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <span className="sx-fill" style={{ width: `${pct}%` }} />
      {elapsed !== null && elapsed !== undefined && (
        <i className="sx-marker" style={{ left: `${elapsed}%` }} title={`${elapsed}% of the time has passed`} />
      )}
    </div>
  );
}

function Avatar({ name }) {
  return (
    <span className="sx-av" aria-hidden="true">
      {initials(name) || "?"}
    </span>
  );
}

function ViewButton({ c }) {
  return (
    <Link to={`/complaints/${c.id}`} className="sx-view" aria-label={`View ${c.title}`}>
      <IconEye />
      <span>View</span>
    </Link>
  );
}

// Tasks under their section headings. A project with no sections just shows its plain list.
function SectionGroups({ cases, sections, render }) {
  if (!sections || sections.length === 0) return render(cases);
  return (
    <div className="ss-groups">
      {groupBySection(cases, sections).map((g) => {
        const st = statsFor(g.cases);
        return (
          <div key={g.key} className="ss-group">
            <div className="ss-group-head">
              <h5>{g.name}</h5>
              {g.mine && <span className="sx-chip is-ok">Yours</span>}
              {g.owners.length > 0 && <small className="sp-hint">Owner: {g.owners.join(", ")}</small>}
              <span className="ss-group-count">
                {st.done}/{st.total} done
              </span>
              <span className="ss-group-bar" aria-hidden="true">
                <i style={{ width: `${st.pct}%` }} />
              </span>
            </div>
            {render(g.cases)}
          </div>
        );
      })}
    </div>
  );
}

// One row for planned, completed and backlog tasks. Pass onToggle for the backlog checkbox.
function CaseRow({ c, onRemove, disabled, showSection, picked, onToggle }) {
  return (
    <li className={`sp-case ${picked ? "is-picked" : ""}`}>
      {onToggle && (
        <input type="checkbox" checked={!!picked} onChange={onToggle} aria-label={`Select ${c.title}`} />
      )}
      <div className="sp-case-info">
        <span className="sp-case-num">{c.task_number}</span>
        <span className="sp-case-title">{c.title}</span>
        <span className="sp-case-who">
          <Avatar name={c.assigned_to_name} />
          {c.assigned_to_name || "Unassigned"}
        </span>
        {showSection && c.section_name && <span className="ss-tag">{c.section_name}</span>}
      </div>
      <div className="sp-case-ctrl">
        <span className={`sp-pill ${c.is_closed ? "is-done" : ""}`}>{statusLabel(c.status)}</span>
        <ViewButton c={c} />
        {onRemove && (
          <button
            type="button"
            className="sp-link sx-remove"
            disabled={disabled}
            onClick={() => onRemove(c)}
            aria-label={`Remove ${c.title} from sprint`}
          >
            Remove
          </button>
        )}
      </div>
    </li>
  );
}

// Row of the active sprint: status select + done button. The admin only watches.
function ActiveCase({ c, working, canDone, canRemove, readOnly, onStatus, onDone, onReopen, onRemove }) {
  const late = isOverdueCase(c);
  const editable = c.can_edit !== false && !readOnly;
  return (
    <li className={`sp-case sx-row ${c.is_closed ? "is-done" : ""} ${c.is_mine ? "is-mine" : ""}`}>
      <div className="sp-case-info">
        <span className="sp-case-num">{c.task_number}</span>
        <span className="sp-case-title">{c.title}</span>
        {c.priority && (
          <span className="sx-prio" data-p={c.priority}>
            {cap(c.priority)}
          </span>
        )}
        <span className="sp-case-who">
          <Avatar name={c.assigned_to_name} />
          {c.assigned_to_name || "Unassigned"}
        </span>
        <span className={`sx-due ${late ? "is-late" : ""}`}>
          {c.due_date ? `${late ? "Overdue · " : "Due "}${fmtDate(c.due_date)}` : "No due date"}
        </span>
      </div>

      <div className="sp-case-ctrl sx-ctrl">
        {editable ? (
          <select
            className="sx-status"
            data-tone={statusTone(c.status)}
            value={c.status}
            disabled={working}
            onChange={(e) => onStatus(c, e.target.value)}
            aria-label={`Status of ${c.title}`}
          >
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        ) : (
          <span
            className={`sp-pill ${c.is_closed ? "is-done" : ""}`}
            title={readOnly ? "The assignee updates the status" : "Only the assignee, helpers or whoever filed this task can update it"}
          >
            {statusLabel(c.status)}
          </span>
        )}

        {editable && canDone && (
          <button
            type="button"
            className={c.is_closed ? "sp-btn sx-btn" : "sp-btn sp-btn-primary sx-btn"}
            disabled={working}
            onClick={() => (c.is_closed ? onReopen(c) : onDone(c))}
          >
            {c.is_closed ? "Reopen" : "Mark done"}
          </button>
        )}

        <ViewButton c={c} />

        {canRemove && (
          <button
            type="button"
            className="sp-link sx-remove"
            disabled={working}
            onClick={() => onRemove(c)}
            aria-label={`Remove ${c.title} from sprint`}
          >
            Remove
          </button>
        )}
      </div>
    </li>
  );
}

const SPRINT_STATUS_TEXT = { active: "Active", planned: "Planned", completed: "Completed" };

// One sprint on the overview: kept short on purpose. Goal, people and full numbers live in the details view.
function SprintOverviewCard({ s, admin, busy, canStart, focus, onOpen, onEdit, onStart, onComplete, onDelete }) {
  const total = s.total_count || 0;
  const done = s.done_count || 0;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const ids = s.projects || [];
  const names = s.project_names || [];
  const isActive = s.status === "active";
  const isPlanned = s.status === "planned";
  const left = isActive ? daysLeft(s.end_date) : null;
  const startsIn =
    isPlanned && toDate(s.start_date) ? Math.round((toDate(s.start_date) - todayStart()) / 86400000) : null;

  const from = toDate(s.start_date);
  const to = toDate(s.end_date);
  const short = (d) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const dateText =
    from && to
      ? `${short(from)} – ${short(to)}, ${to.getFullYear()}`
      : from || to
        ? fmtDate(s.start_date || s.end_date)
        : "No dates set";

  const shown = ids.slice(0, 2);
  const extra = ids.length - shown.length;
  const people = (s.member_names || []).join(", ");

  return (
    <article className={`sv-card sc is-${s.status}`}>
      <header className="sc-head">
        <span className="sc-state">
          <i />
          {SPRINT_STATUS_TEXT[s.status] || s.status}
        </span>
        {left !== null && <span className={`sc-when ${left <= 2 ? "is-late" : ""}`}>{leftText(left)}</span>}
        {startsIn !== null && (
          <span className="sc-when">
            {startsIn > 0 ? `Starts in ${plural(startsIn, "day")}` : startsIn === 0 ? "Starts today" : "Start date passed"}
          </span>
        )}
        {s.status === "completed" && s.unfinished_at_close > 0 && (
          <span className="sc-when is-late">{s.unfinished_at_close} unfinished</span>
        )}
      </header>

      <div>
        <h4 className="sc-name" title={s.name}>
          {s.name}
        </h4>
        <p className="sc-dates">{dateText}</p>
      </div>

      {isPlanned ? (
        <p className="sc-count">
          <span>
            <b>{total}</b> {total === 1 ? "task" : "tasks"} planned
          </span>
        </p>
      ) : (
        <div className="sc-prog">
          <div className="sc-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${s.name} progress`}>
            <i style={{ width: `${pct}%` }} />
          </div>
          <span className="sc-prog-tx">
            <span>
              {done}/{total} tasks
            </span>
            <b>{pct}%</b>
          </span>
        </div>
      )}

      {ids.length > 0 && (
        <div className="sc-meta" title={people ? `People: ${people}` : undefined}>
          {shown.map((id) => (
            <button
              type="button"
              key={id}
              className="sc-chip"
              onClick={() => onOpen(s, id)}
              title={`Open ${names[ids.indexOf(id)] || "project"}`}
            >
              {names[ids.indexOf(id)] || "Project"}
            </button>
          ))}
          {extra > 0 && (
            <span className="sc-chip is-more" title={ids.slice(2).map((id) => names[ids.indexOf(id)]).join(", ")}>
              +{extra}
            </span>
          )}
        </div>
      )}

      <footer className="sc-foot">
        <button
          type="button"
          className="sc-view"
          disabled={ids.length === 0}
          onClick={() => ids[0] && onOpen(s, ids.includes(focus) ? focus : ids[0])}
        >
          <IconEye />
          <span>View details</span>
        </button>
        {admin && (
          <span className="sc-acts">
            <button type="button" className="sc-icon" onClick={() => onEdit(s)} disabled={busy} title="Edit" aria-label={`Edit ${s.name}`}>
              <IconEdit />
            </button>
            {isPlanned && (
              <button
                type="button"
                className="sc-primary"
                onClick={() => onStart(s)}
                disabled={busy || !canStart}
                title={canStart ? "Start this sprint" : "Complete the running sprint of the same project first"}
              >
                Start
              </button>
            )}
            {isActive && (
              <button type="button" className="sc-primary" onClick={() => onComplete(s)} disabled={busy}>
                Complete
              </button>
            )}
            <button type="button" className="sc-icon is-danger" onClick={() => onDelete(s)} disabled={busy} title="Delete" aria-label={`Delete ${s.name}`}>
              <IconTrash />
            </button>
          </span>
        )}
      </footer>
    </article>
  );
}

/* ------------------------------------------------------------------ */
/* Modals                                                              */
/* ------------------------------------------------------------------ */

function SprintModal({ sprint, projectId, projects = [], activeSprints = [], onClose, onSaved }) {
  const isNew = !sprint;
  const [name, setName] = useState(sprint?.name || "");
  const [goal, setGoal] = useState(sprint?.goal || "");
  const [start, setStart] = useState(sprint?.start_date || "");
  const [end, setEnd] = useState(sprint?.end_date || "");
  const [autoClose, setAutoClose] = useState(sprint ? sprint.auto_close !== false : true);
  const [startNow, setStartNow] = useState(false); // new sprint: Active (start now) or Planned
  const [selected, setSelected] = useState(
    sprint ? (sprint.projects || []).map(Number) : projectId ? [Number(projectId)] : []
  );
  const [members, setMembers] = useState((sprint?.members || []).map(Number));
  const [team, setTeam] = useState([]);
  const [filter, setFilter] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useModalChrome(onClose);

  useEffect(() => {
    getTeam()
      .then(setTeam)
      .catch(() => setError("Could not load the team."));
  }, []);

  const toggleProject = (id) =>
    setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  // Only developers who belong to one of the chosen projects can work in the sprint.
  const projectPeople = new Set(
    projects.filter((p) => selected.includes(p.id)).flatMap((p) => (p.members || []).map(Number))
  );
  const people = team.filter(
    (t) => projectPeople.has(t.id) && (!t.access || ["developer", "both"].includes(t.access))
  );
  const shown = people.filter((t) => t.full_name.toLowerCase().includes(filter.trim().toLowerCase()));
  const picked = members.filter((id) => people.some((t) => t.id === id));
  const toggleMember = (id) =>
    setMembers((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  const allShownChosen = shown.length > 0 && shown.every((t) => members.includes(t.id));
  const toggleAllMembers = () =>
    setMembers((cur) =>
      allShownChosen
        ? cur.filter((id) => !shown.some((t) => t.id === id))
        : [...new Set([...cur, ...shown.map((t) => t.id)])]
    );
  const removedProjects = sprint ? (sprint.projects || []).filter((id) => !selected.includes(Number(id))) : [];

  // A sprint can't start while another one is running in one of the same projects.
  const clash = activeSprints.find(
    (x) => x.id !== sprint?.id && (x.projects || []).some((p) => selected.includes(Number(p)))
  );
  const goActive = startNow && !clash;

  // Quick 1 / 2 / 3 week sprint from the start date (or today).
  const setLength = (weeks) => {
    const from = toDate(start) || todayStart();
    const to = new Date(from);
    to.setDate(to.getDate() + weeks * 7 - 1);
    if (!start) setStart(isoDate(from));
    setEnd(isoDate(to));
  };

  const submit = async (e) => {
    e.preventDefault();
    const problem = !name.trim()
      ? "Sprint name is required."
      : selected.length === 0
        ? "Add at least one project to this sprint."
        : picked.length === 0
          ? "Choose at least one person to work in this sprint."
          : start && end && end < start
            ? "End date can't be before the start date."
            : "";
    if (problem) return setError(problem);
    setSaving(true);
    setError("");
    try {
      const payload = {
        name: name.trim(),
        goal: goal.trim(),
        start_date: start || null,
        end_date: end || null,
        auto_close: autoClose,
        projects: selected,
        members: picked,
      };
      if (!isNew) {
        await updateSprint(sprint.id, payload);
        await onSaved();
        return;
      }
      const created = await createSprint(payload);
      if (!goActive) {
        await onSaved(null, "planned");
        return;
      }
      try {
        await startSprint(created?.id ?? created?.data?.id);
        await onSaved(null, "active");
      } catch (err) {
        await onSaved(
          `Sprint created as planned, but it could not be started: ${errText(err, "unknown error")}`,
          "planned"
        );
      }
    } catch (err) {
      setError(errText(err, "Could not save the sprint."));
      setSaving(false);
    }
  };

  return createPortal(
    <div className="sp-overlay" onClick={onClose}>
      <form
        className="sp-modal sp-modal-wide"
        role="dialog"
        aria-modal="true"
        aria-label={isNew ? "New sprint" : "Edit sprint"}
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
      >
        <h2>{isNew ? "New sprint" : "Edit sprint"}</h2>
        {error && <div className="sp-alert">{error}</div>}

        <label className="sp-field">
          <span>Sprint name</span>
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sprint 12" maxLength={150} />
        </label>

        <div className="sp-field">
          <div className="sp-cols">
            <label className="sp-field">
              <span>Start date</span>
              <input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
            </label>
            <label className="sp-field">
              <span>End date</span>
              <input type="date" value={end} min={start || undefined} onChange={(e) => setEnd(e.target.value)} />
            </label>
          </div>
          <div className="sx-quick">
            <span>Quick length:</span>
            {[1, 2, 3].map((w) => (
              <button type="button" key={w} className="sx-chipbtn" onClick={() => setLength(w)}>
                {w} week{w > 1 ? "s" : ""}
              </button>
            ))}
          </div>
        </div>

        <div className="sp-field">
          <span>
            Projects <em className="ss-count">({selected.length} selected)</em>
          </span>
          {projects.length === 0 ? (
            <small className="sp-hint">Create a development project under Projects first.</small>
          ) : (
            <ul className="ss-projects">
              {projects.map((p) => {
                const on = selected.includes(p.id);
                const n = (p.sections || []).length;
                return (
                  <li key={p.id}>
                    <label className={on ? "on" : ""}>
                      <input type="checkbox" checked={on} onChange={() => toggleProject(p.id)} />
                      <span className="ss-projects-name">{p.name}</span>
                      <small>{plural(n, "section")}</small>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
          <small className="sp-hint">
            Each project's tasks are worked inside this sprint, grouped by section.
            {removedProjects.length > 0 && " Removing a project sends its tasks in this sprint back to the backlog."}
          </small>
        </div>

        <div className="sp-field">
          <span>
            People <em className="ss-count">({picked.length} selected)</em>
          </span>
          {selected.length === 0 ? (
            <small className="sp-hint"></small>
          ) : (
            <>
              <div className="sp-pick-tools">
                <input
                  type="search"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  placeholder="Search people..."
                  aria-label="Search people"
                />
                <button type="button" className="sp-link" onClick={toggleAllMembers}>
                  {allShownChosen ? "Clear" : "Select all"}
                </button>
              </div>
              <ul className="sp-pick">
                {shown.map((t) => (
                  <li key={t.id}>
                    <label className={members.includes(t.id) ? "on" : ""}>
                      <input type="checkbox" checked={members.includes(t.id)} onChange={() => toggleMember(t.id)} />
                      <span className="sp-av" aria-hidden="true">{initials(t.full_name)}</span>
                      <span className="sp-pick-name">{t.full_name}</span>
                    </label>
                  </li>
                ))}
                {shown.length === 0 && <li className="sp-pick-empty">No developers found in these projects</li>}
              </ul>
            </>
          )}
          
        </div>

        <label className="sp-field">
          <span>Goal</span>
          <textarea
            rows={3}
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="What should be done by the end of this sprint?"
            maxLength={300}
          />
        </label>

        <label className="sp-check">
          <input type="checkbox" checked={autoClose} onChange={(e) => setAutoClose(e.target.checked)} />
          <span>
            Close this sprint automatically after the end date
           
          </span>
        </label>

        {isNew && (
          <div className="sp-field">
            <span>Sprint status</span>
            <div className="sx-seg" role="group" aria-label="Sprint status">
              <button type="button" className={!goActive ? "is-on" : ""} onClick={() => setStartNow(false)}>
                Planned
              </button>
              <button
                type="button"
                className={goActive ? "is-on" : ""}
                onClick={() => setStartNow(true)}
                disabled={!!clash}
                style={clash ? { opacity: 0.5, cursor: "not-allowed" } : undefined}
              >
                Active (start now)
              </button>
            </div>
            <small className="sp-hint">
              {clash
                ? `"${clash.name}" is already running in one of these projects. Complete it first to start this one now.`
                : goActive
                  ? "The sprint starts right after it is created."
                  : "The sprint is saved as planned and you can start it later."}
            </small>
          </div>
        )}

        <div className="sp-actions">
          <button type="button" className="sp-btn" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" className="sp-btn sp-btn-primary" disabled={saving}>
            {saving ? "Saving..." : isNew ? "Create sprint" : "Save changes"}
          </button>
        </div>
      </form>
    </div>,
    document.body
  );
}

function CompleteModal({ sprint, onClose, onDone }) {
  const [cases, setCases] = useState(null);
  const [plannedAll, setPlannedAll] = useState([]);
  const [moveTo, setMoveTo] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useModalChrome(onClose);

  useEffect(() => {
    Promise.all([getComplaints({ sprint: sprint.id }), getSprints({ status: "planned" })])
      .then(([cs, planned]) => {
        setCases(cs);
        setPlannedAll(planned);
      })
      .catch(() => setError("Could not load the sprint's tasks."));
  }, [sprint.id]);

  const unfinished = useMemo(() => (cases || []).filter((c) => !c.is_closed), [cases]);
  const perProject = useMemo(() => {
    const map = new Map();
    unfinished.forEach((c) => map.set(c.project_name, (map.get(c.project_name) || 0) + 1));
    return [...map.entries()];
  }, [unfinished]);

  // A planned sprint can take the leftovers only if it includes every project that has some.
  const needed = [...new Set(unfinished.map((c) => c.project))];
  const targets = plannedAll.filter((p) => needed.every((id) => (p.projects || []).includes(id)));
  const shownCases = unfinished.slice(0, 6);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await completeSprint(sprint.id, moveTo ? Number(moveTo) : null);
      await onDone();
    } catch (err) {
      setError(errText(err, "Could not complete the sprint."));
      setSaving(false);
    }
  };

  return createPortal(
    <div className="sp-overlay" onClick={onClose}>
      <form
        className="sp-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Complete sprint"
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
      >
        <h2>Complete {sprint.name}</h2>
        {error && <div className="sp-alert">{error}</div>}

        <p className="sp-lead">
          {sprint.done_count} of {plural(sprint.total_count, "task")} done.
          {cases === null
            ? ""
            : unfinished.length > 0
              ? ` ${plural(unfinished.length, "unfinished task")} will move out of this sprint.`
              : " Nothing is left open."}
        </p>

        {perProject.length > 1 && (
          <p className="ss-perproject">
            {perProject.map(([name, n]) => (
              <span key={name}>
                {name}: <b>{n}</b>
              </span>
            ))}
          </p>
        )}

        {unfinished.length > 0 && (
          <>
            <ul className="sx-unfinished">
              {shownCases.map((c) => (
                <li key={c.id}>
                  <span>{c.task_number}</span>
                  <em>{c.title}</em>
                  <small>
                    {c.project_name}
                    {c.section_name ? ` · ${c.section_name}` : ""} · {c.assigned_to_name || "Unassigned"}
                  </small>
                </li>
              ))}
              {unfinished.length > shownCases.length && (
                <li className="sx-unfinished-more">+ {unfinished.length - shownCases.length} more</li>
              )}
            </ul>

            <label className="sp-field">
              <span>Move unfinished tasks to</span>
              <select value={moveTo} onChange={(e) => setMoveTo(e.target.value)}>
                <option value="">Backlog</option>
                {targets.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <small className="sp-hint">
                Only planned sprints that include every project with unfinished tasks are listed.
              </small>
            </label>
          </>
        )}

        <small className="sp-hint">A completed sprint is locked. Its finished tasks stay in it as history.</small>

        <div className="sp-actions">
          <button type="button" className="sp-btn" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" className="sp-btn sp-btn-primary" disabled={saving || cases === null}>
            {saving ? "Completing..." : "Complete sprint"}
          </button>
        </div>
      </form>
    </div>,
    document.body
  );
}

function WhatsAppModal({ sprint, onClose }) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useModalChrome(onClose);

  useEffect(() => {
    getComplaints({ sprint: sprint.id })
      .then((cs) => setText(buildReport(sprint, cs)))
      .catch(() => setError("Could not load the sprint's tasks."))
      .finally(() => setLoading(false));
  }, [sprint]);

  const send = () => {
    window.open(`https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(text)}`, "_blank", "noopener");
    onClose();
  };

  return createPortal(
    <div className="sp-overlay" onClick={onClose}>
      <div className="sp-modal" role="dialog" aria-modal="true" aria-label="Send daily report" onClick={(e) => e.stopPropagation()}>
        <h2>Daily report</h2>
        {error && <div className="sp-alert">{error}</div>}
        <label className="sp-field">
          <span>Message</span>
          <textarea rows={14} value={loading ? "Loading..." : text} disabled={loading} onChange={(e) => setText(e.target.value)} />
          <small className="sp-hint">You can edit this before sending. WhatsApp opens with the message ready.</small>
        </label>
        <div className="sp-actions">
          <button type="button" className="sp-btn" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="sp-btn sp-btn-primary" onClick={send} disabled={loading || !text}>
            Send to WhatsApp
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function Sprints() {
  const admin = isAdminUser();
  const { projects } = useProjects();

  // "New sprint" sits in the page header (next to the title).
  const [headSlot, setHeadSlot] = useState(null);
  useEffect(() => {
    setHeadSlot(document.getElementById("lay-head-slot"));
  }, []);

  const devProjects = useMemo(() => projects.filter((p) => p.kind === "development"), [projects]);

  // "" = the sprint cards (default). Opening a card's project shows that project's details.
  const [projectPick, setProjectPick] = useState("");
  const pid = devProjects.some((p) => String(p.id) === projectPick) ? projectPick : "";
  const currentProject = devProjects.find((p) => String(p.id) === pid);
  const sections = currentProject?.sections || [];

  const [sprints, setSprints] = useState([]); // sprints of the open project
  const [allSprints, setAllSprints] = useState([]); // cards: every sprint
  const [activeAll, setActiveAll] = useState([]);
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [workingId, setWorkingId] = useState(null);
  const [error, setError] = useState("");
  const [modal, setModal] = useState(null); // null | "new" | sprint object
  const [completing, setCompleting] = useState(null);
  const [reporting, setReporting] = useState(false);
  const [picked, setPicked] = useState([]);
  const [targetPick, setTargetPick] = useState("");

  const [ovFilter, setOvFilter] = useState("active");
  const [ovProject, setOvProject] = useState(""); // cards: "" = all projects, else only that project's sprints
  const [tab, setTab] = useState("active"); // "active" | "planned" | "backlog" | "history"
  const [who, setWho] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [hideDone, setHideDone] = useState(false);

  const load = useCallback(async () => {
    const activeReq = getSprints({ status: "active" }).catch(() => []);
    if (!pid) {
      const [all, act] = await Promise.all([getSprints({}), activeReq]);
      setAllSprints(all);
      setActiveAll(act);
      return;
    }
    const [sp, cs, act] = await Promise.all([getSprints({ project: pid }), getComplaints({ project: pid }), activeReq]);
    setSprints(sp);
    setCases(cs);
    setActiveAll(act);
  }, [pid]);

  useEffect(() => {
    setPicked([]);
    setError("");
    setWho("all");
    setStatusFilter("all");
    setHideDone(false);
    setLoading(true);
    load()
      .catch(() => setError("Could not load sprints."))
      .finally(() => setLoading(false));
  }, [load]);

  // After a modal saves: reload, close it, and (for a new sprint) jump to the tab it landed in.
  const refresh = async (msg, status) => {
    await load();
    setModal(null);
    setCompleting(null);
    if (status) setOvFilter(status);
    if (typeof msg === "string") setError(msg);
  };

  const act = async (fn) => {
    setBusy(true);
    setError("");
    try {
      await fn();
      await load();
    } catch (err) {
      setError(errText(err, "Something went wrong."));
    }
    setBusy(false);
  };

  const active = sprints.find((s) => s.status === "active");
  const planned = useMemo(
    () =>
      sprints
        .filter((s) => s.status === "planned")
        .sort((a, b) => (a.start_date || "9999").localeCompare(b.start_date || "9999") || a.id - b.id),
    [sprints]
  );
  const finished = sprints.filter((s) => s.status === "completed");

  // ---------- Cards ----------
  const ovSprints = useMemo(() => {
    const rank = { active: 0, planned: 1, completed: 2 };
    return allSprints
      .filter((s) => !ovProject || (s.projects || []).map(Number).includes(Number(ovProject)))
      .sort(
      (a, b) =>
        (rank[a.status] ?? 3) - (rank[b.status] ?? 3) ||
        (a.status === "completed"
          ? String(b.end_date || "").localeCompare(String(a.end_date || ""))
          : String(a.start_date || "9999").localeCompare(String(b.start_date || "9999"))) ||
        a.id - b.id
    );
  }, [allSprints, ovProject]);
  const ovCounts = {
    active: ovSprints.filter((s) => s.status === "active").length,
    planned: ovSprints.filter((s) => s.status === "planned").length,
    completed: ovSprints.filter((s) => s.status === "completed").length,
  };
  // A planned sprint can start only when no other running sprint shares one of its projects.
  const canStartSprint = (s) =>
    !activeAll.some((x) => x.id !== s.id && (x.projects || []).some((p) => (s.projects || []).includes(p)));

  const casesBySprint = useMemo(() => {
    const map = new Map();
    cases.forEach((c) => c.sprint && map.set(c.sprint, [...(map.get(c.sprint) || []), c]));
    return map;
  }, [cases]);

  // Task counts of one sprint for the open project (a sprint can span several projects).
  const countsOf = (sp) => {
    const list = casesBySprint.get(sp.id) || [];
    return { total: list.length, done: list.filter((c) => c.is_closed).length };
  };

  const backlog = cases.filter((c) => !c.sprint && !c.is_closed);
  const targets = [active, ...planned].filter(Boolean);
  const targetId = targets.some((s) => String(s.id) === targetPick) ? targetPick : targets[0] ? String(targets[0].id) : "";
  const allPicked = backlog.length > 0 && backlog.every((c) => picked.includes(c.id));
  const togglePick = (id) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const addPicked = () =>
    act(async () => {
      await addCasesToSprint(Number(targetId), picked);
      setPicked([]);
    });
  const removeCase = (sprint) => (c) => act(() => removeCasesFromSprint(sprint.id, [c.id]));
  const start = (s) => act(() => startSprint(s.id));

  // From a card: open one project of a sprint, on the tab that matches its state.
  const openSprint = (s, projectId) => {
    if (!devProjects.some((p) => p.id === projectId)) return;
    setProjectPick(String(projectId));
    setTab(s.status === "active" ? "active" : s.status === "planned" ? "planned" : "history");
  };

  const remove = (s) => {
    const n = s.total_count;
    const running = s.status === "active" ? " It is running right now, so the team will lose it immediately." : "";
    const warn = n
      ? `Delete "${s.name}"?${running} Its ${plural(n, "task")} will go back to the backlog.`
      : `Delete "${s.name}"?${running}`;
    if (window.confirm(warn)) act(() => deleteSprint(s.id));
  };

  // ---------- Updating a task straight from the sprint ----------
  // "Mark done" moves a task to the real closing status: Closed (always the last one).
  const doneStatus =
    STATUSES.find((s) => s.value === "closed") || [...STATUSES].reverse().find((s) => s.is_closed);
  const reopenStatus = STATUSES.find((s) => !s.is_closed);

  const changeStatus = async (c, value) => {
    if (!value || value === c.status) return;
    setWorkingId(c.id);
    setError("");
    try {
      await updateComplaint(c.id, { status: value });
      await load();
    } catch (err) {
      setError(errText(err, "Could not update that task."));
    }
    setWorkingId(null);
  };

  // ---------- Active sprint numbers ----------
  const activeCases = active ? casesBySprint.get(active.id) || [] : [];
  const activeStats = useMemo(() => statsFor(activeCases), [activeCases]);
  const pace = active ? paceFor(active, activeStats) : null;
  const left = active ? daysLeft(active.end_date) : null;
  const ended = left !== null && left < 0;
  const endingSoon = left !== null && left <= 2;
  const allDone = activeStats.total > 0 && activeStats.open === 0;
  const mine = activeCases.filter((c) => c.is_mine);
  const mineOpen = mine.filter((c) => !c.is_closed).length;
  const mineOverdue = mine.filter(isOverdueCase).length;
  const openByPerson = activeCases.reduce((m, c) => {
    if (!c.is_closed && c.assigned_to_name) m[c.assigned_to_name] = (m[c.assigned_to_name] || 0) + 1;
    return m;
  }, {});

  const shownActive = useMemo(
    () =>
      activeCases
        .filter(
          (c) =>
            (who === "all" || c.is_mine) &&
            (statusFilter === "all" || c.status === statusFilter) &&
            !(hideDone && c.is_closed)
        )
        .sort(caseOrder),
    [activeCases, who, statusFilter, hideDone]
  );
  const filtersOn = who !== "all" || statusFilter !== "all" || hideDone;
  const clearFilters = () => {
    setWho("all");
    setStatusFilter("all");
    setHideDone(false);
  };

  const renderDates = (s) => (
    <span>
      {fmtDate(s.start_date)} to <b>{fmtDate(s.end_date)}</b>
    </span>
  );

  const peopleChip = (sp) => {
    const n = (sp.member_names || []).length;
    return (
      <span className="sx-chip" title={(sp.member_names || []).join(", ") || "Nobody picked yet"}>
        {n} {n === 1 ? "person" : "people"}
      </span>
    );
  };

  // Projects that take part in a sprint; click one to switch to it.
  const renderProjects = (sp) => {
    const ids = sp.projects || [];
    const names = sp.project_names || [];
    if (ids.length === 0) return null;
    return (
      <span className="ss-projchips">
        {ids.map((id, i) => (
          <button
            type="button"
            key={id}
            className="ss-projchip"
            disabled={!devProjects.some((p) => p.id === id) || String(id) === pid}
            onClick={() => setProjectPick(String(id))}
          >
            {names[i] || "Project"}
          </button>
        ))}
      </span>
    );
  };

  const emptySprintLine = (
    <p className="sp-empty-line">
      No tasks in this sprint yet.
      {admin && (
        <>
          {" "}
          <button type="button" className="sp-link" onClick={() => setTab("backlog")}>
            Add from backlog
          </button>
        </>
      )}
    </p>
  );

  const renderCaseList = (s, canRemove) => {
    const list = casesBySprint.get(s.id) || [];
    if (list.length === 0) return emptySprintLine;
    return (
      <SectionGroups
        cases={list}
        sections={sections}
        render={(items) => (
          <ul className="sp-cases">
            {items.map((c) => (
              <CaseRow key={c.id} c={c} onRemove={canRemove ? removeCase(s) : undefined} disabled={busy} />
            ))}
          </ul>
        )}
      />
    );
  };

  const newSprintBtn = (
    <button type="button" className="sp-new" onClick={() => setModal("new")}>
      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
      </svg>
      <span>New sprint</span>
    </button>
  );

  /* ---------- Render ---------- */

  return (
    <div className="sp">
      {error && <div className="sp-alert">{error}</div>}

      {devProjects.length === 0 ? (
        <div className="sp-empty">
          <strong>No development project yet</strong>
          <p>
            {admin
              ? "Sprints are made of development projects. Create one under Projects first."
              : "Sprints are made of development projects. Ask the admin to add you to one."}
          </p>
        </div>
      ) : (
        <div className="sp-page">
          {admin && headSlot && createPortal(newSprintBtn, headSlot)}
          {admin && !headSlot && !pid && <div className="sp-top">{newSprintBtn}</div>}

          {pid && (
            <>
              <div className="sp-top">
                <button type="button" className="sp-link" onClick={() => setProjectPick("")}>
                  ← All sprints
                </button>
                <span className="sp-projname">{currentProject?.name}</span>
              </div>
              <div className="sp-tabs" role="tablist" aria-label="Sprint section">
                {[
                  ["active", "Active", active ? 1 : 0],
                  ["planned", "Planned", planned.length],
                  ["backlog", "Backlog", backlog.length],
                  ["history", "History", finished.length],
                ].map(([key, label, n]) => (
                  <button
                    type="button"
                    key={key}
                    role="tab"
                    aria-selected={tab === key}
                    className={`sp-tab ${tab === key ? "on" : ""}`}
                    onClick={() => setTab(key)}
                  >
                    {label}
                    <span>{n}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {loading && <p className="sp-muted">Loading...</p>}

          {/* ---------- Sprint cards (default) ---------- */}
          {!pid && (
            <section className="sv">
              <div className="sv-head">
              <select
                className="sv-project"
                value={ovProject}
                onChange={(e) => setOvProject(e.target.value)}
                aria-label="Project"
              >
                <option value="">All projects</option>
                {devProjects.map((p) => (
                  <option key={p.id} value={String(p.id)}>
                    {p.name}
                  </option>
                ))}
              </select>
              <div className="sv-seg" role="tablist" aria-label="Filter sprints">
                {[
                  ["active", "Active"],
                  ["planned", "Planned"],
                  ["completed", "Completed"],
                ].map(([key, label]) => (
                  <button
                    type="button"
                    key={key}
                    role="tab"
                    aria-selected={ovFilter === key}
                    className={`sv-segbtn ${ovFilter === key ? "on" : ""}`}
                    onClick={() => setOvFilter(key)}
                  >
                    {label}
                    <span>{ovCounts[key]}</span>
                  </button>
                ))}
              </div>
              </div>

              {!loading && ovSprints.length === 0 && (
                <div className="sp-empty">
                  <strong>{ovProject ? "No sprints in this project" : "No sprints yet"}</strong>
                  <p>
                    {admin
                      ? "Create the first sprint, choose its projects and people, then start it."
                      : "You are not part of any sprint yet."}
                  </p>
                  {admin && (
                    <button type="button" className="sp-btn sp-btn-primary" onClick={() => setModal("new")}>
                      New sprint
                    </button>
                  )}
                </div>
              )}

              {["active", "planned", "completed"]
                .filter((k) => ovFilter === k)
                .map((k) => {
                  const list = ovSprints.filter((s) => s.status === k);
                  if (list.length === 0) return null;
                  return (
                    <div className="sv-group" key={k}>
                      <h3 className="sv-grouphead">
                        {SPRINT_STATUS_TEXT[k]} <em>{list.length}</em>
                      </h3>
                      <div className="sv-grid">
                        {list.map((s) => (
                          <SprintOverviewCard
                            key={s.id}
                            s={s}
                            admin={admin}
                            busy={busy}
                            canStart={canStartSprint(s)}
                            focus={Number(ovProject) || null}
                            onOpen={openSprint}
                            onEdit={setModal}
                            onStart={start}
                            onComplete={setCompleting}
                            onDelete={remove}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}

              {ovSprints.length > 0 && ovCounts[ovFilter] === 0 && (
                <p className="sp-empty-line">No {ovFilter} sprints.</p>
              )}
            </section>
          )}

          {/* ---------- Active sprint ---------- */}
          {pid && tab === "active" && (
            <section className="sp-section">
              {active ? (
                <article className="sp-card ad-card">
                  <header className="sp-card-head">
                    <div>
                      <h4>{active.name}</h4>
                      <p className="sp-sub">
                        <span>
                          {fmtDate(active.start_date)} to <b className={endingSoon ? "is-red" : ""}>{fmtDate(active.end_date)}</b>
                        </span>
                        {left !== null && <span className={`sp-left ${endingSoon ? "is-late" : ""}`}>{leftText(left)}</span>}
                        {pace && <span className={`sx-chip is-${pace.key}`}>{pace.label}</span>}
                        {renderProjects(active)}
                        <span className="sx-chip">{active.auto_close ? "Auto-closes" : "Closes manually"}</span>
                      </p>
                    </div>
                    {admin && (
                      <div className="sp-card-actions">
                        <button type="button" className="sp-btn sp-btn-ghost" onClick={() => setReporting(true)} title="Send daily report">
                          <IconSend />
                          <span>Report</span>
                        </button>
                        <button type="button" className="sp-btn sp-btn-ghost" onClick={() => setModal(active)} disabled={busy}>
                          <IconEdit />
                          <span>Edit</span>
                        </button>
                        <button type="button" className="sp-btn sp-btn-danger" onClick={() => remove(active)} disabled={busy}>
                          <IconTrash />
                          <span>Delete</span>
                        </button>
                        <button type="button" className="sp-btn sp-btn-primary" onClick={() => setCompleting(active)} disabled={busy}>
                          <IconCheck />
                          <span>Complete</span>
                        </button>
                      </div>
                    )}
                  </header>

                  {active.goal && <p className="ad-goal">{active.goal}</p>}

                  <section className="ad-team" aria-label="People assigned to this sprint">
                    <span className="ad-team-label">Assigned to this sprint</span>
                    {(active.member_names || []).length === 0 ? (
                      <span className="ad-team-empty">Nobody picked yet</span>
                    ) : (
                      <ul className="ad-team-list">
                        {(active.member_names || []).map((n) => (
                          <li key={n} title={`${openByPerson[n] || 0} open in this sprint`}>
                            <Avatar name={n} />
                            <span>{n}</span>
                            <small>{openByPerson[n] || 0} open</small>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>

                  {allDone && (
                    <div className="sx-banner is-good" role="status">
                      <div>
                        <strong>Every task in this sprint is done.</strong>
                        <span>
                          {admin ? "Complete the sprint to lock it in and start the next one." : "Nice work. The admin will complete the sprint."}
                        </span>
                      </div>
                      {admin && (
                        <button type="button" className="sp-btn sp-btn-primary" onClick={() => setCompleting(active)} disabled={busy}>
                          Complete sprint
                        </button>
                      )}
                    </div>
                  )}
                  {!allDone && endingSoon && (
                    <div className="sx-banner is-late" role="alert">
                      <div>
                        <strong>
                          {ended
                            ? `This sprint is closing but not completed: ${plural(activeStats.open, "task")} still open.`
                            : `This sprint ends ${left === 0 ? "today" : `in ${plural(left, "day")}`} and ${plural(activeStats.open, "task")} ${activeStats.open === 1 ? "is" : "are"} not done.`}
                        </strong>
                        <span>
                          {active.auto_close
                            ? "It closes automatically after the end date and open tasks go back to the backlog."
                            : "Auto-close is off for this sprint. The admin has to close it."}{" "}
                          {admin ? "Extend the end date or complete it now." : "Finish what you can before then."}
                        </span>
                        {(active.unfinished_sections || []).length > 0 && (
                          <span>Not done: {active.unfinished_sections.map((s) => `${s.name} (${s.open_count})`).join(", ")}</span>
                        )}
                      </div>
                      {admin && (
                        <span className="sx-banner-actions">
                          <button type="button" className="sp-btn" onClick={() => setModal(active)} disabled={busy}>
                            Extend
                          </button>
                          <button type="button" className="sp-btn sp-btn-primary" onClick={() => setCompleting(active)} disabled={busy}>
                            Complete
                          </button>
                        </span>
                      )}
                    </div>
                  )}

                  <Bar pct={activeStats.pct} elapsed={elapsedPct(active)} label={`${active.name} progress`} />
                  <div className="ad-stats">
                    <div className="ad-stat is-main">
                      <b>{activeStats.pct}%</b>
                      <span>Complete</span>
                    </div>
                    <div className="ad-stat">
                      <b>
                        {activeStats.done}
                        <em>/{activeStats.total}</em>
                      </b>
                      <span>Tasks done</span>
                    </div>
                    <div className="ad-stat">
                      <b>{activeStats.open}</b>
                      <span>Open</span>
                    </div>
                    <div className={`ad-stat ${activeStats.overdue > 0 ? "is-warn" : ""}`}>
                      <b>{activeStats.overdue}</b>
                      <span>Overdue</span>
                    </div>
                    {admin && (
                      <div className={`ad-stat ${activeStats.unassigned > 0 ? "is-warn" : ""}`}>
                        <b>{activeStats.unassigned}</b>
                        <span>Unassigned</span>
                      </div>
                    )}
                  </div>

                  {activeStats.total > 0 && (
                    <div className="sx-toolbar">
                      <div className="sx-seg" role="group" aria-label="Show tasks">
                        <button type="button" className={who === "all" ? "is-on" : ""} onClick={() => setWho("all")}>
                          All tasks
                        </button>
                        <button type="button" className={who === "mine" ? "is-on" : ""} onClick={() => setWho("mine")}>
                          My tasks{mine.length > 0 && ` (${mineOpen} open${mineOverdue ? `, ${mineOverdue} late` : ""})`}
                        </button>
                      </div>
                      <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Filter by status">
                        <option value="all">Any status</option>
                        {STATUSES.map((s) => (
                          <option key={s.value} value={s.value}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                      <label className="sx-check">
                        <input type="checkbox" checked={hideDone} onChange={(e) => setHideDone(e.target.checked)} />
                        <span>Hide done</span>
                      </label>
                      {filtersOn && (
                        <button type="button" className="sp-link" onClick={clearFilters}>
                          Clear
                        </button>
                      )}
                    </div>
                  )}

                  {activeStats.total === 0 ? (
                    emptySprintLine
                  ) : shownActive.length === 0 ? (
                    <p className="sp-empty-line">No tasks match these filters.</p>
                  ) : (
                    <SectionGroups
                      cases={shownActive}
                      sections={sections}
                      render={(items) => (
                        <ul className="sx-rows">
                          {items.map((c) => (
                            <ActiveCase
                              key={c.id}
                              c={c}
                              working={workingId === c.id || busy}
                              canDone={!!doneStatus}
                              canRemove={admin}
                              readOnly={admin}
                              onStatus={changeStatus}
                              onDone={(t) => doneStatus && changeStatus(t, doneStatus.value)}
                              onReopen={(t) => reopenStatus && changeStatus(t, reopenStatus.value)}
                              onRemove={removeCase(active)}
                            />
                          ))}
                        </ul>
                      )}
                    />
                  )}
                </article>
              ) : (
                <div className="sp-empty">
                  <strong>No active sprint</strong>
                  <p>
                    {admin
                      ? planned.length
                        ? "Start one of the planned sprints."
                        : "Create a sprint, add tasks from the backlog, then start it."
                      : planned.length
                        ? "The admin will start the next sprint soon."
                        : "There is no sprint running right now."}
                  </p>
                  {admin && planned.length > 0 && (
                    <button type="button" className="sp-btn sp-btn-primary" onClick={() => setTab("planned")}>
                      Go to planned sprints
                    </button>
                  )}
                </div>
              )}
            </section>
          )}

          {/* ---------- Planned ---------- */}
          {pid && tab === "planned" &&
            (planned.length === 0 ? (
              <div className="sp-empty">
                <strong>No planned sprints</strong>
                <p>{admin ? "Use New sprint to plan the next one." : "Nothing is planned yet."}</p>
              </div>
            ) : (
              <section className="sp-section">
                {planned.map((s) => (
                  <article key={s.id} className="sp-card">
                    <header className="sp-card-head">
                      <div>
                        <h4>{s.name}</h4>
                        <p className="sp-sub">
                          {renderDates(s)}
                          <span className="sx-chip">{plural(countsOf(s).total, "task")}</span>
                          {peopleChip(s)}
                          {renderProjects(s)}
                        </p>
                      </div>
                      {admin && (
                        <div className="sp-card-actions">
                          <button type="button" className="sp-btn sp-btn-ghost" onClick={() => setModal(s)} disabled={busy}>
                            <IconEdit />
                            <span>Edit</span>
                          </button>
                          <button type="button" className="sp-btn sp-btn-danger" onClick={() => remove(s)} disabled={busy}>
                            Delete
                          </button>
                          <button
                            type="button"
                            className="sp-btn sp-btn-primary"
                            onClick={() => start(s)}
                            disabled={busy || !!active}
                            title={active ? "Complete the active sprint first" : "Start this sprint"}
                          >
                            Start sprint
                          </button>
                        </div>
                      )}
                    </header>
                    {s.goal && <p className="sp-goal">{s.goal}</p>}
                    {renderCaseList(s, admin)}
                  </article>
                ))}
              </section>
            ))}

          {/* ---------- Backlog ---------- */}
          {pid && tab === "backlog" && (
            <section className="sp-section">
              <div className="sp-section-head">
                <h3>Backlog ({backlog.length})</h3>
                {admin && backlog.length > 0 && (
                  <button type="button" className="sp-link" onClick={() => setPicked(allPicked ? [] : backlog.map((c) => c.id))}>
                    {allPicked ? "Clear" : "Select all"}
                  </button>
                )}
              </div>

              {backlog.length === 0 ? (
                <div className="sp-empty">
                  <strong>The backlog is empty</strong>
                  <p>Open tasks that are not in a sprint show up here.</p>
                </div>
              ) : (
                <>
                  <ul className="sp-cases">
                    {backlog.map((c) => (
                      <CaseRow
                        key={c.id}
                        c={c}
                        showSection
                        picked={admin ? picked.includes(c.id) : undefined}
                        onToggle={admin ? () => togglePick(c.id) : undefined}
                      />
                    ))}
                  </ul>

                  {admin && (
                    <div className={`sp-pickbar ${picked.length > 0 ? "has-picked" : ""}`}>
                      {targets.length === 0 ? (
                        <small className="sp-hint">Create a sprint to move tasks into it.</small>
                      ) : picked.length === 0 ? (
                        <small className="sp-hint">Tick tasks to add them to a sprint.</small>
                      ) : (
                        <>
                          <strong>{picked.length} selected</strong>
                          <label>
                            <span>Add to</span>
                            <select value={targetId} onChange={(e) => setTargetPick(e.target.value)}>
                              {targets.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.name}
                                  {s.status === "active" ? " (active)" : ""}
                                </option>
                              ))}
                            </select>
                          </label>
                          <button type="button" className="sp-btn sp-btn-primary" disabled={busy || !targetId} onClick={addPicked}>
                            Add {plural(picked.length, "task")}
                          </button>
                          <button type="button" className="sp-link" onClick={() => setPicked([])}>
                            Clear
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </>
              )}
            </section>
          )}

          {/* ---------- History ---------- */}
          {pid && tab === "history" &&
            (finished.length === 0 ? (
              <div className="sp-empty">
                <strong>No completed sprints yet</strong>
                <p>Finished sprints show up here.</p>
              </div>
            ) : (
              <ul className="sp-history">
                {finished.map((s) => {
                  const cnt = countsOf(s);
                  const pct = cnt.total ? Math.round((cnt.done / cnt.total) * 100) : 0;
                  return (
                    <li key={s.id}>
                      <details>
                        <summary>
                          <span className="sp-history-name">{s.name}</span>
                          <span className="sp-dates">
                            {fmtDate(s.start_date)} to {fmtDate(s.end_date)}
                          </span>
                          <span className="sx-chip is-done">
                            {cnt.done} of {cnt.total} done ({pct}%)
                          </span>
                          {s.unfinished_at_close > 0 && (
                            <span className="sx-chip is-late">Closed, not completed ({s.unfinished_at_close} unfinished)</span>
                          )}
                          {s.completed_by_name === "Auto-close" && <span className="sx-chip">Auto-closed</span>}
                        </summary>
                        {s.goal && <p className="sp-goal">{s.goal}</p>}
                        {renderProjects(s)}
                        {renderCaseList(s, false)}
                      </details>
                      {admin && (
                        <button type="button" className="sp-link sp-link-danger" onClick={() => remove(s)} disabled={busy}>
                          Delete
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            ))}
        </div>
      )}

      {admin && modal && (
        <SprintModal
          sprint={typeof modal === "string" ? null : modal}
          projectId={pid || ovProject}
          projects={devProjects}
          activeSprints={activeAll}
          onClose={() => setModal(null)}
          onSaved={refresh}
        />
      )}
      {admin && reporting && active && <WhatsAppModal sprint={active} onClose={() => setReporting(false)} />}
      {admin && completing && <CompleteModal sprint={completing} onClose={() => setCompleting(null)} onDone={refresh} />}
    </div>
  );
}