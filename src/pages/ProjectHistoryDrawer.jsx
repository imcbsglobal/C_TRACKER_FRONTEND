import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { getProjectHistory } from "../api/projects";
import "../components/HistoryDrawer.scss";

const when = (d) =>
  new Date(d).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

const svg = {
  viewBox: "0 0 24 24",
  width: 14,
  height: 14,
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2.2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
};

const icons = {
  created: (
    <svg {...svg}>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  ),
  followup: (
    <svg {...svg}>
      <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z" />
    </svg>
  ),
  change: (
    <svg {...svg}>
      <path d="M4 8h13l-3-3" />
      <path d="M20 16H7l3 3" />
    </svg>
  ),
  close: (
    <svg {...svg} width={16} height={16}>
      <line x1="6" y1="6" x2="18" y2="18" />
      <line x1="18" y1="6" x2="6" y2="18" />
    </svg>
  ),
};

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

export default function ProjectHistoryDrawer({ project, onClose }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setError("");
    setLoading(true);
    getProjectHistory(project.id)
      .then(setEntries)
      .catch(() => setError("Could not load the history."))
      .finally(() => setLoading(false));
  }, [project.id]);

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

  const meta = [
    plural(project.task_count ?? 0, "task"),
    plural((project.members || []).length, "member"),
  ].join(" · ");

  return createPortal(
    <div className="hd-overlay" onClick={onClose}>
      <aside
        className="hd"
        role="dialog"
        aria-modal="true"
        aria-label="Project history"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="hd-head">
          <div>
            <span className="hd-eyebrow">PROJECT</span>
            <h2>{project.name}</h2>
            <p>{meta}</p>
          </div>
          <button type="button" className="hd-close" onClick={onClose} aria-label="Close">
            {icons.close}
          </button>
        </header>

        <div className="hd-body">
          <h3 className="hd-label" style={{ marginTop: 0 }}>History &amp; log</h3>

          {error && <div className="hd-alert">{error}</div>}
          {loading && <p className="hd-muted">Loading...</p>}
          {!loading && !error && entries.length === 0 && (
            <p className="hd-muted">No activity yet.</p>
          )}

          <ul className="hd-timeline">
            {entries.map((e) => (
              <li key={e.id} className={`is-${e.type}`}>
                <span className="hd-dot" aria-hidden="true">
                  {icons[e.type] || icons.change}
                </span>
                <div className="hd-text">
                  <strong>{e.actor || "Someone"}</strong>
                  {" — "}
                  {e.message}
                </div>
                <small>{when(e.created_at)}</small>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>,
    document.body
  );
}