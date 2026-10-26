import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  createOption,
  deleteOption,
  getConfig,
  reorderOptions,
  updateOption,
} from "../api/config";
import {
  createProject,
  deleteProject,
  getProjects,
  updateProject,
} from "../api/projects";
import { getTeam } from "../api/complaints";
import { applyConfig, TONES, TONE_COLORS } from "../constants";
import { applyProjects } from "../projects";
import "./CustomizeModal.scss";

const TABS = [
  {
    kind: "projects",
    title: "Projects",
    noun: "project",
    hint: "Users only see the projects they are added to.",
  },
  {
    kind: "statuses",
    title: "Statuses",
    noun: "status",
    hint: "Every status is a column on the board, in this order.",
    nameKey: "label",
    tone: true,
    closed: true,
  },
  {
    kind: "priorities",
    title: "Priorities",
    noun: "priority",
    hint: "Order them from lowest (top) to highest (bottom).",
    nameKey: "label",
    tone: true,
  },
  {
    kind: "categories",
    title: "Categories",
    noun: "category",
    hint: "Categories group tasks by type.",
    nameKey: "name",
  },
];

const svg = {
  viewBox: "0 0 24 24",
  width: 16,
  height: 16,
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
};
const icons = {
  up: (
    <svg {...svg}>
      <polyline points="6 15 12 9 18 15" />
    </svg>
  ),
  down: (
    <svg {...svg}>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  ),
  trash: (
    <svg {...svg} strokeWidth={1.7}>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  ),
  close: (
    <svg {...svg}>
      <line x1="6" y1="6" x2="18" y2="18" />
      <line x1="18" y1="6" x2="6" y2="18" />
    </svg>
  ),
  plus: (
    <svg {...svg}>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  ),
};

const errorText = (err, fallback) => {
  const d = err?.response?.data;
  if (!d) return fallback;
  if (typeof d.detail === "string") return d.detail;
  const first = Object.values(d)[0];
  return (Array.isArray(first) ? first[0] : first) || fallback;
};

function ToneDots({ value, onChange, label }) {
  return (
    <div className="cz-tones" role="radiogroup" aria-label={label}>
      {TONES.map((t) => (
        <button
          key={t}
          type="button"
          role="radio"
          aria-checked={value === t}
          aria-label={t}
          title={t}
          className={`cz-dot ${value === t ? "on" : ""}`}
          style={{ background: TONE_COLORS[t].fg }}
          onClick={() => onChange(t)}
        />
      ))}
    </div>
  );
}

