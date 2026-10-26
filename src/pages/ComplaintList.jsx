import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  createComplaint,
  deleteComplaint,
  getComplaints,
  getTeam,
  updateComplaint,
} from "../api/complaints";
import { getSprints } from "../api/sprints";
import EditComplaintModal from "../components/EditComplaintModal";
import HistoryDrawer from "../components/HistoryDrawer";
import CustomizeModal from "../components/CustomizeModal";
import { useProjects } from "../projects";
import { useAccess } from "../auth/access";
import {
  STATUSES,
  PRIORITIES,
  isAdminUser,
  isOverdue,
  priorityTone,
  statusTone,
  useConfig,
} from "../constants";
import "./ComplaintList.scss";
import "./Urgent.scss";
import "./Sprints.scss";

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

const icons = {
  edit: (
    <svg {...svg}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  ),
  trash: (
    <svg {...svg}>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  ),
  history: (
    <svg {...svg} width={14} height={14}>
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 15.5 14" />
    </svg>
  ),
  table: (
    <svg {...svg} width={17} height={17}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <line x1="9" y1="10" x2="9" y2="20" />
    </svg>
  ),
  board: (
    <svg {...svg} width={17} height={17}>
      <circle cx="12" cy="5" r="2" />
      <circle cx="5" cy="19" r="2" />
      <circle cx="19" cy="19" r="2" />
      <path d="M12 7v4M12 11H5v6M12 11h7v6" />
    </svg>
  ),
  doc: (
    <svg {...svg} width={16} height={16}>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <polyline points="14 3 14 8 19 8" />
      <line x1="9" y1="13" x2="15" y2="13" />
      <line x1="9" y1="17" x2="15" y2="17" />
    </svg>
  ),
  caret: (
    <svg {...svg} width={14} height={14}>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  ),
  plus: (
    <svg {...svg} width={18} height={18}>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  ),
  calendar: (
    <svg {...svg} width={17} height={17}>
      <rect x="3" y="5" width="18" height="16" rx="2.5" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <line x1="8" y1="3" x2="8" y2="7" />
      <line x1="16" y1="3" x2="16" y2="7" />
    </svg>
  ),
  flag: (
    <svg {...svg} width={18} height={18}>
      <path d="M5 21V4M5 4h11l-2 4 2 4H5" />
    </svg>
  ),
  origin: (
    <svg {...svg} width={15} height={15}>
      <path d="M6 21V4M6 4h10l-1.5 3.5L16 11H6" />
    </svg>
  ),
  priority: (
    <svg {...svg} width={15} height={15}>
      <path d="M12 3l9 9-9 9-9-9z" />
    </svg>
  ),
  handler: (
    <svg {...svg} width={15} height={15}>
      <circle cx="6" cy="6" r="2.2" />
      <circle cx="18" cy="18" r="2.2" />
      <path d="M8 6h6a3 3 0 0 1 0 6h-4a3 3 0 0 0 0 6h6" />
    </svg>
  ),
  process: (
    <svg {...svg} width={15} height={15}>
      <circle cx="7" cy="7" r="3" />
      <circle cx="17" cy="17" r="3" />
      <path d="M17 4v6M14 7h6" />
    </svg>
  ),
  date: (
    <svg {...svg} width={15} height={15}>
      <rect x="4" y="5" width="16" height="15" rx="2" />
      <line x1="4" y1="10" x2="20" y2="10" />
      <line x1="9" y1="3" x2="9" y2="7" />
      <line x1="15" y1="3" x2="15" y2="7" />
    </svg>
  ),
  comment: (
    <svg {...svg} width={14} height={14}>
      <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z" />
    </svg>
  ),
  settings: (
    <svg {...svg} width={16} height={16}>
      <line x1="4" y1="7" x2="20" y2="7" />
      <line x1="4" y1="17" x2="20" y2="17" />
      <circle cx="9" cy="7" r="2.3" fill="#fff" />
      <circle cx="15" cy="17" r="2.3" fill="#fff" />
    </svg>
  ),
  clock: (
    <svg {...svg} width={14} height={14}>
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 15.5 14" />
    </svg>
  ),
};

const timeAgo = (iso) => {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const mins = Math.max(0, Math.round((Date.now() - t) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}hr ago`;
  const days = Math.round(hrs / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
};

// ---------- board sorting (inside each column) ----------
const SORT_OPTIONS = [
  { value: "newest", label: "Newest first", short: "Sort" },
  { value: "updated", label: "Recently updated" },
  { value: "due", label: "Due date" },
  { value: "priority", label: "Priority" },
];
// Higher position in the admin's priority list = more important
const prioRank = (value) => PRIORITIES.findIndex((p) => p.value === value);
const SORTERS = {
  newest: (a, b) => new Date(b.created_at) - new Date(a.created_at),
  updated: (a, b) =>
    new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at),
  due: (a, b) => (a.due_date || "9999-12-31").localeCompare(b.due_date || "9999-12-31"),
  priority: (a, b) => prioRank(b.priority) - prioRank(a.priority),
};

const COL_WIDTHS = [7, 14, 9, 10, 8, 9, 10, 8, 10, 7, 8];
const HEADS = [
  "Task ID", "Task", "Created by", "Assignee", "Priority", "Status",
  "Due date", "Category", "Follow-ups", "Log", "Actions",
];
const colgroup = (
  <colgroup>
    {COL_WIDTHS.map((w, i) => <col key={i} style={{ width: `${w}%` }} />)}
  </colgroup>
);

// Custom dropdown (native <select> popups use the OS blue highlight and can't be themed)
function Pick({ value, options, onChange, className = "", label, caret = false }) {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState(null);
  const btnRef = useRef(null);
  const menuRef = useRef(null);
  const current = options.find((o) => String(o.value) === String(value));

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (btnRef.current?.contains(e.target) || menuRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") {
        setOpen(false);
        btnRef.current?.focus();
      }
    };
    const onMove = (e) => {
      if (menuRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
    };
  }, [open]);

  const toggle = () => {
    if (!open && btnRef.current) setRect(btnRef.current.getBoundingClientRect());
    setOpen((o) => !o);
  };

  const menuStyle = rect && {
    left: Math.min(rect.left, window.innerWidth - 200),
    minWidth: Math.max(rect.width, 160),
    ...(rect.bottom + 280 > window.innerHeight
      ? { bottom: window.innerHeight - rect.top + 4 }
      : { top: rect.bottom + 4 }),
  };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className={`pick ${className}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        onClick={toggle}
      >
        <span className="pick-text">{current ? current.short || current.label : ""}</span>
        {caret && <span className="pick-caret">{icons.caret}</span>}
      </button>
      {open &&
        rect &&
        createPortal(
          <ul className="pick-menu" role="listbox" style={menuStyle} ref={menuRef}>
            {options.map((o) => (
              <li
                key={String(o.value)}
                role="option"
                aria-selected={String(o.value) === String(value)}
                className={String(o.value) === String(value) ? "on" : ""}
                onClick={() => {
                  setOpen(false);
                  onChange(o.value);
                }}
              >
                {o.label}
              </li>
            ))}
          </ul>,
          document.body
        )}
    </>
  );
}

