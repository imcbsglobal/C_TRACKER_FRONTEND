import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  getComplaint,
  getTeam,
  updateComplaint,
  deleteComplaint,
  addFollowup,
  deleteAttachment,
  deleteFollowup,
  updateFollowup,
  reactToFollowup,
  selfAssignComplaint,
  escalateComplaint,
  clearEscalation,
} from "../api/complaints";
import { getSprints } from "../api/sprints";
import { PRODUCT_TYPES, PRODUCTS, ALL_PRODUCTS } from "./supportMeta";
import { STATUSES, CATEGORIES, isAdminUser, isOverdue, statusTone, useConfig } from "../constants";
import { useProjects } from "../projects";
import HelpersField from "../components/HelpersField";
import HistoryDrawer from "../components/HistoryDrawer";
import "./ComplaintDetail.scss";

const initials = (name = "") =>
  name
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

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
  smile: (
    <svg {...svg} width={15} height={15}>
      <circle cx="12" cy="12" r="9" />
      <path d="M8.5 14c.9 1.4 2.1 2 3.5 2s2.6-.6 3.5-2" />
      <line x1="9" y1="9.5" x2="9.01" y2="9.5" />
      <line x1="15" y1="9.5" x2="15.01" y2="9.5" />
    </svg>
  ),
  edit: (
    <svg {...svg} width={15} height={15}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  ),
  status: (
    <svg {...svg}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  ),
  user: (
    <svg {...svg}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
    </svg>
  ),
  users: (
    <svg {...svg}>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2 20c0-3.5 3-5.5 7-5.5s7 2 7 5.5" />
      <path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.8c2.3.6 4 2.1 4 5.2" />
    </svg>
  ),
  date: (
    <svg {...svg}>
      <rect x="4" y="5" width="16" height="15" rx="2" />
      <line x1="4" y1="10" x2="20" y2="10" />
      <line x1="9" y1="3" x2="9" y2="7" />
      <line x1="15" y1="3" x2="15" y2="7" />
    </svg>
  ),
  folder: (
    <svg {...svg}>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </svg>
  ),
  tag: (
    <svg {...svg}>
      <path d="M3 12V4h8l10 10-8 8z" />
      <circle cx="7.5" cy="8.5" r="1" />
    </svg>
  ),
  phone: (
    <svg {...svg}>
      <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z" />
    </svg>
  ),
  history: (
    <svg {...svg} width={15} height={15}>
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 15.5 14" />
    </svg>
  ),
  share: (
    <svg {...svg} width={15} height={15}>
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.6" y1="13.5" x2="15.4" y2="17.5" />
      <line x1="15.4" y1="6.5" x2="8.6" y2="10.5" />
    </svg>
  ),
  pdf: (
    <svg {...svg} width={15} height={15}>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <polyline points="14 3 14 8 19 8" />
      <line x1="9" y1="13" x2="15" y2="13" />
      <line x1="9" y1="17" x2="15" y2="17" />
    </svg>
  ),
  download: (
    <svg {...svg} width={15} height={15}>
      <path d="M12 3v12" />
      <polyline points="7 11 12 16 17 11" />
      <path d="M5 21h14" />
    </svg>
  ),
  trash: (
    <svg {...svg} width={15} height={15}>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  ),
};

// ---------- Emoji reactions on follow-ups ----------
// The server stores the key; the screen shows the emoji.
const REACTIONS = [
  { key: "thumbsup", glyph: "👍", label: "Thumbs up" },
  { key: "check", glyph: "✅", label: "Done" },
  { key: "smile", glyph: "😄", label: "Smile" },
  { key: "heart", glyph: "❤️", label: "Heart" },
  { key: "tada", glyph: "🎉", label: "Celebrate" },
  { key: "eyes", glyph: "👀", label: "Looking" },
  { key: "pray", glyph: "🙏", label: "Thanks" },
  { key: "fire", glyph: "🔥", label: "Fire" },
  { key: "wow", glyph: "😮", label: "Surprised" },
  { key: "thumbsdown", glyph: "👎", label: "Thumbs down" },
];
const QUICK_REACTIONS = ["thumbsup", "check", "smile"];
const reactionOf = (key) => REACTIONS.find((r) => r.key === key);

// ---------- Images on follow-ups ----------
const IMG_NOTE = "(image)";
const ISSUE_NOTE = "(issue image)"; // images added next to the description
const MAX_IMAGES = 5;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

const thumbBox = {
  position: "relative",
  overflow: "hidden",
  border: "1px solid #e3e9de",
  borderRadius: 10,
  background: "#fff",
};
const thumbImg = { display: "block", width: "100%", height: "100%", objectFit: "cover" };
const xBtn = {
  position: "absolute",
  top: 4,
  right: 4,
  display: "grid",
  placeItems: "center",
  width: 20,
  height: 20,
  padding: 0,
  border: 0,
  borderRadius: "50%",
  background: "rgba(28,38,27,0.72)",
  color: "#fff",
  fontSize: 14,
  lineHeight: 1,
  cursor: "pointer",
};
const strip = { display: "flex", flexWrap: "wrap", gap: 8, margin: "10px 0 0", padding: 0, listStyle: "none" };