function ProjectsPanel({ onError }) {
  const [projects, setProjects] = useState([]);
  const [team, setTeam] = useState([]);
  const [open, setOpen] = useState(null); // project whose members are shown
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");

  const sync = async () => {
    const list = await getProjects();
    setProjects(list);
    applyProjects(list); // board filter / forms update straight away
  };

  useEffect(() => {
    Promise.all([getProjects(), getTeam()])
      .then(([p, t]) => {
        setProjects(p);
        setTeam(t);
      })
      .catch(() => onError("Could not load projects."));
  }, []);

  const run = async (fn, fallback) => {
    onError("");
    setBusy(true);
    try {
      await fn();
      await sync();
      return true;
    } catch (err) {
      onError(errorText(err, fallback));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const add = async (e) => {
    e.preventDefault();
    const value = name.trim();
    if (!value || busy) return;
    const ok = await run(() => createProject({ name: value }), "Could not add the project.");
    if (ok) setName("");
  };

  const toggleMember = (project, memberId) => {
    const has = project.members.includes(memberId);
    const members = has
      ? project.members.filter((m) => m !== memberId)
      : [...project.members, memberId];
    run(() => updateProject(project.id, { members }), "Could not update members.");
  };

  return (
    <>
      <ul className="cz-list">
        {projects.map((p) => (
          <li key={p.id} className="cz-proj">
            <div className="cz-row cz-row-flat">
              <input
                key={`${p.id}-${p.name}`}
                className="cz-name"
                defaultValue={p.name}
                maxLength={150}
                aria-label="Project name"
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v && v !== p.name)
                    run(() => updateProject(p.id, { name: v }), "Could not rename.");
                }}
                onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
              />
              <span className="cz-meta">
                {p.task_count} task{p.task_count === 1 ? "" : "s"}
              </span>
              <button
                type="button"
                className="cz-members-btn"
                aria-expanded={open === p.id}
                onClick={() => setOpen(open === p.id ? null : p.id)}
              >
                {p.members.length} member{p.members.length === 1 ? "" : "s"}
                {open === p.id ? icons.up : icons.down}
              </button>
              <button
                type="button"
                className="cz-del"
                aria-label={`Delete ${p.name}`}
                disabled={busy}
                onClick={() =>
                  window.confirm(`Delete "${p.name}"?`) &&
                  run(() => deleteProject(p.id), "Could not delete the project.")
                }
              >
                {icons.trash}
              </button>
            </div>

            {open === p.id && (
              <div className="cz-members">
                {team.length === 0 && <p className="cz-muted">No team members yet.</p>}
                {team.map((t) => (
                  <label key={t.id} className="cz-check">
                    <input
                      type="checkbox"
                      checked={p.members.includes(t.id)}
                      disabled={busy}
                      onChange={() => toggleMember(p, t.id)}
                    />
                    {t.full_name}
                  </label>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>

      <form className="cz-add" onSubmit={add}>
        <input
          className="cz-name"
          value={name}
          maxLength={150}
          placeholder="New project..."
          aria-label="New project name"
          onChange={(e) => setName(e.target.value)}
        />
        <button type="submit" className="cz-addbtn" disabled={!name.trim() || busy}>
          {icons.plus}
          Add
        </button>
      </form>
    </>
  );
}

export default function CustomizeModal({ onClose }) {
  const [tabKind, setTabKind] = useState("projects");
  const [data, setData] = useState({ statuses: [], priorities: [], categories: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [newName, setNewName] = useState("");
  const [newTone, setNewTone] = useState("blue");
  const [newClosed, setNewClosed] = useState(false);

  const tab = TABS.find((t) => t.kind === tabKind);
  const rows = data[tabKind] || [];

  const sync = async () => {
    const fresh = await getConfig();
    setData(fresh);
    applyConfig(fresh); // every screen updates straight away
  };

  useEffect(() => {
    sync()
      .catch(() => setError("Could not load the lists."))
      .finally(() => setLoading(false));
  }, []);

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

  const run = async (fn, fallback) => {
    setError("");
    setBusy(true);
    try {
      await fn();
      await sync();
      return true;
    } catch (err) {
      setError(errorText(err, fallback));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const switchTab = (kind) => {
    setTabKind(kind);
    setError("");
    setNewName("");
    setNewClosed(false);
  };

  const add = async (e) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name || busy) return;
    const payload = { [tab.nameKey]: name };
    if (tab.tone) payload.tone = newTone;
    if (tab.closed) payload.is_closed = newClosed;
    const ok = await run(() => createOption(tabKind, payload), `Could not add the ${tab.noun}.`);
    if (ok) {
      setNewName("");
      setNewClosed(false);
    }
  };

  const rename = (row, value) => {
    const name = value.trim();
    if (!name || name === row[tab.nameKey]) return;
    run(() => updateOption(tabKind, row.id, { [tab.nameKey]: name }), "Could not rename.");
  };

  const move = (index, dir) => {
    const ids = rows.map((r) => r.id);
    const j = index + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[index], ids[j]] = [ids[j], ids[index]];
    run(() => reorderOptions(tabKind, ids), "Could not reorder.");
  };

  const remove = (row) => {
    if (!window.confirm(`Delete "${row[tab.nameKey]}"?`)) return;
    run(() => deleteOption(tabKind, row.id), `Could not delete the ${tab.noun}.`);
  };

  return createPortal(
    <div className="cz-overlay" onClick={onClose}>
      <div
        className="cz"
        role="dialog"
        aria-modal="true"
        aria-label="Customize"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="cz-head">
          <div>
            <h2>Customize</h2>
            <p>Changes are saved instantly and every user sees them.</p>
          </div>
          <button type="button" className="cz-x" onClick={onClose} aria-label="Close">
            {icons.close}
          </button>
        </header>

        <div className="cz-tabs" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.kind}
              type="button"
              role="tab"
              aria-selected={tabKind === t.kind}
              className={tabKind === t.kind ? "on" : ""}
              onClick={() => switchTab(t.kind)}
            >
              {t.title}
              {t.kind !== "projects" && (
                <span className="cz-n">{data[t.kind]?.length ?? 0}</span>
              )}
            </button>
          ))}
        </div>

        <div className="cz-body">
          <p className="cz-hint">{tab.hint}</p>
          {error && <div className="cz-alert" role="alert">{error}</div>}
          {loading && <p className="cz-muted">Loading...</p>}

          {tabKind === "projects" ? (
            <ProjectsPanel onError={setError} />
          ) : (
            <>

          <ul className="cz-list">
            {rows.map((row, i) => (
              <li key={row.id} className="cz-row">
                <div className="cz-move">
                  <button
                    type="button"
                    aria-label="Move up"
                    disabled={busy || i === 0}
                    onClick={() => move(i, -1)}
                  >
                    {icons.up}
                  </button>
                  <button
                    type="button"
                    aria-label="Move down"
                    disabled={busy || i === rows.length - 1}
                    onClick={() => move(i, 1)}
                  >
                    {icons.down}
                  </button>
                </div>

                <input
                  key={`${row.id}-${row[tab.nameKey]}`}
                  className="cz-name"
                  defaultValue={row[tab.nameKey]}
                  maxLength={tab.kind === "categories" ? 100 : 40}
                  aria-label={`${tab.noun} name`}
                  onBlur={(e) => rename(row, e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                />

                {tab.tone && (
                  <ToneDots
                    label="Colour"
                    value={row.tone}
                    onChange={(t) =>
                      t !== row.tone &&
                      run(() => updateOption(tabKind, row.id, { tone: t }), "Could not change the colour.")
                    }
                  />
                )}

                {tab.closed && (
                  <label className="cz-check" title="Tasks here count as finished">
                    <input
                      type="checkbox"
                      checked={!!row.is_closed}
                      disabled={busy}
                      onChange={(e) =>
                        run(
                          () => updateOption(tabKind, row.id, { is_closed: e.target.checked }),
                          "Could not save."
                        )
                      }
                    />
                    Done
                  </label>
                )}

                <button
                  type="button"
                  className="cz-del"
                  aria-label={`Delete ${row[tab.nameKey]}`}
                  disabled={busy}
                  onClick={() => remove(row)}
                >
                  {icons.trash}
                </button>
              </li>
            ))}
          </ul>

          <form className="cz-add" onSubmit={add}>
            <input
              className="cz-name"
              value={newName}
              maxLength={tab.kind === "categories" ? 100 : 40}
              placeholder={`New ${tab.noun}...`}
              aria-label={`New ${tab.noun} name`}
              onChange={(e) => setNewName(e.target.value)}
            />
            {tab.tone && <ToneDots label="Colour" value={newTone} onChange={setNewTone} />}
            {tab.closed && (
              <label className="cz-check" title="Tasks here count as finished">
                <input
                  type="checkbox"
                  checked={newClosed}
                  onChange={(e) => setNewClosed(e.target.checked)}
                />
                Done
              </label>
            )}
            <button type="submit" className="cz-addbtn" disabled={!newName.trim() || busy}>
              {icons.plus}
              Add
            </button>
          </form>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}