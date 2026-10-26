import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { createUser, deleteUser, getUsers, updateUser } from "../api/auth";
import { getProjects } from "../api/projects";

import "./User.scss";

const empty = { first_name: "", last_name: "", email: "", password: "", access: "developer" };

const ico = {
  viewBox: "0 0 24 24",
  width: 18,
  height: 18,
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
};

const ICONS = {
  developer: (
    <svg {...ico}>
      <polyline points="8 7 3 12 8 17" />
      <polyline points="16 7 21 12 16 17" />
      <line x1="14" y1="5" x2="10" y2="19" />
    </svg>
  ),
  support: (
    <svg {...ico}>
      <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z" />
    </svg>
  ),
  both: (
    <svg {...ico}>
      <path d="M12 3 3 8l9 5 9-5-9-5Z" />
      <path d="m3 13 9 5 9-5" />
    </svg>
  ),
  search: (
    <svg {...ico} width={16} height={16}>
      <circle cx="11" cy="11" r="7" />
      <line x1="20" y1="20" x2="16.2" y2="16.2" />
    </svg>
  ),
  plus: (
    <svg {...ico} width={16} height={16} strokeWidth={2.2}>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  ),
  edit: (
    <svg {...ico} width={15} height={15}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  ),
  trash: (
    <svg {...ico} width={15} height={15}>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  ),
  ban: (
    <svg {...ico} width={15} height={15}>
      <circle cx="12" cy="12" r="9" />
      <line x1="5.6" y1="5.6" x2="18.4" y2="18.4" />
    </svg>
  ),
  check: (
    <svg {...ico} width={15} height={15}>
      <circle cx="12" cy="12" r="9" />
      <polyline points="8 12.5 11 15.5 16 9" />
    </svg>
  ),
  eye: (
    <svg {...ico} width={15} height={15}>
      <path d="M1.5 12S5.5 5 12 5s10.5 7 10.5 7-4 7-10.5 7S1.5 12 1.5 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  eyeOff: (
    <svg {...ico} width={15} height={15}>
      <path d="M17.9 17.9A10.7 10.7 0 0 1 12 19C5.5 19 1.5 12 1.5 12a18.4 18.4 0 0 1 5-5.7" />
      <path d="M9.9 5.2A9.7 9.7 0 0 1 12 5c6.5 0 10.5 7 10.5 7a18.5 18.5 0 0 1-2.2 3.2" />
      <line x1="3" y1="3" x2="21" y2="21" />
    </svg>
  ),
  copy: (
    <svg {...ico} width={15} height={15}>
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
    </svg>
  ),
  warn: (
    <svg {...ico} width={13} height={13}>
      <path d="M12 3 2 20h20L12 3Z" />
      <line x1="12" y1="10" x2="12" y2="14" />
      <line x1="12" y1="17.2" x2="12" y2="17.3" />
    </svg>
  ),
};

const ACCESS = [
  { value: "developer", label: "Developer", desc: "Tasks and bugs in their projects" },
  { value: "support", label: "Support", desc: "Complaints in their support projects" },
];
const accessOf = (v) => ACCESS.find((a) => a.value === v) || ACCESS[0];

const FILTERS = [
  { value: "all", label: "All" },
  { value: "developer", label: "Developers" },
  { value: "support", label: "Support" },
  { value: "disabled", label: "Disabled" },
];

const initials = (name = "") =>
  name
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

const errMsg = (err, fallback) => {
  const d = err.response?.data;
  if (!d) return fallback;
  if (typeof d === "string") return fallback;
  const first = Object.values(d)[0];
  return Array.isArray(first) ? first[0] : first?.toString() || fallback;
};

const accessKey = (u) => u.access || "developer";

// Segmented control: pick what a login can see, with a one-line explanation below.
function AccessPicker({ value, onChange }) {
  return (
    <div className="usr-seg-wrap">
      <div className="usr-seg" role="radiogroup" aria-label="Access">
        {ACCESS.map((a) => (
          <button
            type="button"
            key={a.value}
            role="radio"
            aria-checked={value === a.value}
            className={`usr-seg-btn usr-seg-${a.value} ${value === a.value ? "on" : ""}`}
            onClick={() => onChange(a.value)}
          >
            {ICONS[a.value]}
            <span>{a.label}</span>
          </button>
        ))}
      </div>
      <p className="usr-seg-desc">{accessOf(value).desc}</p>
    </div>
  );
}