export function AttachButton({ onPick, disabled, label, ghost }) {
  const ref = useRef(null);
  return (
    <>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          onPick(Array.from(e.target.files || []));
          e.target.value = "";
        }}
      />
      <button
        type="button"
        title="Attach images"
        aria-label="Attach images"
        className={ghost ? "tp-attach-ghost" : undefined}
        disabled={disabled}
        onClick={() => ref.current?.click()}
        style={{
          flexShrink: 0,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          minWidth: 36,
          height: 36,
          padding: label ? "0 14px" : 0,
          border: ghost ? 0 : "1px solid #d3dccd",
          borderRadius: ghost ? 6 : 10,
          background: ghost ? "transparent" : "#fff",
          color: ghost ? "#5d685a" : "#3f6839",
          font: "inherit",
          fontSize: 13,
          fontWeight: 600,
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.45 : 1,
        }}
      >
        <svg
          viewBox="0 0 24 24"
          width="18"
          height="18"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="3" y="4" width="18" height="16" rx="2.5" />
          <circle cx="9" cy="10" r="1.6" />
          <path d="M21 16l-5-5-8 8" />
        </svg>
        {label}
      </button>
    </>
  );
}

// Thumbnails of the images queued for the next follow-up
export function PreviewStrip({ files, onRemove }) {
  const urls = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls]);
  if (!files.length) return null;
  return (
    <ul style={strip}>
      {files.map((f, i) => (
        <li key={`${f.name}-${i}`} style={{ ...thumbBox, width: 72, height: 72 }}>
          <img src={urls[i]} alt={f.name} style={thumbImg} />
          <button type="button" aria-label={`Remove ${f.name}`} onClick={() => onRemove(i)} style={xBtn}>
            ×
          </button>
        </li>
      ))}
    </ul>
  );
}

// Images saved on a follow-up, click to enlarge
export function Gallery({ items, onDelete, size = 110 }) {
  const [open, setOpen] = useState(null);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === "Escape" && setOpen(null);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);
  if (!items.length) return null;
  return (
    <>
      <ul style={strip}>
        {items.map((a) => (
          <li key={a.id} style={{ ...thumbBox, width: size, height: size }}>
            <button
              type="button"
              title={a.name}
              onClick={() => setOpen(a)}
              style={{ display: "block", width: "100%", height: "100%", padding: 0, border: 0, background: "transparent", cursor: "zoom-in" }}
            >
              <img src={a.url} alt={a.name} loading="lazy" style={thumbImg} />
            </button>
            {onDelete && a.can_delete && (
              <button type="button" aria-label="Delete image" onClick={() => onDelete(a)} style={xBtn}>
                ×
              </button>
            )}
          </li>
        ))}
      </ul>
      {open &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            onClick={() => setOpen(null)}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 2000,
              display: "grid",
              placeItems: "center",
              padding: 24,
              background: "rgba(15,22,14,0.82)",
              cursor: "zoom-out",
            }}
          >
            <img
              src={open.url}
              alt={open.name}
              onClick={(e) => e.stopPropagation()}
              style={{ maxWidth: "92vw", maxHeight: "88vh", borderRadius: 10, background: "#fff", cursor: "default" }}
            />
            <button
              type="button"
              aria-label="Close"
              onClick={() => setOpen(null)}
              style={{
                position: "absolute",
                top: 18,
                right: 22,
                width: 38,
                height: 38,
                border: 0,
                borderRadius: "50%",
                background: "rgba(255,255,255,0.18)",
                color: "#fff",
                fontSize: 24,
                lineHeight: 1,
                cursor: "pointer",
              }}
            >
              ×
            </button>
          </div>,
          document.body
        )}
    </>
  );
}

const currentUserName = () => {
  try {
    const u = JSON.parse(localStorage.getItem("user") || "{}");
    return u.full_name || u.email || "";
  } catch {
    return "";
  }
};

