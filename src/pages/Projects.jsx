import { Fragment, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { getTeam } from "../api/complaints";
import {
  createProject,
  deleteProject,
  getProjects,
  updateProject,
} from "../api/projects";
import { createSection, deleteSection, getSections, updateSection } from "../api/sections";
import { applyProjects } from "../projects";
import ProjectHistoryDrawer from "./ProjectHistoryDrawer";
import "./Projects.scss";

const initials = (name = "") =>
  name.split(" ").filter(Boolean).map((w) => w[0]).join("").slice(0, 2).toUpperCase();

const errText = (err, fallback) => {
  const d = err?.response?.data;
  if (!d || typeof d === "string") return fallback;
  if (d.detail) return d.detail;
  const first = Object.values(d)[0];
  return (Array.isArray(first) ? first[0] : first) || fallback;
};

const COL_WIDTHS = [26, 8, 8, 30, 12, 16];
const HEADS = ["Project", "Tasks", "Open", "Members", "Created", "Actions"];
const colgroup = (
  <colgroup>
    {COL_WIDTHS.map((w, i) => (
      <col key={i} style={{ width: `${w}%` }} />
    ))}
  </colgroup>
);

const fmtDate = (d) => {
  if (!d) return "—";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
};

const ico = {
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

const icons = {
  plus: (
    <svg {...ico} strokeWidth={2}>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  ),
  history: (
    <svg {...ico}>
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 15.5 14" />
    </svg>
  ),
  sections: (
    <svg {...ico}>
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </svg>
  ),
  edit: (
    <svg {...ico}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  ),
  trash: (
    <svg {...ico}>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  ),
};

const SECTIONS = [
  {
    kind: "development",
    label: "Development",
    title: "Development projects",
    hint: "Tasks and bugs, worked on by developers",
    add: "Add development project",
  },
  {
    kind: "support",
    label: "Support",
    title: "Support projects",
    hint: "Complaints, handled by support staff",
    add: "Add support project",
  },
];

// Admin adds, renames and deletes the working sections of a development project
// (e.g. "Shift Management"). Developers then add their tasks under them.
function SectionsModal({ project, team = [], onClose, onChanged }) {
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState("");
  const [ownersFor, setOwnersFor] = useState(null); // section whose owner list is open
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

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

  const load = async () => {
    const list = await getSections({ project: project.id });
    setSections(list);
  };

  useEffect(() => {
    load()
      .catch(() => setError("Could not load the sections."))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id]);

  const run = async (fn) => {
    setBusy(true);
    setError("");
    try {
      await fn();
      await load();
      await onChanged(); // keep the project list (and the pickers) in sync
    } catch (err) {
      setError(errText(err, "Something went wrong."));
    }
    setBusy(false);
  };

  const add = (e) => {
    e.preventDefault();
    const value = name.trim();
    if (!value) return;
    run(async () => {
      await createSection({ project: project.id, name: value });
      setName("");
    });
  };

  const saveEdit = (sec) => {
    const value = editName.trim();
    if (!value || value === sec.name) {
      setEditId(null);
      return;
    }
    run(async () => {
      await updateSection(sec.id, { name: value });
      setEditId(null);
    });
  };

  // Who can own a section: developers who are members of this project.
  const candidates = team.filter(
    (t) => (project.members || []).includes(t.id) && (!t.access || ["developer", "both"].includes(t.access))
  );

  const toggleOwner = (sec, memberId) => {
    const cur = sec.owners || [];
    const next = cur.includes(memberId) ? cur.filter((x) => x !== memberId) : [...cur, memberId];
    run(() => updateSection(sec.id, { owners: next }));
  };

  const remove = (sec) => {
    const n = sec.task_count ?? 0;
    const warn = n
      ? `Delete the section "${sec.name}"? Its ${n} task${n === 1 ? "" : "s"} will stay in the project without a section.`
      : `Delete the section "${sec.name}"?`;
    if (!window.confirm(warn)) return;
    run(() => deleteSection(sec.id));
  };

  return createPortal(
    <div className="pj-overlay" onClick={onClose}>
      <div
        className="pj-modal pj-sec-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`Sections of ${project.name}`}
        onClick={(e) => e.stopPropagation()}
      >
        <h2>Sections · {project.name}</h2>
        <p className="pj-sec-lead">
          Sections are the working areas of this project, for example "Shift Management". Developers
          add their tasks under a section.
        </p>

        {error && <div className="pj-sec-err">{error}</div>}

        <form className="pj-sec-add" onSubmit={add}>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="New section name"
            maxLength={150}
            aria-label="New section name"
          />
          <button type="submit" className="pj-btn pj-btn-primary" disabled={busy || !name.trim()}>
            Add section
          </button>
        </form>

        {loading ? (
          <p className="pj-muted">Loading...</p>
        ) : sections.length === 0 ? (
          <div className="pj-sec-list">
            <p className="pj-sec-empty">No sections yet. Add the first one above.</p>
          </div>
        ) : (
          <ul className="pj-sec-list">
            {sections.map((sec) => (
              <Fragment key={sec.id}>
              <li className="pj-sec-item">
                {editId === sec.id ? (
                  <input
                    autoFocus
                    value={editName}
                    maxLength={150}
                    aria-label={`Rename ${sec.name}`}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        saveEdit(sec);
                      }
                      if (e.key === "Escape") {
                        e.stopPropagation();
                        setEditId(null);
                      }
                    }}
                    onBlur={() => saveEdit(sec)}
                  />
                ) : (
                  <span className="pj-sec-name">
                    {sec.name}
                    <small style={{ display: "block", fontWeight: 400, opacity: 0.7 }}>
                      {(sec.owner_names || []).length > 0
                        ? `Owners: ${sec.owner_names.join(", ")}`
                        : "No owners yet"}
                    </small>
                  </span>
                )}
                <span className="pj-sec-count">
                  {sec.task_count ?? 0} task{(sec.task_count ?? 0) === 1 ? "" : "s"}
                </span>
                <button
                  type="button"
                  className="pj-icon"
                  title="Choose who owns this section"
                  aria-expanded={ownersFor === sec.id}
                  style={{ width: "auto", padding: "0 10px", fontSize: 12, fontWeight: 600 }}
                  disabled={busy}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setOwnersFor(ownersFor === sec.id ? null : sec.id)}
                >
                  Owners
                </button>
                <button
                  type="button"
                  className="pj-icon"
                  title="Rename"
                  aria-label={`Rename ${sec.name}`}
                  disabled={busy}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setEditId(sec.id);
                    setEditName(sec.name);
                  }}
                >
                  {icons.edit}
                </button>
                <button
                  type="button"
                  className="pj-icon pj-icon-danger"
                  title="Delete"
                  aria-label={`Delete ${sec.name}`}
                  disabled={busy}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => remove(sec)}
                >
                  {icons.trash}
                </button>
              </li>
              {ownersFor === sec.id && (
                <li
                  className="pj-sec-owners"
                  style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px", padding: "2px 12px 12px", listStyle: "none" }}
                >
                  {candidates.length === 0 ? (
                    <small>Add developers to this project first.</small>
                  ) : (
                    candidates.map((m) => (
                      <label key={m.id} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={(sec.owners || []).includes(m.id)}
                          disabled={busy}
                          onChange={() => toggleOwner(sec, m.id)}
                        />
                        {m.full_name}
                      </label>
                    ))
                  )}
                </li>
              )}
              </Fragment>
            ))}
          </ul>
        )}

        <div className="pj-actions">
          <button type="button" className="pj-btn" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function ProjectModal({ project, projects = [], team, kind: kindProp, onClose, onSaved }) {
  const isNew = !project;
  const kind = project?.kind || kindProp || "development";
  const kindWord = kind === "support" ? "support" : "development";
  // Support projects hold support staff, development projects hold developers.
  const side = kind === "support" ? ["support", "both"] : ["developer", "both"];
  const people = team.filter((t) => !t.access || side.includes(t.access));
  // Development and support are two sides of one project (same name = the pair).
  // When adding a new project, offer the other side's projects that have no partner yet.
  const otherKind = kind === "support" ? "development" : "support";
  const kindOf = (p) => p.kind || "development";
  const unpaired = !project
    ? projects.filter(
        (p) =>
          kindOf(p) === otherKind &&
          !projects.some(
            (q) => kindOf(q) === kind && q.name.toLowerCase() === p.name.toLowerCase()
          )
      )
    : [];
  const [name, setName] = useState(project?.name || "");
  // true = the admin chose "New project" in the dropdown and types a fresh name
  const [typing, setTyping] = useState(false);
  const [members, setMembers] = useState((project?.members || []).map(Number));
  const [filter, setFilter] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

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

  const shown = people.filter((t) =>
    t.full_name.toLowerCase().includes(filter.trim().toLowerCase())
  );
  const toggle = (id) =>
    setMembers((m) => (m.includes(id) ? m.filter((x) => x !== id) : [...m, id]));
  const allShownChosen = shown.length > 0 && shown.every((t) => members.includes(t.id));
  const toggleAll = () =>
    setMembers((m) =>
      allShownChosen
        ? m.filter((id) => !shown.some((t) => t.id === id))
        : [...new Set([...m, ...shown.map((t) => t.id)])]
    );

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Project name is required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const payload = { name: name.trim(), members };
      if (isNew) payload.kind = kind;
      if (isNew) await createProject(payload);
      else await updateProject(project.id, payload);
      await onSaved();
    } catch (err) {
      setError(errText(err, "Could not save the project."));
      setSaving(false);
    }
  };

  return createPortal(
    <div className="pj-overlay" onClick={onClose}>
      <form
        className="pj-modal"
        role="dialog"
        aria-modal="true"
        aria-label={isNew ? `Add ${kindWord} project` : "Edit project"}
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
      >
        <h2>{isNew ? `Add ${kindWord} project` : "Edit project"}</h2>

        {error && <div className="pj-alert">{error}</div>}

        {unpaired.length > 0 ? (
          <div className="pj-field">
            <span>Project name</span>
            <select
              autoFocus
              value={typing ? "__new__" : unpaired.some((p) => p.name === name) ? name : ""}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "__new__") {
                  setTyping(true);
                  setName("");
                } else {
                  setTyping(false);
                  setName(v);
                }
              }}
              aria-label="Project name"
            >
              <option value="" disabled>
                Choose a project...
              </option>
              {unpaired.map((p) => (
                <option key={p.id} value={p.name}>
                  {p.name}
                </option>
              ))}
              <option value="__new__">+ New project (type a name)</option>
            </select>
            {typing && (
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Website redesign"
                maxLength={150}
                aria-label="New project name"
              />
            )}
            <small className="pj-hint">
              The list shows {otherKind} projects that have no {kindWord} partner yet. Pick one to
              pair with it (same name = the two sides of one project), or choose "New project".
            </small>
          </div>
        ) : (
          <label className="pj-field">
            <span>Project name</span>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Website redesign"
              maxLength={150}
            />
          </label>
        )}

        <div className="pj-field">
          <span>
            Members <em>({members.length} selected)</em>
          </span>
          <div className="pj-pick-tools">
            <input
              type="search"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Search people..."
              aria-label="Search people"
            />
            <button type="button" className="pj-link" onClick={toggleAll}>
              {allShownChosen ? "Clear" : "Select all"}
            </button>
          </div>
          <ul className="pj-pick">
            {shown.map((t) => (
              <li key={t.id}>
                <label className={members.includes(t.id) ? "on" : ""}>
                  <input
                    type="checkbox"
                    checked={members.includes(t.id)}
                    onChange={() => toggle(t.id)}
                  />
                  <span className="pj-av" aria-hidden="true">{initials(t.full_name)}</span>
                  <span className="pj-pick-name">{t.full_name}</span>
                  {t.access && (
                    <small style={{ marginLeft: "auto", opacity: 0.65, fontSize: 12 }}>
                      {t.access === "support" ? "Support" : t.access === "both" ? "Both" : "Developer"}
                    </small>
                  )}
                </label>
              </li>
            ))}
            {shown.length === 0 && <li className="pj-empty-row">No people found</li>}
          </ul>
          <small className="pj-hint">
            Everyone you add gets a notification. Only members can see the project.{" "}
            {kind === "support"
              ? "Only support staff can be added; they see its complaints."
              : "Only developers can be added; they see its tasks and bugs."}
          </small>
        </div>

        <div className="pj-actions">
          <button type="button" className="pj-btn" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" className="pj-btn pj-btn-primary" disabled={saving}>
            {saving ? "Saving..." : isNew ? "Create project" : "Save changes"}
          </button>
        </div>
      </form>
    </div>,
    document.body
  );
}

