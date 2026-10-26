import { useEffect, useRef, useState } from "react";
import {
  addFollowup,
  deleteAttachment,
  deleteFollowup,
  getComplaint,
  updateComplaint,
  updateFollowup,
} from "../api/complaints";
import { getSprints } from "../api/sprints";
import { STATUSES, PRIORITIES, CATEGORIES } from "../constants";
import HelpersField from "./HelpersField";
import "./EditComplaintModal.scss";

const MAX_IMAGES = 5;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

const initials = (name = "") =>
  name
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

const icon = {
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

// Small image grid used for existing and pending pictures.
function Thumbs({ items, onRemove, removeLabel }) {
  if (!items.length) return null;
  return (
    <ul className="ec-thumbs">
      {items.map((it) => (
        <li key={it.key} className="ec-thumb">
          {it.href ? (
            <a href={it.href} target="_blank" rel="noreferrer" title={it.name || "Open image"}>
              <img src={it.src} alt={it.name || "Attached image"} loading="lazy" />
            </a>
          ) : (
            <img src={it.src} alt={it.name || "Selected image"} />
          )}
          {onRemove && it.removable !== false && (
            <button
              type="button"
              className="ec-thumb-x"
              aria-label={removeLabel}
              title={removeLabel}
              onClick={() => onRemove(it)}
            >
              <svg {...icon} width={12} height={12} strokeWidth={2.4}>
                <line x1="6" y1="6" x2="18" y2="18" />
                <line x1="18" y1="6" x2="6" y2="18" />
              </svg>
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

export default function EditComplaintModal({ complaint, team, onClose, onSaved }) {
  const [form, setForm] = useState({
    title: complaint.title || "",
    description: complaint.description || "",
    customer: complaint.customer || "",
    phone: complaint.phone || "",
    category: complaint.category || "General",
    priority: complaint.priority || "medium",
    status: complaint.status || "open",
    assigned_to: complaint.assigned_to ?? "",
    helpers: complaint.helpers || [],
    due_date: complaint.due_date || "",
    sprint: complaint.sprint ?? "",
  });
  const [followups, setFollowups] = useState(complaint.followups || []);
  const [attachments, setAttachments] = useState(complaint.attachments || []);
  const [sprints, setSprints] = useState([]); // sprints of this case's project
  const [note, setNote] = useState("");
  const [editFid, setEditFid] = useState(null);
  const [editNote, setEditNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [picked, setPicked] = useState([]); // images chosen but not uploaded yet: {key, file, src}
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef(null);
  const pickedRef = useRef([]);
  pickedRef.current = picked;

  // Sprints only exist for support cases.
  const isCase = complaint.kind === "complaint";

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Keep the page behind the modal from scrolling.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Free the preview URLs when the modal closes.
  useEffect(
    () => () => pickedRef.current.forEach((p) => URL.revokeObjectURL(p.src)),
    []
  );

  // Load the sprints of this case's project for the Sprint select.
  useEffect(() => {
    if (!isCase || !complaint.project) return;
    getSprints({ project: complaint.project })
      .then(setSprints)
      .catch(() => setSprints([]));
  }, [isCase, complaint.project]);

  const change = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  const setField = (name, value) => setForm((f) => ({ ...f, [name]: value }));

  // ---------- images ----------
  const addFiles = (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    const room = MAX_IMAGES - picked.length;
    const next = [];
    let problem = "";
    for (const f of files) {
      if (!IMAGE_TYPES.includes(f.type)) {
        problem = "Only JPG, PNG, GIF or WebP images are allowed.";
      } else if (f.size > MAX_IMAGE_BYTES) {
        problem = "Each image must be 10 MB or smaller.";
      } else if (next.length >= room) {
        problem = `You can add up to ${MAX_IMAGES} images at a time.`;
      } else {
        next.push({
          key: `${f.name}-${f.size}-${f.lastModified}-${Math.random().toString(36).slice(2, 7)}`,
          file: f,
          src: URL.createObjectURL(f),
        });
      }
    }
    setError(problem);
    if (next.length) setPicked((p) => [...p, ...next]);
    if (fileRef.current) fileRef.current.value = "";
  };

  const dropPicked = (item) => {
    URL.revokeObjectURL(item.src);
    setPicked((p) => p.filter((x) => x.key !== item.key));
  };

  const clearPicked = () => {
    pickedRef.current.forEach((p) => URL.revokeObjectURL(p.src));
    setPicked([]);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    addFiles(e.dataTransfer?.files);
  };

  const onPaste = (e) => {
    const files = Array.from(e.clipboardData?.files || []).filter((f) => f.type.startsWith("image/"));
    if (files.length) {
      e.preventDefault();
      addFiles(files);
    }
  };

  const syncFollowups = async () => {
    const fresh = await getComplaint(complaint.id);
    setFollowups(fresh.followups || []);
    setAttachments(fresh.attachments || []);
    onSaved(fresh);
  };

  const uploadPicked = async () => {
    if (!picked.length) return;
    await addFollowup(
      complaint.id,
      "",
      picked.map((p) => p.file)
    );
    clearPicked();
  };

  const uploadNow = async () => {
    setUploading(true);
    setError("");
    try {
      await uploadPicked();
      await syncFollowups();
    } catch (err) {
      const msg = err?.response?.data?.images;
      setError((Array.isArray(msg) ? msg[0] : msg) || "Could not upload the images.");
    } finally {
      setUploading(false);
    }
  };

  const removeImage = async (item) => {
    if (!window.confirm("Delete this image?")) return;
    try {
      await deleteAttachment(item.id);
      await syncFollowups();
    } catch {
      setError("Could not delete the image.");
    }
  };

  // ---------- save ----------
  const save = async () => {
    if (saving) return;
    if (!form.title.trim()) {
      setError("Title is required");
      return;
    }
    setSaving(true);
    setError("");
    try {
      // A note typed but not yet added would be lost on save, so add it now.
      if (note.trim()) {
        await addFollowup(complaint.id, note);
        setNote("");
      }
      // Same for images that were chosen but not uploaded.
      await uploadPicked();
      const { sprint, ...rest } = form;
      const updated = await updateComplaint(complaint.id, {
        ...rest,
        assigned_to: form.assigned_to || null,
        due_date: form.due_date || null,
        // sprint belongs to support cases only
        ...(isCase ? { sprint: sprint ? Number(sprint) : null } : {}),
      });
      onSaved(updated);
      onClose();
    } catch (err) {
      const d = err?.response?.data;
      const sprintErr = d?.sprint;
      setError(
        (Array.isArray(sprintErr) ? sprintErr[0] : sprintErr) || "Could not save the changes."
      );
      setSaving(false);
    }
  };

  const onModalKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      save();
    }
  };

  const addNote = async () => {
    if (!note.trim()) return;
    try {
      await addFollowup(complaint.id, note);
      setNote("");
      await syncFollowups();
    } catch {
      setError("Could not add the follow-up.");
    }
  };

  const startEditNote = (f) => {
    setEditFid(f.id);
    setEditNote(f.note);
  };

  const saveNote = async () => {
    if (!editNote.trim()) return;
    try {
      await updateFollowup(editFid, editNote);
      setEditFid(null);
      await syncFollowups();
    } catch {
      setError("Could not update the follow-up.");
    }
  };

  const removeNote = async (f) => {
    if (!window.confirm("Delete this follow-up?")) return;
    try {
      await deleteFollowup(f.id);
      await syncFollowups();
    } catch {
      setError("Could not delete the follow-up.");
    }
  };

  const titleError = error === "Title is required";
  const statusList = STATUSES.some((s) => s.value === form.status)
    ? STATUSES
    : [...STATUSES, { value: form.status, label: form.status }];
  const priorityList = PRIORITIES.some((p) => p.value === form.priority)
    ? PRIORITIES
    : [...PRIORITIES, { value: form.priority, label: form.priority }];

  // Open sprints, plus the one the case is already in (even if it has been completed).
  const currentSprintId = Number(form.sprint) || null;
  const sprintOptions = sprints.filter((s) => s.status !== "completed" || s.id === currentSprintId);
  if (currentSprintId && !sprintOptions.some((s) => s.id === currentSprintId)) {
    sprintOptions.push({ id: currentSprintId, name: complaint.sprint_name || "Sprint", status: "planned" });
  }
  const inClosedSprint = sprints.find((s) => s.id === complaint.sprint)?.status === "completed";

  const savedImages = attachments.map((a) => ({
    key: `a-${a.id}`,
    id: a.id,
    src: a.url,
    href: a.url,
    name: a.name,
    removable: a.can_delete !== false,
  }));
  const pickedImages = picked.map((p) => ({ key: p.key, src: p.src, name: p.file.name, ...p }));

  return (
    <div className="ec-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        className="ec-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ec-title-h"
        onKeyDown={onModalKeyDown}
      >
        <div className="ec-head">
          <div className="ec-head-text">
            <h3 id="ec-title-h">Edit task</h3>
            {(complaint.task_number || complaint.project_name) && (
              <p className="ec-head-meta">
                {complaint.task_number && <span>{complaint.task_number}</span>}
                {complaint.project_name && <span>{complaint.project_name}</span>}
              </p>
            )}
          </div>
          <button type="button" className="ec-x" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <line x1="6" y1="6" x2="18" y2="18" />
              <line x1="18" y1="6" x2="6" y2="18" />
            </svg>
          </button>
        </div>

        <div className="ec-body">
          {error && !titleError && <div className="ec-alert" role="alert">{error}</div>}

          {/* ---------- 1. Details ---------- */}
          <section className="ec-section" aria-labelledby="ec-sec-details">
            <h4 className="ec-section-title" id="ec-sec-details">Details</h4>

            <div className="ec-field">
              <label htmlFor="ec-title">
                Title <span className="ec-req">*</span>
              </label>
              <input
                id="ec-title"
                name="title"
                value={form.title}
                onChange={change}
                className={titleError ? "has-error" : ""}
                aria-invalid={titleError ? "true" : "false"}
                aria-describedby={titleError ? "ec-title-err" : undefined}
              />
              {titleError && (
                <small id="ec-title-err" className="ec-err" role="alert">
                  Add a title before saving.
                </small>
              )}
            </div>

            <div className="ec-field">
              <span className="ec-label" id="ec-status-l">Status</span>
              <div className="ec-pills" role="radiogroup" aria-labelledby="ec-status-l">
                {statusList.map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    role="radio"
                    aria-checked={form.status === s.value}
                    className={`ec-pill ${form.status === s.value ? "on" : ""}`}
                    onClick={() => setField("status", s.value)}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="ec-field">
              <span className="ec-label" id="ec-priority-l">Priority</span>
              <div className="ec-pills" role="radiogroup" aria-labelledby="ec-priority-l">
                {priorityList.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    role="radio"
                    aria-checked={form.priority === p.value}
                    className={`ec-pill ${form.priority === p.value ? "on" : ""}`}
                    onClick={() => setField("priority", p.value)}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="ec-grid">
              <div className="ec-field">
                <label htmlFor="ec-assigned">Assign to</label>
                <select id="ec-assigned" name="assigned_to" value={form.assigned_to} onChange={change}>
                  <option value="">Unassigned</option>
                  {team.map((t) => (
                    <option key={t.id} value={t.id}>{t.full_name}</option>
                  ))}
                </select>
              </div>
              {isCase && (
                <div className="ec-field">
                  <label htmlFor="ec-sprint">Sprint</label>
                  <select
                    id="ec-sprint"
                    name="sprint"
                    value={form.sprint}
                    onChange={change}
                    disabled={inClosedSprint}
                    title={inClosedSprint ? "This sprint is completed" : undefined}
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
              )}
              <div className="ec-field">
                <label htmlFor="ec-due">Due date</label>
                <input id="ec-due" type="date" name="due_date" value={form.due_date} onChange={change} />
              </div>
              <div className="ec-field">
                <label htmlFor="ec-category">Category</label>
                <select id="ec-category" name="category" value={form.category} onChange={change}>
                  {[...new Set([...CATEGORIES, form.category])].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </div>
              <div className="ec-field">
                <label htmlFor="ec-customer">Customer</label>
                <input id="ec-customer" name="customer" value={form.customer} onChange={change} />
              </div>
              <div className="ec-field">
                <label htmlFor="ec-phone">Phone</label>
                <input id="ec-phone" name="phone" inputMode="tel" value={form.phone} onChange={change} />
              </div>
            </div>

            <div className="ec-field">
              <span className="ec-label">Helpers</span>
              <HelpersField
                team={team}
                value={form.helpers}
                excludeId={form.assigned_to}
                onChange={(ids) => setForm((f) => ({ ...f, helpers: ids }))}
              />
            </div>
          </section>

          {/* ---------- 2. Description and images ---------- */}
          <section className="ec-section" aria-labelledby="ec-sec-desc">
            <h4 className="ec-section-title" id="ec-sec-desc">Description and images</h4>

            <div className="ec-field">
              <label htmlFor="ec-description" className="ec-sr">Description</label>
              <textarea
                id="ec-description"
                name="description"
                rows="4"
                placeholder="What is the problem? Add steps, error messages or anything the assignee should know."
                value={form.description}
                onChange={change}
                onPaste={onPaste}
              />
            </div>

            <Thumbs items={savedImages} onRemove={removeImage} removeLabel="Delete image" />

            <div
              className={`ec-drop ${dragOver ? "over" : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
            >
              <input
                ref={fileRef}
                id="ec-files"
                type="file"
                accept={IMAGE_TYPES.join(",")}
                multiple
                className="ec-sr"
                onChange={(e) => addFiles(e.target.files)}
                disabled={picked.length >= MAX_IMAGES}
              />
              <label htmlFor="ec-files" className="ec-drop-btn">
                <svg {...icon}>
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <path d="m21 15-5-5L5 21" />
                </svg>
                Add images
              </label>
              <span className="ec-drop-hint">
                or drop or paste them here. Up to {MAX_IMAGES}, 10 MB each.
              </span>
            </div>

            {picked.length > 0 && (
              <div className="ec-picked">
                <Thumbs items={pickedImages} onRemove={dropPicked} removeLabel="Remove image" />
                <div className="ec-picked-bar">
                  <span>{picked.length} image{picked.length === 1 ? "" : "s"} ready</span>
                  <button
                    type="button"
                    className="ec-btn ec-btn-primary ec-btn-sm"
                    onClick={uploadNow}
                    disabled={uploading || saving}
                  >
                    {uploading ? "Uploading..." : "Upload now"}
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* ---------- 3. Follow-ups ---------- */}
          <section className="ec-section" aria-labelledby="ec-sec-follow">
            <h4 className="ec-section-title" id="ec-sec-follow">
              Follow-ups <span className="ec-sub-count">{followups.length}</span>
            </h4>

            <div className="ec-add">
              <input
                placeholder="Add follow-up note..."
                aria-label="Follow-up note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                onKeyDown={(e) =>
                  e.key === "Enter" && !(e.ctrlKey || e.metaKey) && (e.preventDefault(), addNote())
                }
              />
              <button
                type="button"
                className="ec-btn ec-btn-primary"
                onClick={addNote}
                disabled={!note.trim()}
              >
                Add
              </button>
            </div>

            <ul className="ec-notes">
              {followups.map((f) => {
                const imgs = (f.attachments || []).map((a) => ({
                  key: `f-${a.id}`,
                  id: a.id,
                  src: a.url,
                  href: a.url,
                  name: a.name,
                  removable: a.can_delete !== false,
                }));
                const imageOnly = f.note === "(image)" && imgs.length > 0;
                return (
                  <li key={f.id}>
                    {editFid === f.id ? (
                      <div className="ec-note-edit">
                        <textarea
                          rows="2"
                          value={editNote}
                          onChange={(e) => setEditNote(e.target.value)}
                          aria-label="Edit follow-up note"
                          autoFocus
                        />
                        <div className="ec-note-btns">
                          <button type="button" className="ec-btn ec-btn-primary" onClick={saveNote}>
                            Save
                          </button>
                          <button type="button" className="ec-btn ec-btn-ghost" onClick={() => setEditFid(null)}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <span className="ec-note-avatar" aria-hidden="true">
                          {initials(f.created_by_name) || "•"}
                        </span>
                        <div className="ec-note-text">
                          {!imageOnly && <div>{f.note}</div>}
                          <Thumbs items={imgs} onRemove={removeImage} removeLabel="Delete image" />
                          <small>
                            {f.created_by_name ? `${f.created_by_name} • ` : ""}
                            {new Date(f.created_at).toLocaleString()}
                          </small>
                        </div>
                        {!imageOnly && (
                          <div className="ec-note-actions">
                            <button
                              type="button"
                              className="ec-icon"
                              title="Edit follow-up"
                              aria-label="Edit follow-up"
                              onClick={() => startEditNote(f)}
                            >
                              <svg {...icon}>
                                <path d="M12 20h9" />
                                <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              className="ec-icon ec-icon-danger"
                              title="Delete follow-up"
                              aria-label="Delete follow-up"
                              onClick={() => removeNote(f)}
                            >
                              <svg {...icon}>
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                                <path d="M10 11v6M14 11v6" />
                                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                              </svg>
                            </button>
                          </div>
                        )}
                        {imageOnly && (
                          <div className="ec-note-actions">
                            <button
                              type="button"
                              className="ec-icon ec-icon-danger"
                              title="Delete follow-up"
                              aria-label="Delete follow-up"
                              onClick={() => removeNote(f)}
                            >
                              <svg {...icon}>
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                                <path d="M10 11v6M14 11v6" />
                                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                              </svg>
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </li>
                );
              })}
              {followups.length === 0 && <li className="ec-empty">No follow-ups yet</li>}
            </ul>
          </section>
        </div>

        <div className="ec-foot">
          <span className="ec-foot-tip">Ctrl + Enter to save</span>
          <button type="button" className="ec-btn ec-btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="ec-btn ec-btn-primary" onClick={save} disabled={saving || uploading}>
            {saving ? "Saving..." : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}