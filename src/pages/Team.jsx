import { useEffect, useMemo, useState } from "react";
import { getTeam, createMember } from "../api/complaints";
import "./Team.scss";

const empty = { first_name: "", last_name: "", email: "" };

const initials = (name = "") =>
  name
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

const ACCESS_LABEL = { developer: "Developer", support: "Support", both: "Both" };

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

const ICONS = {
  search: (
    <svg {...ico}>
      <circle cx="11" cy="11" r="7" />
      <line x1="20" y1="20" x2="16.2" y2="16.2" />
    </svg>
  ),
  plus: (
    <svg {...ico} strokeWidth={2.2}>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  ),
};

export default function Team() {
  const [members, setMembers] = useState([]);
  const [form, setForm] = useState(empty);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  const load = () =>
    getTeam()
      .then(setMembers)
      .catch(() => setError("Could not load the team. Is the backend running?"));

  useEffect(() => {
    load();
  }, []);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) => `${m.full_name} ${m.email}`.toLowerCase().includes(q));
  }, [members, query]);

  const add = async (e) => {
    e.preventDefault();
    if (!form.first_name.trim()) {
      setError("First name is required");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await createMember(form);
      setForm(empty);
      setAdding(false);
      await load();
    } catch {
      setError("Could not add this person. Check the email format.");
    }
    setSaving(false);
  };

  return (
    <div className="team">
      {error && (
        <div className="team-alert" role="alert">
          {error}
        </div>
      )}

      {/* ---------- Toolbar ---------- */}
      <div className="team-bar">
        <label className="team-search">
          {ICONS.search}
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name or email..."
            aria-label="Search team"
          />
        </label>

        <span className="team-total">
          {shown.length} {shown.length === 1 ? "person" : "people"}
        </span>

        <button
          type="button"
          className="team-btn team-add-btn"
          onClick={() => setAdding((a) => !a)}
          aria-expanded={adding}
        >
          {ICONS.plus}
          <span>{adding ? "Close" : "Add person"}</span>
        </button>
      </div>

      {/* ---------- Add person ---------- */}
      {adding && (
        <form className="team-panel" onSubmit={add}>
          <h3>New team member</h3>
          <div className="team-fields">
            <label className="team-field">
              <span>First name *</span>
              <input
                autoFocus
                placeholder="e.g. Asha"
                value={form.first_name}
                onChange={(e) => setForm({ ...form, first_name: e.target.value })}
              />
            </label>
            <label className="team-field">
              <span>Last name</span>
              <input
                placeholder="e.g. Nair"
                value={form.last_name}
                onChange={(e) => setForm({ ...form, last_name: e.target.value })}
              />
            </label>
            <label className="team-field">
              <span>Email</span>
              <input
                type="email"
                placeholder="name@company.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </label>
          </div>
          <p className="team-note">People added here can be assigned to complaints.</p>
          <div className="team-panel-actions">
            <button
              type="button"
              className="team-btn team-btn-ghost"
              onClick={() => {
                setAdding(false);
                setForm(empty);
              }}
            >
              Cancel
            </button>
            <button className="team-btn" type="submit" disabled={saving}>
              {saving ? "Adding..." : "Add person"}
            </button>
          </div>
        </form>
      )}

      {/* ---------- Team table ---------- */}
      <div className="team-card">
        <table className="team-table">
          <thead>
            <tr>
              <th scope="col">Member</th>
              <th scope="col">Email</th>
              <th scope="col">Access</th>
            </tr>
          </thead>
          <tbody>
            {members.length === 0 && (
              <tr>
                <td colSpan={3} className="team-empty">
                  No team members yet. Click <strong>Add person</strong> to add the first one.
                </td>
              </tr>
            )}
            {members.length > 0 && shown.length === 0 && (
              <tr>
                <td colSpan={3} className="team-empty">
                  No one matches this search.
                </td>
              </tr>
            )}

            {shown.map((m) => (
              <tr key={m.id}>
                <td data-label="Member">
                  <div className="team-who">
                    <span className="team-avatar">{initials(m.full_name)}</span>
                    <strong>{m.full_name}</strong>
                  </div>
                </td>
                <td data-label="Email">
                  {m.email ? (
                    <span className="team-email">{m.email}</span>
                  ) : (
                    <span className="team-dash">No email</span>
                  )}
                </td>
                <td data-label="Access">
                  {m.access ? (
                    <span className={`team-access team-access-${m.access}`}>
                      {ACCESS_LABEL[m.access] || m.access}
                    </span>
                  ) : (
                    <span className="team-dash">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}