// The password the admin set for a login: hidden by default, with show and copy.
function PasswordCell({ value, emptyText = "Not saved" }) {
  const [show, setShow] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!value) {
    return (
      <span className="usr-dash" title="Set a new password for this user to store it here">
        {emptyText}
      </span>
    );
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard not available */
    }
  };

  return (
    <div className="usr-pw">
      <code className="usr-pw-text">{show ? value : "••••••••"}</code>
      <button
        type="button"
        className="usr-ico"
        title={show ? "Hide password" : "Show password"}
        aria-label={show ? "Hide password" : "Show password"}
        onClick={() => setShow((s) => !s)}
      >
        {show ? ICONS.eyeOff : ICONS.eye}
      </button>
      <button
        type="button"
        className="usr-ico"
        title={copied ? "Copied" : "Copy password"}
        aria-label="Copy password"
        onClick={copy}
      >
        {copied ? ICONS.check : ICONS.copy}
      </button>
    </div>
  );
}

export default function Users() {
  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [form, setForm] = useState(empty);
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState(null);
  const [edit, setEdit] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");

  const load = () =>
    getUsers()
      .then(setUsers)
      .catch(() => setError("Could not load users."));

  useEffect(() => {
    load();
    getProjects()
      .then(setProjects)
      .catch(() => {}); // project names are a nice extra, not required
  }, []);

  const projectById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);

  const counts = useMemo(
    () => ({
      all: users.length,
      developer: users.filter((u) => accessKey(u) === "developer").length,
      support: users.filter((u) => accessKey(u) === "support").length,
      disabled: users.filter((u) => !u.is_active).length,
    }),
    [users]
  );

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter((u) => {
      if (filter === "disabled") {
        if (u.is_active) return false;
      } else if (filter !== "all" && accessKey(u) !== filter) {
        return false;
      }
      if (!q) return true;
      return `${u.full_name} ${u.email}`.toLowerCase().includes(q);
    });
  }, [users, filter, query]);

  const add = async (e) => {
    e.preventDefault();
    if (!form.first_name.trim() || !form.email.trim() || form.password.length < 6) {
      setError("Name, email and a password of at least 6 characters are required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await createUser(form);
      setForm(empty);
      setAdding(false);
      await load();
    } catch (err) {
      setError(errMsg(err, "Could not create this user."));
    }
    setSaving(false);
  };

  const startEdit = (u) => {
    setEditId(u.id);
    setEdit({
      first_name: u.first_name,
      last_name: u.last_name,
      email: u.email,
      password: "",
      access: u.access || "developer",
    });
  };

  const saveEdit = async () => {
    if (!edit.first_name.trim() || !edit.email.trim()) return;
    const payload = { ...edit };
    if (!payload.password) delete payload.password;
    try {
      await updateUser(editId, payload);
      setEditId(null);
      setError("");
      await load();
    } catch (err) {
      setError(errMsg(err, "Could not update this user."));
    }
  };

  const toggleActive = async (u) => {
    try {
      await updateUser(u.id, { is_active: !u.is_active });
      await load();
    } catch {
      setError("Could not change this user.");
    }
  };

  const remove = async (u) => {
    if (
      !window.confirm(
        `Delete ${u.full_name}? Their complaints will stay but only the admin will see them.`
      )
    )
      return;
    try {
      await deleteUser(u.id);
      await load();
    } catch {
      setError("Could not delete this user.");
    }
  };

  const projectsCell = (u) => {
    const ids = u.projects || [];
    if (ids.length === 0) {
      return u.is_active ? (
        <span
          className="usr-noproj"
          title="They can sign in but will see nothing until added to a project"
        >
          {ICONS.warn}
          Not in any project
        </span>
      ) : (
        <span className="usr-dash">—</span>
      );
    }
    return (
      <ul className="usr-projs">
        {ids.slice(0, 2).map((id) => {
          const p = projectById.get(id);
          return (
            <li
              key={id}
              className={`usr-proj ${p?.kind === "support" ? "is-support" : ""}`}
              title={p?.name}
            >
              <i aria-hidden="true" />
              {p?.name || "Project"}
            </li>
          );
        })}
        {ids.length > 2 && <li className="usr-proj usr-proj-more">+{ids.length - 2}</li>}
      </ul>
    );
  };

  return (
    <div className="usr">
      {error && (
        <div className="usr-alert" role="alert">
          {error}
        </div>
      )}

      {/* ---------- Toolbar ---------- */}
      <div className="usr-bar">
        <div className="usr-chips" role="tablist" aria-label="Filter users">
          {FILTERS.map((f) => (
            <button
              type="button"
              key={f.value}
              role="tab"
              aria-selected={filter === f.value}
              className={`usr-chip ${filter === f.value ? "on" : ""}`}
              onClick={() => setFilter(f.value)}
            >
              {f.label}
              <span>{counts[f.value]}</span>
            </button>
          ))}
        </div>

        <label className="usr-search">
          {ICONS.search}
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name or email..."
            aria-label="Search users"
          />
        </label>

        <span className="usr-count">
          {shown.length} {shown.length === 1 ? "user" : "users"}
        </span>

        <button
          type="button"
          className="usr-btn usr-add-btn"
          onClick={() => setAdding((a) => !a)}
          aria-expanded={adding}
        >
          {ICONS.plus}
          <span>{adding ? "Close" : "Add user"}</span>
        </button>
      </div>

      {/* ---------- Add user ---------- */}
      {adding && (
        <form className="usr-panel" onSubmit={add}>
          <h3>New login</h3>
          <div className="usr-fields">
            <label className="usr-field">
              <span>First name *</span>
              <input
                autoFocus
                placeholder="e.g. Asha"
                value={form.first_name}
                onChange={(e) => setForm({ ...form, first_name: e.target.value })}
              />
            </label>
            <label className="usr-field">
              <span>Last name</span>
              <input
                placeholder="e.g. Nair"
                value={form.last_name}
                onChange={(e) => setForm({ ...form, last_name: e.target.value })}
              />
            </label>
            <label className="usr-field">
              <span>Email (used to sign in) *</span>
              <input
                type="email"
                placeholder="name@company.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </label>
            <label className="usr-field">
              <span>Password * (min 6)</span>
              <input
                type="text"
                placeholder="Give this to the person"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </label>
          </div>

          <div className="usr-field">
            <span>What can they see?</span>
            <AccessPicker value={form.access} onChange={(a) => setForm({ ...form, access: a })} />
          </div>

          <p className="usr-note">
            After creating the login, add them to a project on the{" "}
            <Link to="/projects">Projects page</Link>. Without a project they will see nothing.
          </p>

          <div className="usr-panel-actions">
            <button
              type="button"
              className="usr-btn usr-btn-ghost"
              onClick={() => {
                setAdding(false);
                setForm(empty);
              }}
            >
              Cancel
            </button>
            <button className="usr-btn" type="submit" disabled={saving}>
              {saving ? "Creating..." : "Create user"}
            </button>
          </div>
        </form>
      )}

      {/* ---------- Users table ---------- */}
      <div className="usr-card">
        <table className="usr-table">
          <thead>
            <tr>
              <th scope="col">User</th>
              <th scope="col">Access</th>
              <th scope="col">Projects</th>
              <th scope="col">Password</th>
              <th scope="col">Status</th>
              <th scope="col" className="usr-th-actions">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 && (
              <tr>
                <td colSpan={6} className="usr-empty">
                  No users yet. Click <strong>Add user</strong> to create the first login.
                </td>
              </tr>
            )}
            {users.length > 0 && shown.length === 0 && (
              <tr>
                <td colSpan={6} className="usr-empty">
                  No users match this filter.
                </td>
              </tr>
            )}

            {shown.map((u) => {
              const a = accessOf(accessKey(u));
              return [
                <tr
                  key={u.id}
                  className={`${u.is_active ? "" : "is-off"} ${editId === u.id ? "is-editing" : ""}`}
                >
                  <td data-label="User">
                    <div className="usr-who">
                      <span className={`usr-avatar ${u.is_active ? "" : "off"}`}>
                        {initials(u.full_name)}
                      </span>
                      <div className="usr-info">
                        <strong>{u.full_name}</strong>
                        <small>{u.email}</small>
                      </div>
                    </div>
                  </td>
                  <td data-label="Access">
                    <span className={`usr-access usr-access-${a.value}`} title={a.desc}>
                      {ICONS[a.value]}
                      {a.label}
                    </span>
                  </td>
                  <td data-label="Projects">{projectsCell(u)}</td>
                  <td data-label="Password">
                    <PasswordCell value={u.password_plain} />
                  </td>
                  <td data-label="Status">
                    <span className={`usr-badge ${u.is_active ? "on" : "off"}`}>
                      {u.is_active ? "Active" : "Disabled"}
                    </span>
                  </td>
                  <td data-label="Actions" className="usr-td-actions">
                    <div className="usr-actions">
                      <button
                        type="button"
                        className={`usr-ico usr-ico-edit ${editId === u.id ? "is-on" : ""}`}
                        title={editId === u.id ? "Close" : "Edit"}
                        aria-label={`${editId === u.id ? "Close edit for" : "Edit"} ${u.full_name}`}
                        onClick={() => (editId === u.id ? setEditId(null) : startEdit(u))}
                      >
                        {ICONS.edit}
                      </button>
                      <button
                        type="button"
                        className={`usr-ico ${u.is_active ? "usr-ico-warn" : "usr-ico-ok"}`}
                        title={u.is_active ? "Disable login" : "Enable login"}
                        aria-label={`${u.is_active ? "Disable" : "Enable"} ${u.full_name}`}
                        onClick={() => toggleActive(u)}
                      >
                        {u.is_active ? ICONS.ban : ICONS.check}
                      </button>
                      <button
                        type="button"
                        className="usr-ico usr-ico-danger"
                        title="Delete"
                        aria-label={`Delete ${u.full_name}`}
                        onClick={() => remove(u)}
                      >
                        {ICONS.trash}
                      </button>
                    </div>
                  </td>
                </tr>,

                editId === u.id && (
                  <tr key={`${u.id}-edit`} className="usr-editrow">
                    <td colSpan={6}>
                      <div className="usr-panel usr-panel-inline">
                        <h3>Edit {u.full_name}</h3>
                        <div className="usr-fields">
                          <label className="usr-field">
                            <span>First name</span>
                            <input
                              value={edit.first_name}
                              onChange={(e) => setEdit({ ...edit, first_name: e.target.value })}
                              placeholder="First name"
                            />
                          </label>
                          <label className="usr-field">
                            <span>Last name</span>
                            <input
                              value={edit.last_name}
                              onChange={(e) => setEdit({ ...edit, last_name: e.target.value })}
                              placeholder="Last name"
                            />
                          </label>
                          <label className="usr-field">
                            <span>Email</span>
                            <input
                              value={edit.email}
                              onChange={(e) => setEdit({ ...edit, email: e.target.value })}
                              placeholder="Email"
                            />
                          </label>
                          <label className="usr-field">
                            <span>New password</span>
                            <input
                              value={edit.password}
                              onChange={(e) => setEdit({ ...edit, password: e.target.value })}
                              placeholder="Leave blank to keep the current one"
                            />
                          </label>
                        </div>

                        <div className="usr-field">
                          <span>Current password</span>
                          <PasswordCell
                            value={u.password_plain}
                            emptyText="Not saved yet. Set a new password above to store it."
                          />
                        </div>

                        <div className="usr-field">
                          <span>What can they see?</span>
                          <AccessPicker
                            value={edit.access}
                            onChange={(acc) => setEdit({ ...edit, access: acc })}
                          />
                        </div>

                        <p className="usr-note">
                          Changing the password signs them out everywhere. After changing access,
                          they should sign out and back in.
                        </p>

                        <div className="usr-panel-actions">
                          <button
                            type="button"
                            className="usr-btn usr-btn-ghost"
                            onClick={() => setEditId(null)}
                          >
                            Cancel
                          </button>
                          <button type="button" className="usr-btn" onClick={saveEdit}>
                            Save changes
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                ),
              ];
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}