export default function ComplaintDetail() {
  useConfig(); // re-render when the admin changes statuses / categories
  const { projects } = useProjects();
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  // Go back to wherever the user came from (e.g. the sprint board); fall back to the task list on a fresh load.
  const goBack = (e) => {
    if (location.key !== "default") {
      e.preventDefault();
      navigate(-1);
    }
  };
  const [c, setC] = useState(null);
  const [team, setTeam] = useState([]);
  const [sprints, setSprints] = useState([]); // sprints of this case's project
  const [note, setNote] = useState("");
  const [adding, setAdding] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [error, setError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [shareOpen, setShareOpen] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [files, setFiles] = useState([]); // images queued for the next follow-up
  const shareRef = useRef(null);
  const descRef = useRef(null);
  const noteRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [editId, setEditId] = useState(null); // follow-up being edited
  const [editText, setEditText] = useState("");
  const [pickerFor, setPickerFor] = useState(null); // follow-up whose emoji picker is open
  const [descSaved, setDescSaved] = useState(false);
  const [issueFiles, setIssueFiles] = useState([]); // images queued for the description
  const [issueBusy, setIssueBusy] = useState(false);
  const [editingIssue, setEditingIssue] = useState(false); // support cases: false = read view, true = edit form

  const refresh = () =>
    getComplaint(id)
      .then(setC)
      .catch(() => setError("Task not found"));

  useEffect(() => {
    refresh();
    getTeam().then(setTeam).catch(() => {});
  }, [id]);

  // Sprints that include the task's project (tasks and bugs only). Reloads when the project changes.
  const caseProject = c?.project;
  const caseIsSupport = !c || c.kind === "complaint";
  useEffect(() => {
    if (caseIsSupport || !caseProject) {
      setSprints([]);
      return;
    }
    getSprints({ project: caseProject })
      .then(setSprints)
      .catch(() => setSprints([]));
  }, [caseIsSupport, caseProject]);

  // Follow-up box grows with the text (up to about 6 lines)
  useEffect(() => {
    const el = noteRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [note, c]);

  // Close the emoji picker on outside click / Escape
  useEffect(() => {
    if (pickerFor == null) return undefined;
    const onDown = (e) => {
      if (!e.target.closest?.(".tp-picker, .tp-react-more")) setPickerFor(null);
    };
    const onKey = (e) => e.key === "Escape" && setPickerFor(null);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [pickerFor]);

  // Close the share menu on outside click / Escape
  useEffect(() => {
    if (!shareOpen) return;
    const onDown = (e) => {
      if (shareRef.current && !shareRef.current.contains(e.target)) setShareOpen(false);
    };
    const onKey = (e) => e.key === "Escape" && setShareOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [shareOpen]);

  if (error)
    return (
      <div className="tp">
        <Link to="/" className="tp-back" onClick={goBack}>← Back to tasks</Link>
        <div className="tp-alert" role="alert">{error}</div>
      </div>
    );
  if (!c) return <div className="tp"><p className="tp-muted">Loading...</p></div>;

  const patch = async (data) => {
    setSaveError("");
    try {
      const updated = await updateComplaint(id, data);
      setC((prev) => ({ ...prev, ...updated }));
    } catch (err) {
      const d = err?.response?.data;
      const first = d && typeof d === "object" ? Object.values(d)[0] : null;
      setSaveError((Array.isArray(first) ? first[0] : first) || "Could not save that change.");
    }
  };

  const textBlur = (field) => (e) => {
    const value = e.target.value;
    if (value !== (c[field] || "")) patch({ [field]: value });
  };

  // Queue images (picked or pasted) for the next follow-up
  const addFiles = (list, target = "followup") => {
    const current = target === "issue" ? issueFiles : files;
    const setter = target === "issue" ? setIssueFiles : setFiles;
    const incoming = Array.from(list || []);
    if (!incoming.length) return;
    const images = incoming.filter((f) => f.type.startsWith("image/"));
    const fit = images.filter((f) => f.size <= MAX_IMAGE_BYTES);
    let msg = "";
    if (images.length < incoming.length) msg = "Only image files can be attached.";
    else if (fit.length < images.length) msg = "Each image must be 10 MB or smaller.";
    else if (current.length + fit.length > MAX_IMAGES) msg = `You can attach up to ${MAX_IMAGES} images.`;
    setter((prev) => [...prev, ...fit].slice(0, MAX_IMAGES));
    setSaveError(msg);
  };

  const onPasteNote = (e) => {
    const pasted = Array.from(e.clipboardData?.files || []).filter((f) => f.type.startsWith("image/"));
    if (pasted.length) {
      e.preventDefault();
      addFiles(pasted);
    }
  };

  const submitNote = async (e) => {
    e.preventDefault();
    if ((!note.trim() && files.length === 0) || adding) return;
    setAdding(true);
    setSaveError("");
    try {
      await addFollowup(id, note.trim(), files);
      setNote("");
      setFiles([]);
      await refresh();
    } catch (err) {
      setSaveError(apiMessage(err, "Could not add the follow-up."));
    }
    setAdding(false);
  };

  const removeAttachment = async (att) => {
    if (!window.confirm("Delete this image?")) return;
    try {
      await deleteAttachment(att.id);
      setC((prev) => ({
        ...prev,
        attachments: (prev.attachments || []).filter((x) => x.id !== att.id),
        followups: (prev.followups || []).map((f) => ({
          ...f,
          attachments: (f.attachments || []).filter((x) => x.id !== att.id),
        })),
      }));
    } catch (err) {
      setSaveError(apiMessage(err, "Could not delete the image."));
    }
  };

  // Emoji reactions: anyone who can see the case can react; same emoji again removes it.
  const react = async (f, key) => {
    setPickerFor(null);
    setSaveError("");
    try {
      const updated = await reactToFollowup(f.id, key);
      setC((prev) => ({
        ...prev,
        followups: (prev.followups || []).map((x) =>
          x.id === f.id ? { ...x, reactions: updated.reactions || [] } : x
        ),
      }));
    } catch (err) {
      setSaveError(apiMessage(err, "Could not save the reaction."));
    }
  };

  // Follow-up messages: the author (or the admin) can edit or delete them.
  const removeFollowup = async (f) => {
    if (!window.confirm("Delete this message? This cannot be undone.")) return;
    setSaveError("");
    try {
      await deleteFollowup(f.id);
      if (editId === f.id) setEditId(null);
      await refresh();
    } catch (err) {
      setSaveError(apiMessage(err, "Could not delete the message."));
    }
  };

  const startEdit = (f) => {
    setEditId(f.id);
    setEditText(f.note);
  };

  const saveEdit = async () => {
    const text = editText.trim();
    if (!text) return;
    setSaveError("");
    try {
      await updateFollowup(editId, text);
      setEditId(null);
      await refresh();
    } catch (err) {
      setSaveError(apiMessage(err, "Could not update the message."));
    }
  };

  const apiMessage = (err, fallback) => {
    const body = err?.response?.data;
    const first = body && typeof body === "object" ? Object.values(body)[0] : null;
    return (Array.isArray(first) ? first[0] : first) || fallback;
  };

  // Support cases: pick up an unassigned case / move it one level up.
  const selfAssign = async () => {
    setSaveError("");
    try {
      const updated = await selfAssignComplaint(id);
      setC((prev) => ({ ...prev, ...updated }));
    } catch (err) {
      setSaveError(apiMessage(err, "Could not self-assign this case."));
    }
  };

  // Escalate to another support person (they become a helper), or clear it.
  const changeEscalation = async (value) => {
    setSaveError("");
    try {
      const updated = value
        ? await escalateComplaint(id, Number(value))
        : await clearEscalation(id);
      setC((prev) => ({ ...prev, ...updated }));
    } catch (err) {
      setSaveError(apiMessage(err, "Could not change the escalation."));
    }
  };

  const remove = async () => {
    if (!window.confirm("Delete this task?")) return;
    try {
      await deleteComplaint(id);
      navigate("/");
    } catch {
      setSaveError("Could not delete the task.");
    }
  };

  // ---------- PDF share / download ----------
  const makePdf = async () => {
    const { buildTaskPdf } = await import("../api/Taskpdf");
    return buildTaskPdf(c);
  };

  const downloadPdf = async () => {
    setShareOpen(false);
    setSaveError("");
    setPdfBusy(true);
    try {
      const file = await makePdf();
      const url = URL.createObjectURL(file);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setSaveError("Could not create the PDF.");
    }
    setPdfBusy(false);
  };

  const sharePdf = async () => {
    setShareOpen(false);
    setSaveError("");
    setPdfBusy(true);
    try {
      const file = await makePdf();
      await navigator.share({
        files: [file],
        title: `${c.task_number || `#${c.id}`} ${c.title}`,
        text: `Task ${c.task_number || `#${c.id}`}: ${c.title}`,
      });
    } catch (err) {
      if (err?.name !== "AbortError") setSaveError("Could not share the PDF.");
    }
    setPdfBusy(false);
  };

  const canShareFiles = (() => {
    try {
      return (
        typeof navigator !== "undefined" &&
        !!navigator.canShare &&
        navigator.canShare({ files: [new File([""], "t.pdf", { type: "application/pdf" })] })
      );
    } catch {
      return false;
    }
  })();

  // Only people in this task's project can be assigned (people already on the task stay visible)
  const proj = projects.find((p) => p.id === c.project);
  const teamHere = team.filter(
    (t) =>
      !proj ||
      proj.members.includes(t.id) ||
      t.id === c.assigned_to ||
      (c.helpers || []).includes(t.id)
  );
  const projectOptions = proj
    ? projects
    : [...projects, { id: c.project, name: c.project_name || "Project" }];
  // Open sprints, plus the one the case is already in (even if it has been completed).
  const sprintOptions = sprints.filter((s) => s.status !== "completed" || s.id === c.sprint);
  if (c.sprint && !sprintOptions.some((s) => s.id === c.sprint)) {
    sprintOptions.push({ id: c.sprint, name: c.sprint_name || "Sprint", status: "planned" });
  }
  const inClosedSprint = sprints.find((s) => s.id === c.sprint)?.status === "completed";
  // Sections of the task's project (the admin creates them under Projects).
  const sectionOptions = [...(proj?.sections || [])];
  if (c.section && !sectionOptions.some((x) => x.id === c.section)) {
    sectionOptions.push({ id: c.section, name: c.section_name || "Section" });
  }

  const allFollowups = c.followups || [];
  const followups = allFollowups.filter((f) => f.note !== ISSUE_NOTE);
  const issueImages = [
    ...(c.attachments || []),
    ...allFollowups.filter((f) => f.note === ISSUE_NOTE).flatMap((f) => f.attachments || []),
  ];
  const tone = statusTone(c.status);
  const me = currentUserName();
  const canManageMsg = (f) => isAdminUser() || (!!f.created_by_name && f.created_by_name === me);

  // Support case extras. Everyone on the support team can open a case, but only its
  // owners (assignee, helpers, creator) and the admin can change it.
  const isCase = c.kind === "complaint";
  const readOnly = isCase && c.can_edit === false;
  const legacyProduct = c.product_name && !ALL_PRODUCTS.includes(c.product_name);
  const canSelfAssign = isCase && !c.assigned_to && !isAdminUser();
  // Escalate to the OTHER support people of this project: not the assignee, and not
  // the person who is escalating (the server refuses that too).
  const escalateOptions = teamHere.filter(
    (t) =>
      ["support", "both"].includes(t.access) &&
      t.id !== c.assigned_to &&
      (isAdminUser() || t.full_name !== me)
  );
  if (c.escalated_to && !escalateOptions.some((t) => t.id === c.escalated_to)) {
    escalateOptions.push({ id: c.escalated_to, full_name: c.escalated_to_name });
  }

  // Support cases show the issue exactly as the person submitted it (read view).
  // The edit form only opens when someone presses "Edit". Tasks and bugs keep the form.
  const issueReadView = isCase && (!editingIssue || isAdminUser());

  const cancelIssueEdit = () => {
    setEditingIssue(false);
    setIssueFiles([]);
    setDescSaved(false);
  };

  return (
    <div className="tp" key={c.id}>
      <div className="tp-top">
        <Link to="/" className="tp-back" onClick={goBack}>← Back to tasks</Link>
        <div className="tp-top-actions">
          <div className="tp-share" ref={shareRef}>
            <button
              type="button"
              className="tp-btn tp-btn-share"
              onClick={() => setShareOpen((o) => !o)}
              aria-haspopup="menu"
              aria-expanded={shareOpen}
              disabled={pdfBusy}
            >
              {icons.share}
              {pdfBusy ? "Preparing..." : "Share"}
            </button>
            {shareOpen && (
              <div className="tp-menu" role="menu">
                {canShareFiles && (
                  <button type="button" role="menuitem" className="tp-menu-item" onClick={sharePdf}>
                    {icons.pdf}
                    Share as PDF
                  </button>
                )}
                <button type="button" role="menuitem" className="tp-menu-item" onClick={downloadPdf}>
                  {icons.download}
                  Download PDF
                </button>
              </div>
            )}
          </div>
          {canSelfAssign && (
            <button type="button" className="tp-btn" onClick={selfAssign}>
              {icons.user}
              Self-assign
            </button>
          )}
          <button type="button" className="tp-btn" onClick={() => setShowLog(true)}>
            {icons.history}
            History
          </button>
          <button type="button" className="tp-btn tp-btn-danger" onClick={remove}>
            {icons.trash}
            Delete
          </button>
        </div>
      </div>

      <div className="tp-page">
        <span className="tp-num">{(isCase && c.case_number) || c.task_number || `#${c.id}`}</span>

        <input
          className="tp-title"
          defaultValue={c.title}
          placeholder="Untitled"
          disabled={readOnly}
          onBlur={(e) => e.target.value.trim() && textBlur("title")(e)}
        />
        <p className="tp-sub">
          Created {new Date(c.created_at).toLocaleString()}
          {c.created_by_name ? ` by ${c.created_by_name}` : ""}
        </p>

        {saveError && <div className="tp-alert" role="alert">{saveError}</div>}
        {readOnly && (
          <div className="tp-alert" role="status">
            {c.assigned_to
              ? `Assigned to ${c.assigned_to_name}. Only the assignee, helpers or whoever filed this case can edit it - you can still add follow-ups.`
              : "You can view this case. Self-assign it to edit."}
          </div>
        )}

        {/* ---------- New-case banner ---------- */}
        {isCase && c.urgent && (
          <div className="tp-banner" role="status">
            <span className="tp-dot" aria-hidden="true" />
            <div>
              <strong>New case{c.created_by_name ? ` from ${c.created_by_name}` : ""}</strong>
              <span>Read the issue below and check the attached images before you start.</span>
            </div>
          </div>
        )}

        {/* ---------- Properties ---------- */}
        <fieldset className="tp-props" disabled={readOnly} style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}>
          <div className="tp-row">
            <label className="tp-label" htmlFor="status">{icons.status}Status</label>
            <div className="tp-value">
              <select
                id="status"
                className={`tp-input tp-pill tone-${tone}`}
                value={c.status}
                onChange={(e) => patch({ status: e.target.value })}
              >
                {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          </div>

          <div className="tp-row">
            <label className="tp-label" htmlFor="assignee">{icons.user}Assignee</label>
            <div className="tp-value">
              <select
                id="assignee"
                className="tp-input"
                value={c.assigned_to || ""}
                onChange={(e) => patch({ assigned_to: e.target.value || null })}
              >
                <option value="">Unassigned</option>
                {teamHere.map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
              </select>
            </div>
          </div>

          <div className="tp-row">
            <label className="tp-label" htmlFor="due">{icons.date}Due date</label>
            <div className="tp-value">
              <input
                id="due"
                type="date"
                className={`tp-input ${isOverdue(c) ? "overdue" : ""}`}
                value={c.due_date || ""}
                onChange={(e) => patch({ due_date: e.target.value || null })}
              />
            </div>
          </div>

          <div className="tp-row">
            <label className="tp-label" htmlFor="category">{icons.tag}Category</label>
            <div className="tp-value">
              <select
                id="category"
                className="tp-input"
                value={c.category}
                onChange={(e) => patch({ category: e.target.value })}
              >
                {[...new Set([...CATEGORIES, c.category])].map((x) => <option key={x}>{x}</option>)}
              </select>
            </div>
          </div>

          <div className="tp-row">
            <label className="tp-label" htmlFor="project">{icons.folder}Project</label>
            <div className="tp-value">
              <select
                id="project"
                className="tp-input"
                value={c.project || ""}
                onChange={(e) => patch({ project: Number(e.target.value) })}
              >
                {projectOptions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>

          {!isCase && (
            <div className="tp-row">
              <label className="tp-label" htmlFor="section">{icons.tag}Section</label>
              <div className="tp-value">
                <select
                  id="section"
                  className="tp-input"
                  value={c.section || ""}
                  disabled={sectionOptions.length === 0}
                  onChange={(e) => patch({ section: e.target.value ? Number(e.target.value) : null })}
                >
                  <option value="">
                    {sectionOptions.length === 0 ? "No sections in this project" : "No section"}
                  </option>
                  {sectionOptions.map((x) => (
                    <option key={x.id} value={x.id}>{x.name}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {!isCase && (
            <div className="tp-row">
              <label className="tp-label" htmlFor="sprint">{icons.tag}Sprint</label>
              <div className="tp-value">
                <select
                  id="sprint"
                  className="tp-input"
                  value={c.sprint || ""}
                  disabled={inClosedSprint}
                  title={inClosedSprint ? "This sprint is completed" : undefined}
                  onChange={(e) => patch({ sprint: e.target.value ? Number(e.target.value) : null })}
                >
                  <option value="">Backlog (no sprint)</option>
                  {sprintOptions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                      {s.status === "active" ? " (active)" : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {!isCase && (
            <div className="tp-row">
              <span className="tp-label">{icons.users}Assignee</span>
              <div className="tp-value">
                <HelpersField
                  team={teamHere}
                  value={c.helpers || []}
                  excludeId={c.assigned_to}
                  onChange={(ids) => patch({ helpers: ids })}
                />
              </div>
            </div>
          )}

          {isCase && (
            <>
              <div className="tp-row">
                <label className="tp-label" htmlFor="product_name">{icons.tag}Product</label>
                <div className="tp-value">
                  <select
                    id="product_name"
                    className="tp-input"
                    value={c.product_name || ""}
                    onChange={(e) => patch({ product_name: e.target.value })}
                  >
                    <option value="">Not set</option>
                    {legacyProduct && <option>{c.product_name}</option>}
                    {PRODUCT_TYPES.map((t) => (
                      <optgroup key={t.value} label={t.label}>
                        {PRODUCTS[t.value].map((p) => <option key={p}>{p}</option>)}
                      </optgroup>
                    ))}
                  </select>
                </div>
              </div>
              <div className="tp-row">
                <label className="tp-label" htmlFor="escalated_to">{icons.users}Escalate to</label>
                <div className="tp-value">
                  <select
                    id="escalated_to"
                    className="tp-input"
                    value={c.escalated_to || ""}
                    disabled={c.is_closed}
                    onChange={(e) => changeEscalation(e.target.value)}
                  >
                    <option value="">Not escalated</option>
                    {escalateOptions.map((t) => (
                      <option key={t.id} value={t.id}>{t.full_name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </>
          )}

          <div className="tp-row">
            <label className="tp-label" htmlFor="customer">{icons.user}Customer</label>
            <div className="tp-value">
              <input
                id="customer"
                className="tp-input"
                defaultValue={c.customer}
                onBlur={textBlur("customer")}
                placeholder="Empty"
              />
            </div>
          </div>

          <div className="tp-row">
            <label className="tp-label" htmlFor="phone">{icons.phone}Phone</label>
            <div className="tp-value">
              <input
                id="phone"
                className="tp-input"
                defaultValue={c.phone}
                onBlur={textBlur("phone")}
                placeholder="Empty"
              />
            </div>
          </div>
        </fieldset>

        {/* ---------- Issue (description + images) ---------- */}
        <section className={`tp-issue ${issueReadView ? "is-read" : ""}`}>
          <h3 className="tp-issue-head">
            Issue details
            {issueImages.length > 0 && (
              <span className="tp-count">{issueImages.length} image{issueImages.length === 1 ? "" : "s"}</span>
            )}
            {isCase && !readOnly && !isAdminUser() && issueReadView && (
              <button
                type="button"
                className="tp-btn tp-issue-edit"
                onClick={() => setEditingIssue(true)}
              >
                {icons.edit}
                Edit
              </button>
            )}
          </h3>

          {issueReadView ? (
            <>
              <div className="tp-issue-meta">
                <span className="tp-avatar" aria-hidden="true">
                  {initials(c.created_by_name) || "?"}
                </span>
                <div>
                  <strong>
                    {c.created_by_name ? `Submitted by ${c.created_by_name}` : "Submitted"}
                  </strong>
                  <small>{new Date(c.created_at).toLocaleString()}</small>
                </div>
                {(c.customer || c.phone) && (
                  <ul className="tp-issue-customer">
                    {c.customer && (
                      <li>
                        {icons.user}
                        {c.customer}
                      </li>
                    )}
                    {c.phone && (
                      <li>
                        {icons.phone}
                        {c.phone}
                      </li>
                    )}
                  </ul>
                )}
              </div>

              {c.description ? (
                <p className="tp-issue-text">{c.description}</p>
              ) : (
                <p className="tp-issue-text is-empty">No description was added.</p>
              )}

              {issueImages.length > 0 && <Gallery items={issueImages} size={220} />}
            </>
          ) : (
            <>
              <textarea
                className="tp-textarea"
                rows="6"
                ref={descRef}
                defaultValue={c.description}
                disabled={readOnly}
                onChange={() => setDescSaved(false)}
                onPaste={(e) => {
                  const pasted = Array.from(e.clipboardData?.files || []).filter((f) => f.type.startsWith("image/"));
                  if (pasted.length) {
                    e.preventDefault();
                    addFiles(pasted, "issue");
                  }
                }}
                onBlur={textBlur("description")}
                placeholder={readOnly ? "No description was added." : "Describe the issue..."}
                aria-label="Description"
              />
              {!readOnly && (
                <div className="tp-issue-actions">
                  <button
                    type="button"
                    className="tp-btn"
                    disabled={issueBusy}
                    onClick={async () => {
                      setIssueBusy(true);
                      await patch({ description: descRef.current.value });
                      if (issueFiles.length) {
                        try {
                          await addFollowup(id, ISSUE_NOTE, issueFiles);
                          setIssueFiles([]);
                          await refresh();
                        } catch (err) {
                          setSaveError(apiMessage(err, "Could not upload the images."));
                          setIssueBusy(false);
                          return;
                        }
                      }
                      setDescSaved(true);
                      setIssueBusy(false);
                      if (isCase) setEditingIssue(false); // back to the read view after saving
                    }}
                  >
                    {issueBusy ? "Saving..." : issueFiles.length ? "Save description & images" : "Save description"}
                  </button>
                  <AttachButton
                    label="Add images"
                    onPick={(f) => addFiles(f, "issue")}
                    disabled={issueBusy || issueFiles.length >= MAX_IMAGES}
                  />
                  {isCase && (
                    <button
                      type="button"
                      className="tp-btn tp-issue-cancel"
                      disabled={issueBusy}
                      onClick={cancelIssueEdit}
                    >
                      Cancel
                    </button>
                  )}
                  {descSaved && <span className="tp-saved">Saved ✓</span>}
                </div>
              )}
              <PreviewStrip files={issueFiles} onRemove={(i) => setIssueFiles((p) => p.filter((_, n) => n !== i))} />
              {issueImages.length > 0 && (
                <Gallery items={issueImages} onDelete={removeAttachment} size={170} />
              )}
            </>
          )}
        </section>

        {/* ---------- Follow-ups: messages, then the composer pinned at the bottom ---------- */}
        <section className="tp-fu">
          <h3 className="tp-fu-head">
            Follow-ups <span className="tp-count">{followups.length}</span>
          </h3>

          <ul className="tp-list">
            {followups.length === 0 && <li className="tp-empty">No follow-ups yet</li>}
            {[...followups].reverse().map((f) => {
              const imageOnly = f.note === IMG_NOTE && (f.attachments || []).length > 0;
              const editing = editId === f.id;
              return (
                <li key={f.id} className={`tp-msg ${editing ? "is-editing" : ""} ${pickerFor === f.id ? "has-picker" : ""}`}>
                  <span className="tp-avatar" aria-hidden="true">
                    {initials(f.created_by_name) || "?"}
                  </span>
                  <div className="tp-note">
                    <div className="tp-note-head">
                      <strong>{f.created_by_name || "Someone"}</strong>
                      <small>{new Date(f.created_at).toLocaleString()}</small>
                    </div>
                    {editing ? (
                      <div className="tp-edit">
                        <textarea
                          className="tp-edit-input"
                          rows="2"
                          autoFocus
                          aria-label="Edit message"
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Escape") setEditId(null);
                            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                              e.preventDefault();
                              saveEdit();
                            }
                          }}
                        />
                        <div className="tp-edit-bar">
                          <span className="tp-edit-hint">Esc to cancel, Enter to save</span>
                          <button type="button" className="tp-edit-cancel" onClick={() => setEditId(null)}>
                            Cancel
                          </button>
                          <button type="button" className="tp-edit-save" onClick={saveEdit} disabled={!editText.trim()}>
                            Save
                          </button>
                        </div>
                      </div>
                    ) : (
                      !imageOnly && <p>{f.note}</p>
                    )}
                    <Gallery items={f.attachments || []} />
                    {(f.reactions || []).length > 0 && (
                      <div className="tp-reacts">
                        {f.reactions.map((r) => {
                          const meta = reactionOf(r.emoji);
                          if (!meta) return null;
                          return (
                            <button
                              key={r.emoji}
                              type="button"
                              className={`tp-react ${r.mine ? "on" : ""}`}
                              aria-pressed={r.mine}
                              title={`${r.users.join(", ")} reacted with ${meta.label}`}
                              onClick={() => react(f, r.emoji)}
                            >
                              <span aria-hidden="true">{meta.glyph}</span>
                              {r.count}
                            </button>
                          );
                        })}
                        <button
                          type="button"
                          className="tp-react tp-react-add tp-react-more"
                          title="Add reaction"
                          aria-label="Add reaction"
                          onClick={() => setPickerFor(pickerFor === f.id ? null : f.id)}
                        >
                          {icons.smile}
                        </button>
                      </div>
                    )}
                  </div>

                  {!editing && (
                    <div className="tp-msg-actions" role="toolbar" aria-label="Message actions">
                      {QUICK_REACTIONS.map((key) => {
                        const meta = reactionOf(key);
                        return (
                          <button
                            key={key}
                            type="button"
                            className="tp-emoji"
                            title={meta.label}
                            aria-label={`React with ${meta.label}`}
                            onClick={() => react(f, key)}
                          >
                            {meta.glyph}
                          </button>
                        );
                      })}
                      <button
                        type="button"
                        className="tp-react-more"
                        title="Add reaction"
                        aria-label="Add reaction"
                        aria-haspopup="menu"
                        aria-expanded={pickerFor === f.id}
                        onClick={() => setPickerFor(pickerFor === f.id ? null : f.id)}
                      >
                        {icons.smile}
                      </button>
                      {canManageMsg(f) && (
                        <>
                          <span className="tp-sep" aria-hidden="true" />
                          {!imageOnly && (
                            <button type="button" title="Edit" aria-label="Edit message" onClick={() => startEdit(f)}>
                              {icons.edit}
                            </button>
                          )}
                          <button
                            type="button"
                            className="is-danger"
                            title="Delete"
                            aria-label="Delete message"
                            onClick={() => removeFollowup(f)}
                          >
                            {icons.trash}
                          </button>
                        </>
                      )}
                    </div>
                  )}

                  {pickerFor === f.id && !editing && (
                    <div className="tp-picker" role="menu" aria-label="Choose a reaction">
                      {REACTIONS.map((r) => (
                        <button
                          key={r.key}
                          type="button"
                          role="menuitem"
                          title={r.label}
                          aria-label={r.label}
                          onClick={() => react(f, r.key)}
                        >
                          {r.glyph}
                        </button>
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          <div className="tp-composer-wrap">
            <form
              className={`tp-composer ${dragOver ? "is-drag" : ""}`}
              onSubmit={submitNote}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                addFiles(e.dataTransfer?.files);
              }}
            >
              {files.length > 0 && (
                <div className="tp-composer-previews">
                  <PreviewStrip files={files} onRemove={(i) => setFiles((prev) => prev.filter((_, n) => n !== i))} />
                </div>
              )}
              <textarea
                ref={noteRef}
                className="tp-composer-input"
                rows="1"
                placeholder="Write a follow-up..."
                aria-label="Add a follow-up"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                onPaste={onPasteNote}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    submitNote(e);
                  }
                }}
              />
              <div className="tp-composer-bar">
                <AttachButton
                  ghost
                  onPick={addFiles}
                  disabled={adding || files.length >= MAX_IMAGES}
                />
                <span className="tp-composer-hint">
                  Enter to send, Shift + Enter for a new line. Up to {MAX_IMAGES} images, or paste with Ctrl+V.
                </span>
                <button
                  className="tp-send"
                  type="submit"
                  title="Add follow-up"
                  aria-label={adding ? "Adding follow-up" : "Add follow-up"}
                  disabled={(!note.trim() && files.length === 0) || adding}
                >
                  <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M22 2 11 13" />
                    <path d="M22 2 15 22l-4-9-9-4z" />
                  </svg>
                </button>
              </div>
            </form>
          </div>
        </section>
      </div>

      {showLog && <HistoryDrawer complaint={c} onClose={() => setShowLog(false)} />}
    </div>
  );
}