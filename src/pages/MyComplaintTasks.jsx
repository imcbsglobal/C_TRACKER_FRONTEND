import { useCallback, useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  addFollowup,
  deleteAttachment,
  deleteFollowup,
  createComplaintTask,
  escalateComplaintTask,
  getComplaint,
  reactToFollowup,
  selfAssignComplaint,
  updateComplaint,
  updateComplaintTask,
  updateFollowup,
} from "../api/complaints";
import HistoryDrawer from "../components/HistoryDrawer";
import { STATUSES, PRIORITIES, isAdminUser, useConfig } from "../constants";
import { useProjects } from "../projects";
import { AttachButton, Gallery, PreviewStrip } from "./ComplaintDetail";
import "./ComplaintDetail.scss"; // the .tp look: page shell, follow-ups, composer
import "./MyComplaintTasks.scss";

// Support-side complaint page (Notion style).
// Top: title + small inline details. Then a short issue note, the complaint's own
// status (this is its progress) with the Escalate button, and the follow-ups.
// The complaint itself is the task: the page shows no task list. Escalating still goes
// through one hidden task row behind the complaint (the server escalates tasks).

const IMG_NOTE = "(image)";
const ISSUE_NOTE = "(issue image)";
const MAX_IMAGES = 5;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

// Emoji reactions on follow-ups. The server stores the key; the screen shows the emoji.
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

const errText = (err, fallback) => {
  const d = err?.response?.data;
  if (!d || typeof d === "string") return fallback;
  if (d.detail) return d.detail;
  const first = Object.values(d)[0];
  return (Array.isArray(first) ? first[0] : first) || fallback;
};

const initials = (name = "") =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join("");

const currentUserName = () => {
  try {
    const u = JSON.parse(localStorage.getItem("user") || "{}");
    return u.full_name || u.email || "";
  } catch {
    return "";
  }
};

const statusOf = (value) => STATUSES.find((s) => s.value === value);
const toneOf = (value) => statusOf(value)?.tone || "grey";

// ---------- icons ----------
const Svg = ({ children, size = 16 }) => (
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
    {children}
  </svg>
);
const IconEdit = ({ size }) => (
  <Svg size={size}>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </Svg>
);
const IconTrash = ({ size }) => (
  <Svg size={size}>
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6M14 11v6" />
    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
  </Svg>
);
const IconSmile = ({ size }) => (
  <Svg size={size}>
    <circle cx="12" cy="12" r="9" />
    <path d="M8.5 14c.9 1.4 2.1 2 3.5 2s2.6-.6 3.5-2" />
    <line x1="9" y1="9.5" x2="9.01" y2="9.5" />
    <line x1="15" y1="9.5" x2="15.01" y2="9.5" />
  </Svg>
);
const IconUser = () => (
  <Svg>
    <circle cx="12" cy="8" r="3.6" />
    <path d="M4.5 20v-1a5.5 5.5 0 0 1 5.5-5.5h4a5.5 5.5 0 0 1 5.5 5.5v1" />
  </Svg>
);
const IconPhone = () => (
  <Svg size={14}>
    <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z" />
  </Svg>
);
const IconHistory = () => (
  <Svg>
    <circle cx="12" cy="12" r="9" />
    <polyline points="12 7 12 12 15.5 14" />
  </Svg>
);
const IconEscalate = () => (
  <Svg>
    <circle cx="12" cy="12" r="9" />
    <polyline points="8.5 12.5 12 9 15.5 12.5" />
    <line x1="12" y1="9" x2="12" y2="16" />
  </Svg>
);

// Where the complaint went when it was escalated, and how the developers' work is going.
const escalationBadge = (c) => {
  if (c.escalation === "admin") {
    return { tone: "is-admin", text: "Escalated to Admin", title: c.escalation_note || undefined };
  }
  if (c.escalation === "developers") {
    const who = c.dev_task_assignee_name ? ` · ${c.dev_task_assignee_name}` : "";
    const text = c.dev_task_status_label
      ? `With developers · ${c.dev_task_status_label}${who}`
      : "Escalated to developers";
    return { tone: c.dev_task_is_closed ? "is-done" : "is-dev", text, title: c.escalation_note || undefined };
  }
  return null;
};