// Local calendar day ("2026-10-19") of a date or ISO string.
const localDay = (d) => {
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return "";
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
};
const nameInitials = (n = "") =>
  n.trim().split(/\s+/).slice(0, 2).map((w) => w.charAt(0).toUpperCase()).join("") || "?";

const KIND_LABELS = { complaint: "Complaint", task: "Task", bug: "Bug" };
const KIND_COLORS = {
  complaint: { bg: "#fdecd8", fg: "#9a5a12" },
  task: { bg: "#e4ede0", fg: "#3f6839" },
  bug: { bg: "#fde2e2", fg: "#a63232" },
};

const fmtDate = (d) => {
  if (!d) return "—";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
};

export default function ComplaintList() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const q = params.get("q") || "";

  const [items, setItems] = useState([]);
  const [team, setTeam] = useState([]);
  // Table is the default view everywhere. Inside a project the Board / Table switch lets the user change it.
  const [viewPick, setViewPick] = useState("table");
  const [fStatus, setFStatus] = useState("all");
  const [fAssignee, setFAssignee] = useState("all");
  const [fPriority, setFPriority] = useState("all");
  const [fCreator, setFCreator] = useState("all");
  const [dFrom, setDFrom] = useState("");
  const [dTo, setDTo] = useState("");
  const [groupBy, setGroupBy] = useState("none");
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(null);
  const [logId, setLogId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [overCol, setOverCol] = useState(null);
  const [dragId, setDragId] = useState(null);
  const [sortBy, setSortBy] = useState("newest");
  const [adding, setAdding] = useState(null); // status value whose quick-add box is open
  const [newTitle, setNewTitle] = useState("");
  const [addBusy, setAddBusy] = useState(false);
  const [slot, setSlot] = useState(null);
  const [customizing, setCustomizing] = useState(false);
  const [fKind, setFKind] = useState("all");
  const [fDay, setFDay] = useState("today"); // All tasks page: "today" (added today) or "all"
  const [fType, setFType] = useState("all"); // All tasks page: "all" | "support" | "development"
  const [fSprint, setFSprint] = useState("all");
  const [sprints, setSprints] = useState([]);
  const [boardSprints, setBoardSprints] = useState([]); // active + planned sprints of the development project on screen
  const [sprintPick, setSprintPick] = useState(""); // "" = the active sprint, a sprint id, or "backlog"
  // Big composer at the top + folded filters
  const [moreOpen, setMoreOpen] = useState(false);
  const [cTitle, setCTitle] = useState("");
  const [cStatus, setCStatus] = useState("");
  const [cPrio, setCPrio] = useState("");
  const [cAssignee, setCAssignee] = useState("");
  const [cBusy, setCBusy] = useState(false);
  const isAdmin = isAdminUser();
  const { access, isBoth } = useAccess();
  // Support works with complaints, developers with tasks.
  const noun = access === "support" ? "complaint" : "task";
  const Noun = noun.charAt(0).toUpperCase() + noun.slice(1);
  const heads = HEADS.map((h) => (h === "Task ID" ? `${Noun} ID` : h === "Task" ? Noun : h));

  // Small type badge, only where complaints and tasks are mixed (admin / both).
  const kindBadge = (c) =>
    isBoth && c.kind ? (
      <span
        style={{
          padding: "1px 7px",
          borderRadius: 999,
          background: (KIND_COLORS[c.kind] || KIND_COLORS.task).bg,
          color: (KIND_COLORS[c.kind] || KIND_COLORS.task).fg,
          fontSize: 11,
          fontWeight: 600,
          whiteSpace: "nowrap",
        }}
      >
        {KIND_LABELS[c.kind] || c.kind}
      </span>
    ) : null;

  // Which sprint (and section) a task is in (nothing shown for the backlog).
  const sprintChip = (c) =>
    c.sprint_name || c.section_name ? (
      <span
        title={[c.section_name && `Section: ${c.section_name}`, c.sprint_name && `Sprint: ${c.sprint_name}`]
          .filter(Boolean)
          .join(" · ")}
        style={{
          maxWidth: 160,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          padding: "1px 7px",
          borderRadius: 999,
          background: "#eef4ec",
          color: "#3f6338",
          fontSize: 11,
          fontWeight: 600,
        }}
      >
        {[c.section_name, c.sprint_name].filter(Boolean).join(" · ")}
      </span>
    ) : null;

  // Inside a sprint the sprint name is already in the header, so cards only show the section.
  const sectionChip = (c) =>
    c.section_name ? (
      <span
        title={`Section: ${c.section_name}`}
        style={{
          maxWidth: 140,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          padding: "1px 7px",
          borderRadius: 999,
          background: "#eef4ec",
          color: "#3f6338",
          fontSize: 11,
          fontWeight: 600,
        }}
      >
        {c.section_name}
      </span>
    ) : null;

  // Re-render when the admin's statuses / priorities / categories load or change.
  useConfig();
  const { projects, selected: sidebarProject } = useProjects();
  // Project dropdown in the filter bar only filters this table (local state).
  // A project picked in the sidebar still scopes the page as before.
  const [pFilter, setPFilter] = useState("");
  const fProject = sidebarProject || pFilter;
  // "All tasks" (no project picked) is always the table; inside a project the user's pick
  // applies (table by default, board on request).
  const view = "table"; // table only: no board view

  // Sprint filter: only for a support project (support cases are the ones in sprints).
  const fProjectObj = projects.find((p) => String(p.id) === fProject);
  const isSupportProject = fProjectObj?.kind === "support";
  useEffect(() => {
    setFSprint("all");
    if (!isSupportProject) {
      setSprints([]);
      return;
    }
    getSprints({ project: fProject })
      .then(setSprints)
      .catch(() => setSprints([]));
  }, [fProject, isSupportProject]);

  // A development project's board works like the developer's sprint page: a sprint strip on
  // top and the board below it with only that sprint's tasks. New tasks are added right there.
  const isDevProject = fProjectObj?.kind === "development" && access !== "support";
  useEffect(() => {
    setSprintPick("");
    if (!isDevProject) {
      setBoardSprints([]);
      return;
    }
    getSprints({ project: fProject })
      .then((list) => setBoardSprints(list.filter((s) => s.status !== "completed")))
      .catch(() => setBoardSprints([]));
  }, [fProject, isDevProject]);
  const sprintOrder = useMemo(
    () =>
      [...boardSprints].sort(
        (a, b) =>
          (a.status === "active" ? 0 : 1) - (b.status === "active" ? 0 : 1) ||
          (a.start_date || "9999").localeCompare(b.start_date || "9999")
      ),
    [boardSprints]
  );
  const sprintView = view === "board" && isDevProject && boardSprints.length > 0;
  // The sprint on screen: the one picked, else the active one (else the earliest planned).
  // null means the Backlog tab.
  const focusSprint =
    sprintView && sprintPick !== "backlog"
      ? sprintOrder.find((s) => String(s.id) === sprintPick) || sprintOrder[0] || null
      : null;
  const focusId = focusSprint ? focusSprint.id : null;

  // Numbers for the sprint strip (this project's tasks in that sprint)
  const sprintStats = useMemo(() => {
    if (!focusId) return null;
    const list = items.filter(
      (c) => c.sprint === focusId && (!fProject || String(c.project) === fProject)
    );
    const done = list.filter((c) => c.is_closed).length;
    return {
      total: list.length,
      done,
      open: list.length - done,
      pct: list.length ? Math.round((done / list.length) * 100) : 0,
    };
  }, [items, focusId, fProject]);

  // View switch is shown in the layout header, next to "New complaint".
  useEffect(() => {
    setSlot(document.getElementById("lay-head-slot"));
  }, []);

  useEffect(() => {
    Promise.all([getComplaints(), getTeam()])
      .then(([c, t]) => {
        setItems(c);
        setTeam(t);
      })
      .catch(() => setError("Could not load data. Is the backend running?"))
      .finally(() => setLoading(false));
  }, []);

  const patch = async (id, data) => {
    const updated = await updateComplaint(id, data);
    setItems((prev) => prev.map((c) => (c.id === id ? updated : c)));
  };

  const onSaved = (updated) => {
    setItems((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
  };

  const remove = async (c) => {
    if (!window.confirm(`Delete "${c.title}"?`)) return;
    try {
      await deleteComplaint(c.id);
      setItems((prev) => prev.filter((x) => x.id !== c.id));
      if (logId === c.id) setLogId(null);
    } catch {
      setError("Could not delete the task.");
    }
  };

  const todayIso = localDay(new Date());

  const shown = useMemo(
    () =>
      items.filter(
        (c) =>
          (!fProject || String(c.project) === fProject) &&
          (fProject || fDay === "all" || localDay(c.created_at) === todayIso) &&
          (fType === "all" ||
            (projects.find((p) => p.id === c.project)?.kind || "development") === fType) &&
          (!sprintView ||
            (focusId
              ? c.sprint === focusId
              : !sprintOrder.some((sp) => sp.id === c.sprint))) &&
          (fKind === "all" || c.kind === fKind) &&
          (fStatus === "all" || c.status === fStatus) &&
          (fPriority === "all" || c.priority === fPriority) &&
          (fAssignee === "all" ||
            (fAssignee === "none" ? !c.assigned_to : String(c.assigned_to) === fAssignee)) &&
          (fCreator === "all" || (c.created_by_name || "Unknown") === fCreator) &&
          (fSprint === "all" || (fSprint === "none" ? !c.sprint : String(c.sprint) === fSprint)) &&
          (!dFrom || (c.due_date && c.due_date >= dFrom)) &&
          (!dTo || (c.due_date && c.due_date <= dTo)) &&
          (c.title + " " + (c.task_number || "") + " " + (c.customer || "") + " " + (c.created_by_name || ""))
            .toLowerCase()
            .includes(q.toLowerCase())
      ),
    [items, q, fProject, fDay, fType, projects, todayIso, sprintView, focusId, sprintOrder, fKind, fStatus, fPriority, fAssignee, fCreator, fSprint, dFrom, dTo]
  );

  // People who belong to the project being viewed (or to any of the viewer's projects
  // when "All projects" is chosen). Used by every person dropdown on this screen so a
  // project never lists people who are not in it.
  const peopleHere = useMemo(() => {
    if (projects.length === 0) return team;
    const scope = fProject ? projects.filter((p) => String(p.id) === fProject) : projects;
    const ids = new Set(scope.flatMap((p) => (p.members || []).map(Number)));
    return team.filter((t) => ids.has(t.id));
  }, [team, projects, fProject]);

  // Same idea for one task: members of that task's own project (the person already
  // on the task stays visible so the dropdown never shows a blank).
  const peopleFor = (c) => {
    const proj = projects.find((p) => p.id === c.project);
    if (!proj) return team;
    const ids = (proj.members || []).map(Number);
    return team.filter((t) => ids.includes(t.id) || t.id === c.assigned_to);
  };

  // Creators only from the project being viewed.
  const creators = useMemo(
    () => [
      ...new Set(
        items
          .filter((c) => !fProject || String(c.project) === fProject)
          .map((c) => c.created_by_name || "Unknown")
      ),
    ].sort(),
    [items, fProject]
  );

  // Switching project: drop a person / creator filter that does not exist in it.
  useEffect(() => {
    if (!team.length || !projects.length) return;
    if (fAssignee !== "all" && fAssignee !== "none" && !peopleHere.some((t) => String(t.id) === fAssignee)) {
      setFAssignee("all");
    }
    if (fCreator !== "all" && !creators.includes(fCreator)) {
      setFCreator("all");
    }
    // Composer assignee must belong to the project on screen too.
    if (cAssignee && !peopleHere.some((t) => String(t.id) === cAssignee)) {
      setCAssignee("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fProject, peopleHere, creators]);

  const groups = useMemo(() => {
    if (groupBy === "none") return [{ key: "all", label: "", rows: shown }];
    const map = new Map();
    shown.forEach((c) => {
      let key, label;
      if (groupBy === "assignee") {
        key = c.assigned_to || "none";
        label = c.assigned_to_name || "Unassigned";
      } else if (groupBy === "creator") {
        label = c.created_by_name || "Unknown";
        key = label;
      } else if (groupBy === "status") {
        key = c.status;
        label = STATUSES.find((s) => s.value === c.status)?.label || c.status;
      } else {
        key = c.priority;
        label = PRIORITIES.find((p) => p.value === c.priority)?.label || c.priority;
      }
      if (!map.has(key)) map.set(key, { key, label, rows: [] });
      map.get(key).rows.push(c);
    });
    return [...map.values()];
  }, [shown, groupBy]);

  const activeCount =
    (q !== "" ? 1 : 0) +
    (fType !== "all" ? 1 : 0) +
    (fStatus !== "all" ? 1 : 0) +
    (fKind !== "all" ? 1 : 0) +
    (fAssignee !== "all" ? 1 : 0) +
    (fPriority !== "all" ? 1 : 0) +
    (fCreator !== "all" ? 1 : 0) +
    (fSprint !== "all" ? 1 : 0) +
    (dFrom || dTo ? 1 : 0);

  // Filters that live in the folded "More filters" row
  const moreCount =
    (fKind !== "all" ? 1 : 0) +
    (fPriority !== "all" ? 1 : 0) +
    (fCreator !== "all" ? 1 : 0) +
    (fSprint !== "all" ? 1 : 0) +
    (dFrom || dTo ? 1 : 0);

  const clearFilters = () => {
    setParams({}, { replace: true });
    setPFilter("");
    setFType("all");
    setFDay("today");
    setFStatus("all");
    setFKind("all");
    setFAssignee("all");
    setFPriority("all");
    setFCreator("all");
    setFSprint("all");
    setDFrom("");
    setDTo("");
  };

  const assigneeSelect = (c) => (
    <Pick
      className="cell-select"
      value={c.assigned_to ? String(c.assigned_to) : ""}
      onChange={(v) => patch(c.id, { assigned_to: v || null })}
      label="Assignee"
      options={[
        { value: "", label: "Unassigned" },
        ...peopleFor(c).map((t) => ({ value: String(t.id), label: t.full_name })),
      ]}
    />
  );

  const followupCell = (c) => {
    const list = c.followups || [];
    const latest = list[0];
    const meta = latest
      ? `${latest.created_by_name ? latest.created_by_name + " • " : ""}${new Date(latest.created_at).toLocaleString()}`
      : "";
    return (
      <button
        type="button"
        className="fu-cell"
        title={latest ? `${latest.note}\n${meta}` : "Add a follow-up"}
        onClick={() => setEditing(c)}
      >
        {latest ? (
          <>
            <span className="fu-count">{list.length}</span>
            <span className="fu-text">
              {latest.created_by_name ? <strong>{latest.created_by_name}: </strong> : null}
              {latest.note}
            </span>
          </>
        ) : (
          <span className="fu-add">+ Add</span>
        )}
      </button>
    );
  };

  // Move a card to another column. The card jumps immediately; if the server
  // refuses, it snaps back and an error is shown.
  const moveTask = async (id, status) => {
    const before = items.find((c) => c.id === id);
    if (!before || before.status === status) return;
    setError("");
    setItems((prev) => prev.map((c) => (c.id === id ? { ...c, status } : c)));
    try {
      const updated = await updateComplaint(id, { status });
      setItems((prev) => prev.map((c) => (c.id === id ? updated : c)));
    } catch {
      setItems((prev) => prev.map((c) => (c.id === id ? before : c)));
      setError("Could not move the task. It was put back.");
    }
  };

  const onDrop = (e, status) => {
    e.preventDefault();
    setOverCol(null);
    setDragId(null);
    const id = Number(e.dataTransfer.getData("text/plain"));
    moveTask(id, status);
  };

  // Complaints need a description + images, so "+" opens the full complaint form
  // (status / project prefilled). Tasks and bugs keep the quick-add box.
  const newKind = () => {
    const picked = fProject ? projects.find((x) => String(x.id) === fProject) : null;
    const pickedKind = picked ? picked.kind || "development" : null;
    if (access === "support" || pickedKind === "support") return "complaint";
    if (pickedKind === "development") return fKind === "bug" ? "bug" : "task";
    return fKind !== "all" ? fKind : undefined;
  };

  const formLink = (status, extra = {}) => {
    const qs = new URLSearchParams();
    const k = newKind();
    if (k) qs.set("kind", k);
    if (status) qs.set("status", status);
    if (fProject) qs.set("project", fProject);
    Object.entries(extra).forEach(([key, value]) => value && qs.set(key, value));
    return `/new?${qs.toString()}`;
  };

  // Column "+": open the inline quick-add box (complaints still use the full form).
  // Inside a sprint the new task is created in that sprint (see createQuick).
  const openAdd = (status) => {
    if (newKind() === "complaint") {
      navigate(formLink(status));
      return;
    }
    setAdding(status);
    setNewTitle("");
  };

  const closeAdd = () => {
    setAdding(null);
    setNewTitle("");
  };

  // One place that creates a task / complaint / bug. Returns true when it worked.
  const createQuick = async (title, status, extra = {}) => {
    // The type follows the project being viewed: a support project gets complaints,
    // a development project gets tasks (or bugs). With no project picked, the type
    // filter decides.
    const picked = fProject ? projects.find((x) => String(x.id) === fProject) : null;
    const pickedKind = picked ? picked.kind || "development" : null;
    let kind;
    if (access === "support" || pickedKind === "support") kind = "complaint";
    else if (pickedKind === "development") kind = fKind === "bug" ? "bug" : "task";
    else kind = fKind !== "all" ? fKind : undefined;
    // The project must match the type: complaints -> support, tasks/bugs -> development.
    const wanted = (kind || "task") === "complaint" ? "support" : "development";
    const options = projects.filter((x) => (x.kind || "development") === wanted);
    const projectId =
      picked && pickedKind === wanted
        ? picked.id
        : options.length === 1
          ? options[0].id
          : null;
    if (!projectId) {
      setError("Pick a project in the filter bar first.");
      return false;
    }
    setError("");
    try {
      const created = await createComplaint({
        title,
        status,
        ...(kind ? { kind } : {}),
        ...(focusSprint ? { sprint: focusSprint.id } : {}),
        ...extra,
        project: projectId,
      });
      setItems((prev) => [created, ...prev]);
      return true;
    } catch {
      setError(`Could not create the ${noun}.`);
      return false;
    }
  };

  // Column quick add: type a title, press Enter, the task is created in that column.
  const quickAdd = async (e, status) => {
    e.preventDefault();
    const title = newTitle.trim();
    if (!title || addBusy) return;
    setAddBusy(true);
    if (await createQuick(title, status)) setNewTitle(""); // box stays open for the next one
    setAddBusy(false);
  };

  // The big composer at the top of the page
  const composeStatus = cStatus || STATUSES[0]?.value;
  const composeAdd = async (e) => {
    e.preventDefault();
    const title = cTitle.trim();
    if (!title || cBusy) return;
    if (newKind() === "complaint") {
      navigate(formLink(composeStatus, { title }));
      return;
    }
    setCBusy(true);
    const ok = await createQuick(title, composeStatus, {
      ...(cPrio ? { priority: cPrio } : {}),
      ...(cAssignee ? { assigned_to: Number(cAssignee) } : {}),
    });
    if (ok) setCTitle("");
    setCBusy(false);
  };

  const setFilterClass = (value) => (value !== "all" ? "is-set" : "");
  const logTask = items.find((c) => c.id === logId);

  const VIEW_SWITCH = (
    <div className="view-switch" role="tablist" aria-label="View">
      <button
        type="button"
        role="tab"
        aria-selected={view === "board"}
        className={view === "board" ? "on" : ""}
        onClick={() => setViewPick("board")}
      >
        {icons.board}
        Board view
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={view === "table"}
        className={view === "table" ? "on" : ""}
        onClick={() => setViewPick("table")}
      >
        {icons.table}
        Table view
      </button>
    </div>
  );

  return (
    <div className="cl">
      {error && <p className="error">{error}</p>}

      {/* ---------- Compact sprint strip ---------- */}
      {sprintView && (
        <div className="sbh">
          <div className="sbh-title">
            <h2 title={focusSprint ? focusSprint.name : "Backlog"}>
              {focusSprint ? focusSprint.name : "Backlog"}
            </h2>
            <span className={`sbh-tag ${focusSprint ? `is-${focusSprint.status}` : ""}`}>
              {focusSprint ? (focusSprint.status === "active" ? "Active" : "Planned") : "No sprint"}
            </span>
            {focusSprint &&
              focusSprint.status === "active" &&
              focusSprint.days_left !== null &&
              focusSprint.days_left !== undefined && (
                <span
                  className={`sbh-days ${
                    focusSprint.closing_state === "closing_soon" || focusSprint.closing_state === "overdue"
                      ? "is-late"
                      : ""
                  }`}
                >
                  {focusSprint.days_left < 0
                    ? `${Math.abs(focusSprint.days_left)}d past end`
                    : focusSprint.days_left === 0
                      ? "Ends today"
                      : `${focusSprint.days_left}d left`}
                </span>
              )}
          </div>

          {sprintStats && (
            <div
              className="sbh-stats"
              title={focusSprint ? `${fmtDate(focusSprint.start_date)} to ${fmtDate(focusSprint.end_date)}` : ""}
            >
              <span
                className="sbh-bar"
                role="progressbar"
                aria-valuenow={sprintStats.pct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Sprint progress"
              >
                <i style={{ width: `${sprintStats.pct}%` }} />
              </span>
              <span>
                <b>{sprintStats.done}</b>/{sprintStats.total} done
              </span>
            </div>
          )}

          {isAdmin && focusSprint && (focusSprint.member_names || []).length > 0 && (
            <p className="sbh-people" title={(focusSprint.member_names || []).join(", ")}>
              {(focusSprint.member_names || []).join(", ")}
            </p>
          )}

          <div className="sbh-tabs" role="tablist" aria-label="Sprint">
            {sprintOrder.map((sp) => (
              <button
                type="button"
                key={sp.id}
                role="tab"
                aria-selected={focusId === sp.id}
                className={focusId === sp.id ? "is-on" : ""}
                title={sp.status === "active" ? `${sp.name} (active)` : sp.name}
                onClick={() => setSprintPick(String(sp.id))}
              >
                {sp.name}
              </button>
            ))}
            <button
              type="button"
              role="tab"
              aria-selected={!focusSprint}
              className={!focusSprint ? "is-on" : ""}
              onClick={() => setSprintPick("backlog")}
            >
              Backlog
            </button>
          </div>
        </div>
      )}

      {/* ---------- Composer: add a task, the main action ---------- */}
      {fProject && view === "board" && (
      <form className="composer" onSubmit={composeAdd}>
        <div className="composer-main">
          <span className="composer-plus">{icons.plus}</span>
          <input
            className="composer-input"
            value={cTitle}
            disabled={cBusy}
            onChange={(e) => setCTitle(e.target.value)}
            placeholder={focusSprint ? `Add a ${noun} to ${focusSprint.name}…` : "What needs to be done?"}
            aria-label={`New ${noun} title`}
          />
          <button type="submit" className="composer-btn" disabled={!cTitle.trim() || cBusy}>
            Add {noun}
          </button>
        </div>
        <div className="composer-opts">
          <Pick
            caret
            className="chip"
            value={composeStatus}
            onChange={setCStatus}
            label="Status for the new task"
            options={STATUSES.map((x) => ({ value: x.value, label: x.label }))}
          />
          <Pick
            caret
            className={`chip ${cPrio ? "is-set" : ""}`}
            value={cPrio}
            onChange={setCPrio}
            label="Priority for the new task"
            options={[
              { value: "", label: "Any priority", short: "Priority" },
              ...PRIORITIES.map((x) => ({ value: x.value, label: x.label })),
            ]}
          />
          <Pick
            caret
            className={`chip ${cAssignee ? "is-set" : ""}`}
            value={cAssignee}
            onChange={setCAssignee}
            label="Assignee for the new task"
            options={[
              { value: "", label: "Unassigned", short: "Assign to" },
              ...peopleHere.map((t) => ({ value: String(t.id), label: t.full_name })),
            ]}
          />
          <span className="composer-hint">Press Enter to add</span>
          <Link
            className="composer-full"
            to={formLink(composeStatus, focusSprint ? { sprint: focusSprint.id } : {})}
          >
            Full form
          </Link>
        </div>
      </form>
      )}

      {/* ---------- Filters (the secondary ones fold away) ---------- */}
      <div className="filterbar">
        <div className="filter-label">
          Filter <span className="filter-count">{activeCount}</span>
        </div>

        {/* A project picked in the sidebar already scopes the board, so no project dropdown there. */}
        {projects.length > 0 && !sidebarProject && (
          <Pick
            caret
            className={`filter-pick ${pFilter ? "is-set" : ""}`}
            value={pFilter}
            onChange={setPFilter}
            label="Project"
            options={[
              { value: "", label: "All projects", short: "Project" },
              ...projects
                .filter((p) => fType === "all" || (p.kind || "development") === fType)
                .map((p) => ({ value: String(p.id), label: p.name })),
            ]}
          />
        )}
        {!fProject && (
          <Pick
            caret
            className={`filter-pick ${fDay === "today" ? "is-set" : ""}`}
            value={fDay}
            onChange={setFDay}
            label="Filter by date added"
            options={[
              { value: "today", label: "Today", short: "Today" },
              { value: "all", label: "All time", short: "All time" },
            ]}
          />
        )}
        {!fProject && (
          <Pick
            caret
            className={`filter-pick ${setFilterClass(fType)}`}
            value={fType}
            onChange={setFType}
            label="Filter by support or development"
            options={[
              { value: "all", label: "Support & Development", short: "Type" },
              { value: "support", label: "Support", short: "Support" },
              { value: "development", label: "Development", short: "Development" },
            ]}
          />
        )}
        <Pick
          caret
          className={`filter-pick ${setFilterClass(fStatus)}`}
          value={fStatus}
          onChange={setFStatus}
          label="Filter by status"
          options={[
            { value: "all", label: "All status", short: "Status" },
            ...STATUSES.map((x) => ({ value: x.value, label: x.label })),
          ]}
        />
        <Pick
          caret
          className={`filter-pick ${setFilterClass(fAssignee)}`}
          value={fAssignee}
          onChange={setFAssignee}
          label="Filter by person"
          options={[
            { value: "all", label: "Everyone", short: "Assigned to" },
            { value: "none", label: "Unassigned" },
            ...peopleHere.map((t) => ({ value: String(t.id), label: t.full_name })),
          ]}
        />

        <button
          type="button"
          className={`more-btn ${moreOpen ? "is-open" : ""}`}
          aria-expanded={moreOpen}
          onClick={() => setMoreOpen((o) => !o)}
        >
          {moreOpen ? "Fewer filters" : "More filters"}
          {moreCount > 0 && <span className="filter-count">{moreCount}</span>}
        </button>

        {activeCount > 0 && (
          <button type="button" className="clear-filters" onClick={clearFilters}>
            Clear
          </button>
        )}
        {isAdmin && (
          <button
            type="button"
            className="cz-open"
            onClick={() => setCustomizing(true)}
            title="Add or edit statuses, priorities and categories"
          >
            {icons.settings}
            Customize
          </button>
        )}
        <span className="result-count">
          {shown.length} {shown.length === 1 ? noun : `${noun}s`}
        </span>

        {moreOpen && (
          <div className="filterbar-more">
            {isSupportProject && (
              <Pick
                caret
                className={`filter-pick ${setFilterClass(fSprint)}`}
                value={fSprint}
                onChange={setFSprint}
                label="Filter by sprint"
                options={[
                  { value: "all", label: "All sprints", short: "Sprint" },
                  { value: "none", label: "Backlog" },
                  ...sprints.map((s) => ({
                    value: String(s.id),
                    label: s.status === "active" ? `${s.name} (active)` : s.name,
                  })),
                ]}
              />
            )}
            {isBoth && (
              <Pick
                caret
                className={`filter-pick ${setFilterClass(fKind)}`}
                value={fKind}
                onChange={setFKind}
                label="Filter by type"
                options={[
                  { value: "all", label: "All types", short: "Type" },
                  { value: "complaint", label: "Complaints" },
                  { value: "task", label: "Tasks" },
                  { value: "bug", label: "Bugs" },
                ]}
              />
            )}
            <Pick
              caret
              className={`filter-pick ${setFilterClass(fPriority)}`}
              value={fPriority}
              onChange={setFPriority}
              label="Filter by priority"
              options={[
                { value: "all", label: "All priority", short: "Priority" },
                ...PRIORITIES.map((x) => ({ value: x.value, label: x.label })),
              ]}
            />
            <Pick
              caret
              className={`filter-pick ${setFilterClass(fCreator)}`}
              value={fCreator}
              onChange={setFCreator}
              label="Filter by creator"
              options={[
                { value: "all", label: "All creators", short: "Created by" },
                ...creators.map((n) => ({ value: n, label: n })),
              ]}
            />
            {view === "board" ? (
              <Pick
                caret
                className={`filter-pick ${sortBy !== "newest" ? "is-set" : ""}`}
                value={sortBy}
                onChange={setSortBy}
                label="Sort cards"
                options={SORT_OPTIONS}
              />
            ) : (
              <Pick
                caret
                className={`filter-pick ${groupBy !== "none" ? "is-set" : ""}`}
                value={groupBy}
                onChange={setGroupBy}
                label="Group tasks"
                options={[
                  { value: "none", label: "No grouping" },
                  { value: "assignee", label: "Group by person" },
                  { value: "creator", label: "Group by creator" },
                  { value: "status", label: "Group by status" },
                  { value: "priority", label: "Group by priority" },
                ]}
              />
            )}
            <div className={`daterange ${dFrom || dTo ? "is-set" : ""}`}>
              {icons.calendar}
              <input
                type="date"
                value={dFrom}
                max={dTo || undefined}
                onChange={(e) => setDFrom(e.target.value)}
                aria-label="Due from"
              />
              <span className="daterange-sep">–</span>
              <input
                type="date"
                value={dTo}
                min={dFrom || undefined}
                onChange={(e) => setDTo(e.target.value)}
                aria-label="Due to"
              />
            </div>
          </div>
        )}
      </div>

      {view === "table" ? (
        <div className="table-view">
          <div className="thead-fixed" aria-hidden="true">
            <table className="table">
              {colgroup}
              <thead>
                <tr>
                  {heads.map((h) => <th key={h}>{h}</th>)}
                </tr>
              </thead>
            </table>
          </div>
          <div className="panel-body">
          {groups.map((g) => (
            <div key={g.key} className="group">
              {g.label && (
                <h4 className="group-title">
                  {g.label} <span className="muted">{g.rows.length}</span>
                </h4>
              )}
              <div className="table-wrap">
                <table className="table">
                    {colgroup}
                  <tbody>
                    {g.rows.map((c) => (
                      <tr key={c.id} className={c.urgent ? "row-urgent" : ""}>
                        <td data-label="Task ID" className="cell-id">
                          {c.task_number || `#${c.id}`}
                        </td>
                        <td data-label="Task" className="cell-title">
                          {c.urgent && <span className="urgent-light" title="New from admin" aria-label="New from admin" />}
                          <Link to={`/complaints/${c.id}`}>{c.title}</Link> {kindBadge(c)} {sprintChip(c)}
                        </td>
                        <td data-label="Created by" className="muted">{c.created_by_name || "—"}</td>
                        <td data-label="Assignee">{assigneeSelect(c)}</td>
                        <td data-label="Priority">
                          <Pick
                            className={`cell-select pill tone-${priorityTone(c.priority)}`}
                            value={c.priority}
                            onChange={(v) => patch(c.id, { priority: v })}
                            label="Priority"
                            options={PRIORITIES.map((p) => ({ value: p.value, label: p.label }))}
                          />
                        </td>
                        <td data-label="Status">
                          <Pick
                            className={`cell-select pill tone-${statusTone(c.status)}`}
                            value={c.status}
                            onChange={(v) => patch(c.id, { status: v })}
                            label="Status"
                            options={STATUSES.map((x) => ({ value: x.value, label: x.label }))}
                          />
                        </td>
                        <td data-label="Due date">
                          <input
                            type="date"
                            className={`cell-date ${isOverdue(c) ? "overdue" : ""}`}
                            value={c.due_date || ""}
                            onChange={(e) => patch(c.id, { due_date: e.target.value || null })}
                            aria-label="Due date"
                          />
                        </td>
                        <td data-label="Category" className="muted">{c.category}</td>
                        <td data-label="Follow-ups">{followupCell(c)}</td>
                        <td data-label="Log">
                          <button type="button" className="log-btn" onClick={() => setLogId(c.id)}>
                            {icons.history}
                            View log
                          </button>
                        </td>
                        <td data-label="Actions" className="cell-actions">
                          <div className="ec-actions">
                            <button
                              type="button"
                              className="ec-icon"
                              title="Edit"
                              aria-label="Edit task"
                              onClick={() => setEditing(c)}
                            >
                              {icons.edit}
                            </button>
                            <button
                              type="button"
                              className="ec-icon ec-icon-danger"
                              title="Delete"
                              aria-label="Delete task"
                              onClick={() => remove(c)}
                            >
                              {icons.trash}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {g.rows.length === 0 && (
                      <tr>
                        <td colSpan="11" className="empty">
                          {loading
                            ? `Loading ${noun}s…`
                            : !fProject && fDay === "today"
                              ? `No ${noun}s added today`
                              : `No ${noun}s found`}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
          </div>
        </div>
      ) : (
        <div className="board">
          {STATUSES.map((s) => {
            const col = shown.filter((c) => c.status === s.value).sort(SORTERS[sortBy]);
            const dragging = items.find((c) => c.id === dragId);
            const showSlot = overCol === s.value && dragging && dragging.status !== s.value;
            const tone = statusTone(s.value);
            const isOpenCol = s.value === STATUSES[0]?.value;
            const renderCard = (c) => {
                    const pTone = priorityTone(c.priority);
                    const followups = c.followups || [];
                    return (
                      <article
                        key={c.id}
                        className={`task-card ${dragId === c.id ? "is-dragging" : ""} ${c.urgent ? "is-urgent" : ""}`}
                        draggable
                        onClick={(e) => {
                          if (!e.target.closest("a")) navigate(`/complaints/${c.id}`);
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
                          <span className="tc-doc">{icons.doc}</span>
                          <Link to={`/complaints/${c.id}`} className="task-title">{c.title}</Link>
                          {c.urgent && <span className="urgent-light" title="New from admin" aria-label="New from admin" />}
                        </div>

                        <div className="tc-meta">
                          <span className="tc-id">{c.task_number || `#${c.id}`}</span>
                          {kindBadge(c)}
                          {!fProject && projects.length > 1 && c.project_name && (
                            <span
                              title={c.project_name}
                              style={{
                                maxWidth: 110,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                padding: "1px 7px",
                                borderRadius: 999,
                                background: "#f3f6f0",
                                color: "#5d685a",
                                fontSize: 11,
                                fontWeight: 600,
                              }}
                            >
                              {c.project_name}
                            </span>
                          )}
                          {sprintView ? sectionChip(c) : sprintChip(c)}
                          <span
                            className={`tc-prio tone-${pTone}`}
                            title={`${PRIORITIES.find((p) => p.value === c.priority)?.label || c.priority} priority`}
                          />
                          {c.due_date && (
                            <span className={`tc-date ${isOverdue(c) ? "overdue" : ""}`}>
                              {fmtDate(c.due_date)}
                            </span>
                          )}
                          {followups.length > 0 && (
                            <span className="tc-stat" title={followups[0]?.note || "Follow-ups"}>
                              {icons.comment}
                              {followups.length}
                            </span>
                          )}
                          {c.assigned_to_name && (
                            <span className="tc-avatar" title={c.assigned_to_name}>
                              {c.assigned_to_name}
                            </span>
                          )}
                        </div>
                      </article>
                    );
            };
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
                  <button
                    type="button"
                    className="col-add"
                    aria-label={`New ${noun} in ${s.label}`}
                    title={focusSprint ? `New ${noun} in ${focusSprint.name}` : `New ${noun}`}
                    onClick={() => openAdd(s.value)}
                  >
                    {icons.plus}
                  </button>
                </div>

                <div className="col-body">
                  {adding === s.value && (
                    <form className="qa" onSubmit={(e) => quickAdd(e, s.value)}>
                        <input
                          className="qa-input"
                          autoFocus
                          value={newTitle}
                          placeholder={`${Noun} title…`}
                          aria-label={`New ${noun} in ${s.label}`}
                          disabled={addBusy}
                          onChange={(e) => setNewTitle(e.target.value)}
                          onKeyDown={(e) => e.key === "Escape" && closeAdd()}
                          onBlur={() => !newTitle.trim() && closeAdd()}
                        />
                        <div className="qa-row">
                          <span className="qa-hint">Enter to add · Esc to close</span>
                          <Link
                            to={formLink(s.value, focusSprint ? { sprint: focusSprint.id } : {})}
                            className="qa-full"
                          >
                            Full form
                          </Link>
                        </div>
                      </form>
                  )}
                  {col.map(renderCard)}
                  {showSlot && <div className="drop-slot">Drop here</div>}
                  {col.length === 0 && !showSlot && (
                    <p className="col-empty">
                      {loading
                        ? "Loading…"
                        : focusSprint && isOpenCol
                          ? `Nothing here yet. Type above to add one.`
                          : `No ${noun}s`}
                    </p>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {editing && (
        <EditComplaintModal
          key={editing.id}
          complaint={editing}
          team={peopleFor(editing)}
          onClose={() => setEditing(null)}
          onSaved={onSaved}
        />
      )}

      {customizing && (
        <CustomizeModal
          onClose={() => {
            setCustomizing(false);
            // category renames update existing tasks on the server - reload them
            getComplaints().then(setItems).catch(() => {});
          }}
        />
      )}

      {logTask && (
        <HistoryDrawer
          key={logTask.id}
          complaint={logTask}
          onClose={() => setLogId(null)}
        />
      )}
    </div>
  );
}