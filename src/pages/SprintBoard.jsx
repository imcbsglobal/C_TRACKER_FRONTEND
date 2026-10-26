import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { createComplaint, getComplaints, updateComplaint } from "../api/complaints";
import { getSprints } from "../api/sprints";
import { useProjects } from "../projects";
import {
  PRIORITIES,
  STATUSES,
  isAdminUser,
  isOverdue,
  priorityTone,
  statusTone,
  useConfig,
} from "../constants";
import "./ComplaintList.scss";
import "./Sprints.scss";
import "./MySprints.scss";

const svg = {
  viewBox: "0 0 24 24",
  width: 16,
  height: 16,
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
};

const IconDoc = () => (
  <svg {...svg}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <polyline points="14 3 14 8 19 8" />
    <line x1="9" y1="13" x2="15" y2="13" />
    <line x1="9" y1="17" x2="15" y2="17" />
  </svg>
);

const IconPlus = () => (
  <svg {...svg} width={18} height={18}>
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const IconComment = () => (
  <svg {...svg} width={14} height={14}>
    <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z" />
  </svg>
);

const toDate = (d) => {
  if (!d) return null;
  const s = String(d);
  const dt = new Date(s.length === 10 ? `${s}T00:00:00` : s);
  return Number.isNaN(dt.getTime()) ? null : dt;
};

const fmtDate = (d) => {
  const dt = toDate(d);
  if (!dt) return "—";
  return dt.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
};

const errText = (err, fallback) => {
  const d = err?.response?.data;
  if (!d || typeof d === "string") return fallback;
  if (d.detail) return d.detail;
  const first = Object.values(d)[0];
  return (Array.isArray(first) ? first[0] : first) || fallback;
};

const TABLE_HEADS = [
  "Task ID", "Task", "Created by", "Assignee", "Priority", "Status", "Due date", "Section", "Follow-ups",
];
const TABLE_WIDTHS = [8, 22, 11, 11, 8, 12, 9, 10, 9];
const tableCols = (
  <colgroup>
    {TABLE_WIDTHS.map((w, i) => <col key={i} style={{ width: `${w}%` }} />)}
  </colgroup>
);

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

export default function SprintBoard() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const fromProject = params.get("project") || "";
  const backTo = fromProject ? `/my-sprints?project=${fromProject}` : "/my-sprints";
  useConfig(); // statuses / priorities are managed by the admin
  const { projects } = useProjects();

  const [sprint, setSprint] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [missing, setMissing] = useState(false);
  const [who, setWho] = useState("all"); // "all" | "mine"
  // Admin sees the sprint's tasks as a board or as a table (developers only get the board).
  const isAdmin = isAdminUser();
  const [view, setView] = useState("board");
  const showTable = isAdmin && view === "table";
  const [dragId, setDragId] = useState(null);
  const [overCol, setOverCol] = useState(null);

  // quick add
  const [adding, setAdding] = useState(null); // status value whose add box is open
  const [title, setTitle] = useState("");
  const [projectPick, setProjectPick] = useState("");
  const [sectionPick, setSectionPick] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const [list, tasks] = await Promise.all([getSprints(), getComplaints({ sprint: id })]);
    const found = list.find((s) => String(s.id) === String(id));
    if (!found) {
      setMissing(true);
      return;
    }
    setSprint(found);
    setItems(tasks);
  };

  useEffect(() => {
    setLoading(true);
    setMissing(false);
    setError("");
    load()
      .catch(() => setError("Could not load this sprint."))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // The sprint's projects that this person belongs to, and their sections.
  const sprintProjects = useMemo(() => {
    if (!sprint) return [];
    const ids = new Set((sprint.projects || []).map(Number));
    return projects.filter((p) => ids.has(Number(p.id)));
  }, [sprint, projects]);

  const projectId =
    sprintProjects.some((p) => String(p.id) === String(projectPick))
      ? String(projectPick)
      : sprintProjects[0]
        ? String(sprintProjects[0].id)
        : "";
  const currentProject = sprintProjects.find((p) => String(p.id) === projectId);
  const addSections = currentProject?.sections || [];
  const defaultSection =
    (addSections.find((x) => x.is_mine) || addSections[0] || {}).id;
  const sectionId = addSections.some((x) => String(x.id) === String(sectionPick))
    ? String(sectionPick)
    : defaultSection
      ? String(defaultSection)
      : "";

  // Every section of the sprint's projects, for grouping cards inside a column.
  const sectionMap = useMemo(() => {
    const map = new Map();
    sprintProjects.forEach((p) => (p.sections || []).forEach((x) => map.set(x.id, x)));
    return map;
  }, [sprintProjects]);

  const locked = sprint?.status === "completed";

  const shown = useMemo(
    () => items.filter((c) => isAdmin || who === "all" || c.is_mine),
    [items, who, isAdmin]
  );

  const stats = useMemo(() => {
    const total = items.length;
    const done = items.filter((c) => c.is_closed).length;
    return { total, done, open: total - done, pct: total ? Math.round((done / total) * 100) : 0 };
  }, [items]);

  const mineCount = items.filter((c) => c.is_mine).length;

  // Table rows: newest task first
  const tableRows = useMemo(
    () => [...shown].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),
    [shown]
  );

  /* ---------- change status (drag a card, or use the card's menu) ---------- */

  const moveTask = async (taskId, status) => {
    const before = items.find((c) => c.id === taskId);
    if (!before || before.status === status) return;
    const closed = !!STATUSES.find((s) => s.value === status)?.is_closed;
    setError("");
    setItems((prev) =>
      prev.map((c) => (c.id === taskId ? { ...c, status, is_closed: closed } : c))
    );
    try {
      const updated = await updateComplaint(taskId, { status });
      setItems((prev) => prev.map((c) => (c.id === taskId ? updated : c)));
    } catch (err) {
      setItems((prev) => prev.map((c) => (c.id === taskId ? before : c)));
      setError(errText(err, "Could not move the task. It was put back."));
    }
  };

  const onDrop = (e, status) => {
    e.preventDefault();
    setOverCol(null);
    setDragId(null);
    const taskId = Number(e.dataTransfer.getData("text/plain"));
    moveTask(taskId, status);
  };

  /* ---------- add a task inside this sprint ---------- */

  const openAdd = (status) => {
    setAdding(status);
    setTitle("");
  };

  const closeAdd = () => {
    setAdding(null);
    setTitle("");
  };

  const formLink = (status) => {
    const qs = new URLSearchParams();
    qs.set("kind", "task");
    qs.set("sprint", String(sprint.id));
    if (status) qs.set("status", status);
    if (projectId) qs.set("project", projectId);
    if (sectionId) qs.set("section", sectionId);
    return `/new?${qs.toString()}`;
  };

  const quickAdd = async (e, status) => {
    e.preventDefault();
    const text = title.trim();
    if (!text || busy) return;
    if (!projectId) {
      setError("You are not in a project of this sprint.");
      return;
    }
    if (addSections.length > 0 && !sectionId) {
      setError("Choose a section first.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const created = await createComplaint({
        title: text,
        status,
        kind: "task",
        project: Number(projectId),
        sprint: sprint.id,
        section: sectionId ? Number(sectionId) : null,
      });
      setItems((prev) => [created, ...prev]);
      setTitle(""); // box stays open for the next one
    } catch (err) {
      setError(errText(err, "Could not create the task."));
    }
    setBusy(false);
  };

  /* ---------- render ---------- */

  if (loading) {
    return (
      <div className="cl sbd">
        <p className="ms-muted">Loading...</p>
      </div>
    );
  }

  if (missing || !sprint) {
    return (
      <div className="cl sbd">
        <Link to={backTo} className="sbd-back">← Back to sprints</Link>
        {error && <p className="error">{error}</p>}
        <div className="ms-empty">
          <strong>Sprint not found</strong>
          <p>This sprint is not available to you. It may have been removed, or you are not part of it.</p>
        </div>
      </div>
    );
  }

  const warn = sprint.closing_state === "closing_soon" || sprint.closing_state === "overdue";
  const leftText =
    sprint.status === "active" && sprint.days_left !== null && sprint.days_left !== undefined
      ? sprint.days_left < 0
        ? `${Math.abs(sprint.days_left)}d past end`
        : sprint.days_left === 0
          ? "Ends today"
          : `${sprint.days_left}d left`
      : null;

  const renderCard = (c) => {
    const pTone = priorityTone(c.priority);
    const followups = c.followups || [];
    return (
      <article
        key={c.id}
        className={`task-card ${dragId === c.id ? "is-dragging" : ""} ${c.urgent ? "is-urgent" : ""}`}
        draggable={!locked}
        onClick={(e) => {
          if (!e.target.closest("a") && !e.target.closest("select")) navigate(`/complaints/${c.id}`);
        }}
        onDragStart={(e) => {
          e.dataTransfer.setData("text/plain", String(c.id));
          e.dataTransfer.effectAllowed = "move";
          setTimeout(() => setDragId(c.id), 0);
        }}
        onDragEnd={() => {
          setOverCol(null);
          setDragId(null);
        }}
      >
        <div className="tc-top">
          <span className="tc-doc"><IconDoc /></span>
          <Link to={`/complaints/${c.id}`} className="task-title">{c.title}</Link>
          {c.urgent && <span className="urgent-light" title="New from admin" aria-label="New from admin" />}
        </div>

        <div className="tc-meta">
          <span className="tc-id">{c.task_number || `#${c.id}`}</span>
          <span
            className={`tc-prio tone-${pTone}`}
            title={`${PRIORITIES.find((p) => p.value === c.priority)?.label || c.priority} priority`}
          />
          {c.due_date && (
            <span className={`tc-date ${isOverdue(c) ? "overdue" : ""}`}>{fmtDate(c.due_date)}</span>
          )}
          {followups.length > 0 && (
            <span className="tc-stat" title={followups[0]?.note || "Follow-ups"}>
              <IconComment />
              {followups.length}
            </span>
          )}
          {c.assigned_to_name && (
            <span className="tc-avatar" title={c.assigned_to_name}>{c.assigned_to_name}</span>
          )}
        </div>

        {/* works on phones too, where dragging is not possible */}
        <select
          className={`sbd-status tone-${statusTone(c.status)}`}
          value={c.status}
          disabled={c.can_edit === false}
          aria-label={`Status of ${c.title}`}
          onChange={(e) => moveTask(c.id, e.target.value)}
          onClick={(e) => e.stopPropagation()}
        >
          {STATUSES.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </article>
    );
  };

  // A column's cards, split by section (your sections first), then tasks without one.
  const renderColumnBody = (col) => {
    if (sectionMap.size === 0) return col.map(renderCard);
    const known = [...sectionMap.values()].sort(
      (a, b) => Number(!!b.is_mine) - Number(!!a.is_mine)
    );
    const blocks = known
      .map((sec) => ({ sec, list: col.filter((c) => c.section === sec.id) }))
      .filter((b) => b.list.length > 0);
    const loose = col.filter((c) => !sectionMap.has(c.section));
    return (
      <>
        {blocks.map(({ sec, list }) => (
          <div key={sec.id} className="sb-section">
            <div className="sb-section-head">
              <span title={(sec.owner_names || []).length ? `Owners: ${sec.owner_names.join(", ")}` : undefined}>
                {sec.name}
              </span>
              {sec.is_mine && <em className="sb-mine">Yours</em>}
              <small>{list.length}</small>
            </div>
            {list.map(renderCard)}
          </div>
        ))}
        {loose.length > 0 && (
          <div className="sb-section">
            <div className="sb-section-head">
              <span>No section</span>
              <small>{loose.length}</small>
            </div>
            {loose.map(renderCard)}
          </div>
        )}
      </>
    );
  };

  const firstStatus = STATUSES[0]?.value;

  return (
    <div className="cl sbd">
      <div className="sbd-head">
        <Link to={backTo} className="sbd-back">← Back to sprints</Link>

        <div className="sbd-title-row">
          <h1>{sprint.name}</h1>
          <span className={`ms-tag is-${sprint.status}`}>
            {sprint.status === "active" ? "Active" : sprint.status === "planned" ? "Planned" : "Completed"}
          </span>
          {leftText && <span className={`ms-left ${warn ? "is-late" : ""}`}>{leftText}</span>}
        </div>

        <p className="sbd-sub">
          {fmtDate(sprint.start_date)} to {fmtDate(sprint.end_date)}
          {(sprint.project_names || []).length > 0 && <> · {sprint.project_names.join(", ")}</>}
        </p>

        {sprint.goal && <p className="sbd-goal"><b>Goal</b>{sprint.goal}</p>}

        <div className="sbd-stats">
          <span className="ms-bar" aria-hidden="true">
            <i style={{ width: `${stats.pct}%` }} />
          </span>
          <span><b>{stats.done}</b> of {plural(stats.total, "task")} done</span>
          <span>{stats.open} open</span>

          {isAdmin ? (
            <div className="sbd-seg" role="tablist" aria-label="View">
              <button
                type="button"
                role="tab"
                aria-selected={view === "board"}
                className={view === "board" ? "is-on" : ""}
                onClick={() => setView("board")}
              >
                Board view
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={view === "table"}
                className={view === "table" ? "is-on" : ""}
                onClick={() => setView("table")}
              >
                Table view
              </button>
            </div>
          ) : (
            <div className="sbd-seg" role="group" aria-label="Show tasks">
              <button type="button" className={who === "all" ? "is-on" : ""} onClick={() => setWho("all")}>
                All tasks
              </button>
              <button type="button" className={who === "mine" ? "is-on" : ""} onClick={() => setWho("mine")}>
                My tasks ({mineCount})
              </button>
            </div>
          )}
        </div>

        {warn && stats.open > 0 && (
          <p className="sbd-warn">
            {sprint.closing_state === "overdue" ? "Closing but not completed: " : "Closing soon: "}
            {stats.open} not done
          </p>
        )}
        {locked && <p className="sbd-warn is-info">This sprint is completed. You can't add tasks to it.</p>}
      </div>

      {error && <p className="error">{error}</p>}

      {showTable ? (
        <div className="table-view">
          <div className="thead-fixed" aria-hidden="true">
            <table className="table">
              {tableCols}
              <thead>
                <tr>
                  {TABLE_HEADS.map((h) => <th key={h}>{h}</th>)}
                </tr>
              </thead>
            </table>
          </div>
          <div className="panel-body">
            <div className="table-wrap">
              <table className="table">
                {tableCols}
                <tbody>
                  {tableRows.map((c) => {
                    const followups = c.followups || [];
                    const latest = followups[0];
                    return (
                      <tr key={c.id} className={c.urgent ? "row-urgent" : ""}>
                        <td data-label="Task ID" className="cell-id">{c.task_number || `#${c.id}`}</td>
                        <td data-label="Task" className="cell-title">
                          {c.urgent && <span className="urgent-light" title="New from admin" aria-label="New from admin" />}
                          <Link to={`/complaints/${c.id}`}>{c.title}</Link>
                        </td>
                        <td data-label="Created by" className="muted">{c.created_by_name || "—"}</td>
                        <td data-label="Assignee">{c.assigned_to_name || "Unassigned"}</td>
                        <td data-label="Priority">
                          <span className={`pill tone-${priorityTone(c.priority)}`}>
                            {PRIORITIES.find((p) => p.value === c.priority)?.label || c.priority}
                          </span>
                        </td>
                        <td data-label="Status">
                          <select
                            className={`sbd-status tone-${statusTone(c.status)}`}
                            value={c.status}
                            disabled={c.can_edit === false}
                            aria-label={`Status of ${c.title}`}
                            onChange={(e) => moveTask(c.id, e.target.value)}
                          >
                            {STATUSES.map((st) => (
                              <option key={st.value} value={st.value}>{st.label}</option>
                            ))}
                          </select>
                        </td>
                        <td data-label="Due date">
                          <span className={isOverdue(c) ? "overdue" : ""}>{fmtDate(c.due_date)}</span>
                        </td>
                        <td data-label="Section" className="muted">
                          {sectionMap.get(c.section)?.name || "—"}
                        </td>
                        <td data-label="Follow-ups">
                          {latest ? (
                            <span className="fu-cell" title={latest.note}>
                              <span className="fu-count">{followups.length}</span>
                              <span className="fu-text">
                                {latest.created_by_name ? <strong>{latest.created_by_name}: </strong> : null}
                                {latest.note}
                              </span>
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {tableRows.length === 0 && (
                    <tr>
                      <td colSpan="9" className="empty">No tasks in this sprint yet</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
      <div className="board">
        {STATUSES.map((s) => {
          const col = shown.filter((c) => c.status === s.value);
          const dragging = items.find((c) => c.id === dragId);
          const showSlot = overCol === s.value && dragging && dragging.status !== s.value;
          const tone = statusTone(s.value);
          const canAddHere = !locked;

          return (
            <section
              key={s.value}
              className={`col tone-${tone} ${overCol === s.value ? "is-over" : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                if (overCol !== s.value) setOverCol(s.value);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget)) setOverCol(null);
              }}
              onDrop={(e) => onDrop(e, s.value)}
            >
              <div className="col-head">
                <div className="col-title">
                  <span className="col-dot" />
                  <span className="col-name">{s.label}</span>
                </div>
                <span className="col-count">{col.length}</span>
                <span className="col-spacer" />
                {canAddHere && (
                  <button
                    type="button"
                    className="col-add"
                    aria-label={`Add a task to ${sprint.name} in ${s.label}`}
                    title={`Add a task to ${sprint.name}`}
                    onClick={() => openAdd(s.value)}
                  >
                    <IconPlus />
                  </button>
                )}
              </div>

              <div className="col-body">
                {adding === s.value && canAddHere && (
                  <form className="qa sbd-qa" onSubmit={(e) => quickAdd(e, s.value)}>
                    <input
                      className="qa-input"
                      autoFocus
                      value={title}
                      placeholder={`Task for ${sprint.name}…`}
                      aria-label={`New task in ${s.label}`}
                      disabled={busy}
                      onChange={(e) => setTitle(e.target.value)}
                      onKeyDown={(e) => e.key === "Escape" && closeAdd()}
                    />

                    {(sprintProjects.length > 1 || addSections.length > 0) && (
                      <div className="sbd-qa-pick">
                        {sprintProjects.length > 1 && (
                          <select
                            value={projectId}
                            onChange={(e) => {
                              setProjectPick(e.target.value);
                              setSectionPick("");
                            }}
                            aria-label="Project"
                          >
                            {sprintProjects.map((p) => (
                              <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                          </select>
                        )}
                        {addSections.length > 0 && (
                          <select
                            value={sectionId}
                            onChange={(e) => setSectionPick(e.target.value)}
                            aria-label="Section"
                          >
                            {addSections.map((x) => (
                              <option key={x.id} value={x.id}>{x.name}</option>
                            ))}
                          </select>
                        )}
                      </div>
                    )}

                    <div className="qa-row">
                      <span className="qa-hint">Enter to add · Esc to close</span>
                      <span className="sbd-qa-actions">
                        <Link to={formLink(s.value)} className="qa-full">Full form</Link>
                        <button type="button" className="sbd-qa-close" onClick={closeAdd}>Close</button>
                      </span>
                    </div>
                  </form>
                )}

                {renderColumnBody(col)}

                {showSlot && <div className="drop-slot">Drop here</div>}
                {col.length === 0 && !showSlot && adding !== s.value && (
                  <p className="col-empty">
                    {s.value === firstStatus && canAddHere ? "No tasks yet. Use + to add one." : "No tasks"}
                  </p>
                )}
              </div>
            </section>
          );
        })}
      </div>
      )}
    </div>
  );
}