// ---------- page ----------
export default function MyComplaintTasks() {
  useConfig(); // re-render when the admin changes statuses
  const { id } = useParams();
  const [params] = useSearchParams();
  const project = params.get("project") || "";
  const { projects } = useProjects();

  const [c, setC] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [descOpen, setDescOpen] = useState(false); // issue text: short / full

  // escalate the complaint: the dialog's answers
  const [escOpen, setEscOpen] = useState(false);
  const [escTarget, setEscTarget] = useState("developers"); // "admin" | "developers"
  const [escKind, setEscKind] = useState("bug"); // type of the developer task
  const [escPriority, setEscPriority] = useState("");
  const [escNote, setEscNote] = useState("");

  // follow-ups on the complaint
  const [note, setNote] = useState("");
  const [files, setFiles] = useState([]); // images queued for the next follow-up
  const [dragOver, setDragOver] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editText, setEditText] = useState("");
  const [pickerFor, setPickerFor] = useState(null); // follow-up whose emoji picker is open

  const refresh = useCallback(() => getComplaint(id).then(setC), [id]);

  useEffect(() => {
    setC(null);
    setLoadError("");
    refresh().catch(() => setLoadError("Complaint not found."));
  }, [refresh]);

  // Close the escalate dialog on Escape
  useEffect(() => {
    if (!escOpen) return undefined;
    const onKey = (e) => e.key === "Escape" && setEscOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [escOpen]);

  const projectId = project || (c?.project ? String(c.project) : "");
  const projectName = projects.find((p) => String(p.id) === String(projectId))?.name || c?.project_name || "";
  const backTo = `/my-complaints${projectId ? `?project=${projectId}` : ""}`;

  if (loadError) {
    return (
      <div className="tp">
        <Link to={backTo} className="tp-back">
          ← Back to complaints
        </Link>
        <div className="tp-alert" role="alert">
          {loadError}
        </div>
      </div>
    );
  }
  if (!c) {
    return (
      <div className="tp">
        <p className="tp-muted">Loading...</p>
      </div>
    );
  }

  // ---------- complaint ----------
  const admin = isAdminUser();
  const canEdit = !!c.can_edit;
  const readOnly = !canEdit;
  const canSelfAssign = !c.assigned_to && !admin;
  const canEscalate = canEdit && !c.is_closed;
  const escRow = (c.tasks || []).find((t) => t.escalation) || null; // hidden task that carries the escalation
  const esc = escRow ? escalationBadge(escRow) : null;

  const selfAssign = async () => {
    setSaveError("");
    try {
      const updated = await selfAssignComplaint(id);
      setC((prev) => ({ ...prev, ...updated }));
    } catch (err) {
      setSaveError(errText(err, "Could not self-assign this complaint."));
    }
  };

  const act = async (fn) => {
    setBusy(true);
    setSaveError("");
    try {
      await fn();
      await refresh();
      return true;
    } catch (err) {
      setSaveError(errText(err, "Something went wrong."));
      return false;
    } finally {
      setBusy(false);
    }
  };

  // The complaint's own status is its progress.
  const setStatus = (value) => act(() => updateComplaint(c.id, { status: value }));

  // ---------- escalate the complaint ----------
  // Developers can only be reached when the admin made a development project with the
  // SAME NAME as this support project and put developers on it (the server decides).
  const escOpts = c.escalation_options || {};
  const devsReady = !!escOpts.dev_project && escOpts.developers > 0;
  const devHint = !escOpts.dev_project
    ? `There is no development project named “${projectName}” yet. Ask the admin to create one with the same name.`
    : escOpts.developers === 0
      ? `“${escOpts.dev_project}” has no developers yet. Ask the admin to add them.`
      : `Creates a ${escKind} in “${escOpts.dev_project}” and notifies ${escOpts.developers} developer${escOpts.developers === 1 ? "" : "s"}.`;

  const openEscalate = () => {
    setSaveError("");
    setEscNote("");
    setEscKind("bug");
    setEscPriority(c.priority || "");
    setEscTarget(devsReady ? "developers" : admin ? "developers" : "admin");
    setEscOpen(true);
  };
  const closeEscalate = () => setEscOpen(false);
  const submitEscalate = async (e) => {
    e.preventDefault();
    if (busy) return;
    const body = { target: escTarget, note: escNote.trim() };
    if (escTarget === "developers") {
      body.kind = escKind;
      if (escPriority) body.priority = escPriority;
    }
    const ok = await act(async () => {
      // The server escalates tasks, so the complaint uses one hidden task as its carrier:
      // the one already escalated, else an open one, else a new one named after the complaint.
      const list = c.tasks || [];
      let t = list.find((x) => x.escalation) || list.find((x) => !x.is_closed) || list[0];
      if (!t) {
        t = await createComplaintTask({ complaint: c.id, name: c.title.slice(0, 200), goal: "" });
      } else if (t.is_closed) {
        const reopen = STATUSES.find((x) => !x.is_closed);
        if (reopen) await updateComplaintTask(t.id, { status: reopen.value });
      }
      await escalateComplaintTask(t.id, body);
    });
    if (ok) setEscOpen(false);
  };

  // ---------- follow-ups (images, reactions, edit, delete) ----------
  const allFollowups = c.followups || [];
  const followups = allFollowups.filter((f) => f.note !== ISSUE_NOTE);
  const canManageMsg = (f) => admin || (!!f.created_by_name && f.created_by_name === currentUserName());

  const addFiles = (list) => {
    const incoming = Array.from(list || []);
    if (!incoming.length) return;
    const images = incoming.filter((f) => f.type.startsWith("image/"));
    const fit = images.filter((f) => f.size <= MAX_IMAGE_BYTES);
    let msg = "";
    if (images.length < incoming.length) msg = "Only image files can be attached.";
    else if (fit.length < images.length) msg = "Each image must be 10 MB or smaller.";
    else if (files.length + fit.length > MAX_IMAGES) msg = `You can attach up to ${MAX_IMAGES} images.`;
    setFiles((prev) => [...prev, ...fit].slice(0, MAX_IMAGES));
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
    if ((!note.trim() && files.length === 0) || busy) return;
    const ok = await act(() => addFollowup(c.id, note.trim() || IMG_NOTE, files));
    if (ok) {
      setNote("");
      setFiles([]);
    }
  };

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
      setSaveError(errText(err, "Could not save the reaction."));
    }
  };

  const removeFollowup = (f) => {
    if (!window.confirm("Delete this message? This cannot be undone.")) return;
    if (editId === f.id) setEditId(null);
    act(() => deleteFollowup(f.id));
  };

  const startEdit = (f) => {
    setEditId(f.id);
    setEditText(f.note);
  };

  const saveEdit = async () => {
    const text = editText.trim();
    if (!text) return;
    const ok = await act(() => updateFollowup(editId, text));
    if (ok) setEditId(null);
  };

  // ---------- issue images ----------
  const issueImages = [
    ...(c.attachments || []),
    ...allFollowups.filter((f) => f.note === ISSUE_NOTE).flatMap((f) => f.attachments || []),
  ];
  const longDesc = (c.description || "").length > 160 || (c.description || "").split("\n").length > 2;

  const removeAttachment = async (att) => {
    if (!window.confirm("Delete this image?")) return;
    try {
      await deleteAttachment(att.id);
      await refresh();
    } catch (err) {
      setSaveError(errText(err, "Could not delete the image."));
    }
  };

  return (
    <div className="tp mct" key={c.id}>
      <div className="tp-top">
        <Link to={backTo} className="tp-back">
          ← {projectName ? `${projectName} complaints` : "Back to complaints"}
        </Link>
        <div className="tp-top-actions">
          {canSelfAssign && (
            <button type="button" className="tp-btn" onClick={selfAssign}>
              <IconUser />
              Self-assign
            </button>
          )}
          {canEscalate && (
            <button type="button" className="tp-btn" onClick={openEscalate} disabled={busy}>
              <IconEscalate />
              {escRow ? "Escalate again" : "Escalate"}
            </button>
          )}
          {admin && (
            <Link to={`/complaints/${c.id}`} className="tp-btn">
              <IconEdit />
              Full details
            </Link>
          )}
          <button type="button" className="tp-btn" onClick={() => setShowLog(true)}>
            <IconHistory />
            History
          </button>
        </div>
      </div>

      <div className="tp-page">
        {/* ---------- Header ---------- */}
        <h1 className="mct-title">{c.title}</h1>
        <p className="tp-sub">
          Created {new Date(c.created_at).toLocaleString()}
          {c.created_by_name ? ` by ${c.created_by_name}` : ""}
        </p>

        {saveError && (
          <div className="tp-alert" role="alert">
            {saveError}
          </div>
        )}
        {readOnly && (
          <div className="tp-alert" role="status">
            {c.assigned_to
              ? `Assigned to ${c.assigned_to_name}. Only the assignee, helpers or whoever filed this complaint can change it - you can still add follow-ups.`
              : "You can view this complaint. Self-assign it to change its status and escalate it."}
          </div>
        )}

        {c.urgent && (
          <div className="tp-banner" role="status">
            <span className="tp-dot" aria-hidden="true" />
            <div>
              <strong>New complaint{c.created_by_name ? ` from ${c.created_by_name}` : ""}</strong>
              <span>Read the issue below and check the attached images before you start.</span>
            </div>
          </div>
        )}

        <div className="mct-grid">
          <div className="mct-main">
            {/* ---------- Issue: small note ---------- */}
            <section className="mct-issue" aria-label="Issue and customer">
              <div className="mct-issue-top">
                <h3>Issue</h3>
                {issueImages.length > 0 && (
                  <span className="tp-count">
                    {issueImages.length} image{issueImages.length === 1 ? "" : "s"}
                  </span>
                )}
                <ul className="mct-chips">
                  {admin && (
                    <li
                      title={
                        (c.helpers_names || []).length > 0
                          ? `Helpers: ${c.helpers_names.join(", ")}`
                          : "Assigned to"
                      }
                    >
                      <span className="mct-chip-av" aria-hidden="true">
                        {initials(c.assigned_to_name) || "?"}
                      </span>
                      {c.assigned_to_name ? (
                        <>
                          Assigned to{" "}
                          <b style={{ color: "#d92d20", fontWeight: 700 }}>{c.assigned_to_name}</b>
                        </>
                      ) : (
                        "Unassigned"
                      )}
                      {(c.helpers_names || []).length > 0 ? ` +${c.helpers_names.length}` : ""}
                    </li>
                  )}
                  <li title="Customer">
                    <span className="mct-chip-av" aria-hidden="true">
                      {initials(c.customer) || "?"}
                    </span>
                    {c.customer || "No customer name"}
                  </li>
                  <li title="Phone">
                    <IconPhone />
                    {c.phone || "No phone"}
                  </li>
                </ul>
              </div>

              {c.description ? (
                <p className={`mct-desc ${longDesc && !descOpen ? "is-clamped" : ""}`}>{c.description}</p>
              ) : (
                <p className="mct-muted">No description was added.</p>
              )}
              {longDesc && (
                <button type="button" className="mct-more" onClick={() => setDescOpen((o) => !o)}>
                  {descOpen ? "Show less" : "Show more"}
                </button>
              )}
              {issueImages.length > 0 && <Gallery items={issueImages} onDelete={admin ? removeAttachment : undefined} size={56} />}
            </section>

            {/* ---------- Status: the complaint's own progress ---------- */}
            <section className="mct-block" aria-label="Status">
              <div className="mct-block-head">
                <h2 className="mct-h">Status</h2>
                {canEdit ? (
                  <select
                    className={`mct-pill is-${toneOf(c.status)}`}
                    value={c.status}
                    onChange={(e) => setStatus(e.target.value)}
                    disabled={busy}
                    aria-label="Complaint status"
                  >
                    {STATUSES.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className={`mct-pill is-${toneOf(c.status)}`}>{statusOf(c.status)?.label || c.status}</span>
                )}
                {esc && (
                  <span className={`mct-esc-badge ${esc.tone}`} title={esc.title}>
                    <IconEscalate />
                    {esc.text}
                  </span>
                )}
              </div>
              {escRow && escRow.escalated_by_name && (
                <p className="mct-muted">
                  Escalated by {escRow.escalated_by_name}
                  {escRow.escalated_at ? ` on ${new Date(escRow.escalated_at).toLocaleDateString()}` : ""}
                  {escRow.escalation_note ? ` — ${escRow.escalation_note}` : ""}
                </p>
              )}
            </section>

            {/* ---------- Follow-ups: the only conversation ---------- */}
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
                              <IconSmile size={15} />
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
                            <IconSmile size={15} />
                          </button>
                          {canManageMsg(f) && (
                            <>
                              <span className="tp-sep" aria-hidden="true" />
                              {!imageOnly && (
                                <button type="button" title="Edit" aria-label="Edit message" onClick={() => startEdit(f)}>
                                  <IconEdit size={15} />
                                </button>
                              )}
                              <button
                                type="button"
                                className="is-danger"
                                title="Delete"
                                aria-label="Delete message"
                                onClick={() => removeFollowup(f)}
                              >
                                <IconTrash size={15} />
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
                    <AttachButton ghost onPick={addFiles} disabled={busy || files.length >= MAX_IMAGES} />
                    <span className="tp-composer-hint">
                      Enter to send, Shift + Enter for a new line. Up to {MAX_IMAGES} images, or paste with Ctrl+V.
                    </span>
                    <button
                      className="tp-send"
                      type="submit"
                      title="Add follow-up"
                      aria-label={busy ? "Adding follow-up" : "Add follow-up"}
                      disabled={(!note.trim() && files.length === 0) || busy}
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
        </div>
      </div>

      {escOpen && (
        <div className="mct-modal-bg" onMouseDown={(e) => e.target === e.currentTarget && closeEscalate()}>
          <form className="mct-modal mct-esc" role="dialog" aria-modal="true" aria-labelledby="mct-esc-title" onSubmit={submitEscalate}>
            <h2 id="mct-esc-title" className="mct-modal-title">
              Escalate complaint
            </h2>
            <p className="mct-esc-task">“{c.title}”</p>

            <span className="mct-modal-lbl">Escalate to</span>
            <div className="mct-esc-options" role="radiogroup" aria-label="Escalate to">
              <label className={`mct-esc-opt ${escTarget === "developers" ? "is-on" : ""} ${devsReady ? "" : "is-off"}`}>
                <input
                  type="radio"
                  name="esc-target"
                  value="developers"
                  checked={escTarget === "developers"}
                  disabled={!devsReady}
                  onChange={() => setEscTarget("developers")}
                />
                <span>
                  <b>Developer team</b>
                  <small>{devHint}</small>
                </span>
              </label>
              {!admin && (
                <label className={`mct-esc-opt ${escTarget === "admin" ? "is-on" : ""}`}>
                  <input
                    type="radio"
                    name="esc-target"
                    value="admin"
                    checked={escTarget === "admin"}
                    onChange={() => setEscTarget("admin")}
                  />
                  <span>
                    <b>Admin</b>
                    <small>The admin is notified and can step in.</small>
                  </span>
                </label>
              )}
            </div>

            {escTarget === "developers" && (
              <div className="mct-esc-row">
                <div>
                  <label className="mct-modal-lbl" htmlFor="mct-esc-kind">
                    Type
                  </label>
                  <select id="mct-esc-kind" className="mct-modal-input" value={escKind} onChange={(e) => setEscKind(e.target.value)}>
                    <option value="bug">Bug</option>
                    <option value="task">Task</option>
                  </select>
                </div>
                <div>
                  <label className="mct-modal-lbl" htmlFor="mct-esc-prio">
                    Priority
                  </label>
                  <select id="mct-esc-prio" className="mct-modal-input" value={escPriority} onChange={(e) => setEscPriority(e.target.value)}>
                    {PRIORITIES.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <label className="mct-modal-lbl" htmlFor="mct-esc-note">
              Note <span>(optional)</span>
            </label>
            <textarea
              id="mct-esc-note"
              className="mct-modal-input mct-esc-note"
              value={escNote}
              onChange={(e) => setEscNote(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder={escTarget === "developers" ? "What do the developers need to know?" : "Why does the admin need to step in?"}
            />
            {escTarget === "developers" && (
              <p className="mct-esc-privacy">The customer’s name and phone are never sent to developers.</p>
            )}

            {saveError && (
              <p className="mct-esc-err" role="alert">
                {saveError}
              </p>
            )}
            <div className="mct-modal-actions">
              <button type="button" className="mct-btn is-ghost" onClick={closeEscalate}>
                Cancel
              </button>
              <button type="submit" className="mct-btn" disabled={busy || (escTarget === "developers" && !devsReady)}>
                Escalate
              </button>
            </div>
          </form>
        </div>
      )}

      {showLog && <HistoryDrawer complaint={c} onClose={() => setShowLog(false)} />}
    </div>
  );
}