export default function Projects() {
  const [projects, setProjects] = useState([]);
  const [team, setTeam] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modal, setModal] = useState(null); // null | "new" | project object
  const [historyOf, setHistoryOf] = useState(null); // project whose log is open
  const [sectionsOf, setSectionsOf] = useState(null); // development project whose sections are open
  const [tab, setTab] = useState("development"); // which type the table shows

  const refresh = async () => {
    const list = await getProjects();
    setProjects(list);
    applyProjects(list); // keep the project pickers on other screens in sync
    setModal(null);
  };

  // Reload the list without closing anything (the sections window stays open).
  const reload = async () => {
    const list = await getProjects();
    setProjects(list);
    applyProjects(list);
  };

  useEffect(() => {
    Promise.all([getProjects(), getTeam()])
      .then(([list, people]) => {
        setProjects(list);
        setTeam(people);
      })
      .catch(() => setError("Could not load projects."))
      .finally(() => setLoading(false));
  }, []);

  const nameOf = useMemo(() => {
    const map = new Map(team.map((t) => [t.id, t.full_name]));
    return (id) => map.get(id) || "Unknown";
  }, [team]);

  const remove = async (p) => {
    const n = p.task_count ?? 0;
    const warn = n
      ? `Delete project "${p.name}" and its ${n} task${n === 1 ? "" : "s"}? This cannot be undone. Its members will be notified.`
      : `Delete project "${p.name}"? Its members will be notified.`;
    if (!window.confirm(warn)) return;
    setError("");
    try {
      await deleteProject(p.id);
      await refresh();
    } catch (err) {
      setError(errText(err, "Could not delete the project."));
    }
  };

  const renderTable = (list) => (
        <div className="pj-tv">
          <div className="pj-thead" aria-hidden="true">
            <table className="pj-table">
              {colgroup}
              <thead>
                <tr>
                  {HEADS.map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
            </table>
          </div>
          <div className="pj-body">
            <table className="pj-table">
              {colgroup}
              <tbody>
                {list.map((p) => {
                  const ids = p.members || [];
                  const open = p.open_count ?? 0;
                  return (
                    <tr key={p.id}>
                      <td data-label="Project" className="pj-cell-name">
                        {p.name}
                        {(p.kind || "development") === "development" && (
                          <small className="pj-sec-line">
                            {(p.sections || []).length === 0
                              ? "No sections yet"
                              : (p.sections || [])
                                  .slice(0, 3)
                                  .map((x) => x.name)
                                  .join(" · ") +
                                ((p.sections || []).length > 3
                                  ? ` · +${p.sections.length - 3}`
                                  : "")}
                          </small>
                        )}
                      </td>
                      <td data-label="Tasks">{p.task_count ?? 0}</td>
                      <td data-label="Open">
                        <span className={`pj-pill ${open > 0 ? "is-open" : ""}`}>{open}</span>
                      </td>
                      <td data-label="Members" className="pj-cell-members">
                        {ids.length > 0 ? (
                          <ul className="pj-chips">
                            {ids.slice(0, 3).map((id) => (
                              <li key={id} className="pj-chip">
                                <span className="pj-av" aria-hidden="true">
                                  {initials(nameOf(id))}
                                </span>
                                {nameOf(id)}
                              </li>
                            ))}
                            {ids.length > 3 && (
                              <li className="pj-chip pj-chip-more">+{ids.length - 3}</li>
                            )}
                          </ul>
                        ) : (
                          <span className="pj-none">No members yet</span>
                        )}
                      </td>
                      <td data-label="Created">{fmtDate(p.created_at)}</td>
                      <td data-label="Actions" className="pj-cell-actions">
                        <div className="pj-row-actions">
                          {(p.kind || "development") === "development" && (
                            <button
                              type="button"
                              className="pj-icon"
                              title="Sections"
                              aria-label={`Sections of ${p.name}`}
                              onClick={() => setSectionsOf(p)}
                            >
                              {icons.sections}
                            </button>
                          )}
                          <button
                            type="button"
                            className="pj-icon"
                            title="History"
                            aria-label={`History of ${p.name}`}
                            onClick={() => setHistoryOf(p)}
                          >
                            {icons.history}
                          </button>
                          <button
                            type="button"
                            className="pj-icon"
                            title="Edit"
                            aria-label={`Edit ${p.name}`}
                            onClick={() => setModal(p)}
                          >
                            {icons.edit}
                          </button>
                          <button
                            type="button"
                            className="pj-icon pj-icon-danger"
                            title="Delete"
                            aria-label={`Delete ${p.name}`}
                            onClick={() => remove(p)}
                          >
                            {icons.trash}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
  );

  const sec = SECTIONS.find((x) => x.kind === tab);
  const list = projects.filter((p) => (p.kind || "development") === tab);
  const counts = {
    development: projects.filter((p) => (p.kind || "development") === "development").length,
    support: projects.filter((p) => p.kind === "support").length,
  };

  return (
    <div className="pj">
      {error && <div className="pj-alert">{error}</div>}
      {loading && <p className="pj-muted">Loading...</p>}

      <div className="pj-bar">
        <div className="pj-tabs" role="tablist" aria-label="Project type">
          {SECTIONS.map((s) => (
            <button
              type="button"
              key={s.kind}
              role="tab"
              aria-selected={tab === s.kind}
              className={`pj-tab ${tab === s.kind ? "on" : ""}`}
              onClick={() => setTab(s.kind)}
            >
              {s.label}
              <span>{counts[s.kind]}</span>
            </button>
          ))}
        </div>
        <button
          type="button"
          className="lay-new pj-add"
          onClick={() => setModal(`new:${tab}`)}
        >
          {icons.plus}
          <span>{sec.add}</span>
        </button>
      </div>
      <p className="pj-sub">{sec.hint}</p>

      {!loading && list.length === 0 && (
        <div className="pj-empty">
          <strong>No {sec.kind} projects yet</strong>
          <p>Create one and choose who works in it.</p>
        </div>
      )}

      {list.length > 0 && renderTable(list)}

      {modal && (
        <ProjectModal
          project={typeof modal === "string" ? null : modal}
          projects={projects}
          kind={typeof modal === "string" ? modal.split(":")[1] : undefined}
          team={team}
          onClose={() => setModal(null)}
          onSaved={refresh}
        />
      )}

      {historyOf && (
        <ProjectHistoryDrawer project={historyOf} onClose={() => setHistoryOf(null)} />
      )}

      {sectionsOf && (
        <SectionsModal
          project={projects.find((x) => x.id === sectionsOf.id) || sectionsOf}
          team={team}
          onClose={() => setSectionsOf(null)}
          onChanged={reload}
        />
      )}
    </div>
  );
}