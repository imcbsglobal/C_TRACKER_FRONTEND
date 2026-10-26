import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../api/complaints";
import { setSelectedProject } from "../projects";
import "./NotificationBell.scss";

const POLL_MS = 15000;
const MAX_SPLASH = 3; // how many splash cards are visible at once

const ago = (d) => {
  const s = Math.max(1, Math.floor((Date.now() - new Date(d)) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
};

// "You were added to a project / sprint" notifications (created when the admin adds a user).
// Backend sends  type: "project_added" | "sprint_added"  (see the Django snippet).
// Other sprint notices (started, completed, closing warning) have a different type and stay normal.
// The message fallbacks only keep old notifications (created before `type` existed) working.
const kindOf = (n) => {
  const t = n.type || n.kind;
  if (t === "project_added" || t === "sprint_added") return t;
  if (t || n.complaint) return null;
  if (/added you to .*sprint/i.test(n.message || "")) return "sprint_added";
  if (/added you to .*project/i.test(n.message || "")) return "project_added";
  return null;
};

const splashIcon = {
  project_added: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
    </svg>
  ),
  sprint_added: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17 2l4 4-4 4" />
      <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
      <path d="M7 22l-4-4 4-4" />
      <path d="M21 13v1a4 4 0 0 1-4 4H3" />
    </svg>
  ),
};

const splashText = {
  project_added: "Added to a new project",
  sprint_added: "New sprint to complete",
};

// The sprint / project name sits in quotes in the message: ... added you to sprint "NAME"
const nameOf = (n) => {
  const m = (n.message || "").match(/["“”']([^"“”']+)["“”']/);
  return m ? m[1] : n.message;
};

const isStarted = (n) => /started sprint/i.test(n.message || "");

// Title of the 6s toast. Escalations (task handed to the admin / developers, or a developer
// moving an escalated task) get their own titles instead of "New assignment".
const toastTitle = (n) =>
  /moved the escalated task/i.test(n.message || "")
    ? "Escalation update"
    : /\sescalated\s+(the task\s+)?["“]/i.test(n.message || "")
      ? "Task escalated"
      : n.complaint
        ? "New assignment"
        : isStarted(n)
          ? "Sprint started"
          : "Project update";

// Project(s) a sprint belongs to. Backend sends project_names (list) or project_name.
const projectsOf = (n) =>
  Array.isArray(n.project_names) && n.project_names.length
    ? n.project_names
    : n.project_name
    ? [n.project_name]
    : [];

// Put <NotificationBell /> in your header/sidebar. Change taskPath / sprintPath if your routes differ.
export default function NotificationBell({
  taskPath = (id) => `/complaints/${id}`,
  sprintPath = "/my-sprints",
}) {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const seen = useRef(null); // ids already known; null until first load
  const closed = useRef(new Set()); // splash cards the user closed (guards against slow polls)
  const box = useRef(null);

  const load = useCallback(async () => {
    try {
      const data = await getNotifications();
      setItems(data);
      if (seen.current === null) {
        seen.current = new Set(data.map((n) => n.id));
        return;
      }
      // project / sprint notifications get a sticky splash card, so they skip the 6s toast
      // a "sprint started" toast is skipped when the "added to sprint" card for the same sprint is on screen
      const addedNames = new Set(
        data.filter((n) => kindOf(n) === "sprint_added" && !n.is_read).map(nameOf)
      );
      const fresh = data.filter(
        (n) =>
          !n.is_read &&
          !seen.current.has(n.id) &&
          !kindOf(n) &&
          !(isStarted(n) && addedNames.has(nameOf(n)))
      );
      data.forEach((n) => seen.current.add(n.id));
      if (fresh.length) setToast(fresh[0]);
    } catch {
      /* ignore polling errors */
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    const onDown = (e) => box.current && !box.current.contains(e.target) && setOpen(false);
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const unread = items.filter((n) => !n.is_read).length;

  // Unread project / sprint notifications stay on screen until the user closes them.
  // Because this is derived from the server list, they also show again after the next login.
  const splashAll = items.filter((n) => kindOf(n) && !n.is_read && !closed.current.has(n.id));
  const splash = splashAll.slice(0, MAX_SPLASH);
  const splashMore = splashAll.length - splash.length;

  const markRead = (n) => {
    closed.current.add(n.id);
    setItems((l) => l.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)));
    markNotificationRead(n.id).catch(() => {});
  };

  const openItem = async (n) => {
    setOpen(false);
    setToast(null);
    if (!n.is_read) markRead(n);
    if (n.complaint) {
      navigate(taskPath(n.complaint));
    } else if (kindOf(n) === "sprint_added") {
      navigate(sprintPath);
    } else if (n.project) {
      setSelectedProject(n.project); // jump to the board filtered to that project
      navigate("/");
    }
  };

  const closeSplash = (n, e) => {
    e.stopPropagation();
    markRead(n);
  };

  const readAll = async () => {
    items.forEach((n) => closed.current.add(n.id));
    setItems((l) => l.map((x) => ({ ...x, is_read: true })));
    markAllNotificationsRead().catch(() => {});
  };

  return (
    <>
      <div className="nb" ref={box}>
        <button
          type="button"
          className="nb-btn"
          onClick={() => setOpen((o) => !o)}
          aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
          aria-expanded={open}
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.7 21a2 2 0 0 1-3.4 0" />
          </svg>
          {unread > 0 && <span className="nb-badge">{unread > 9 ? "9+" : unread}</span>}
        </button>

        {open && (
          <div className="nb-panel" role="menu">
            <div className="nb-head">
              <strong>Notifications</strong>
              {unread > 0 && (
                <button type="button" className="nb-link" onClick={readAll}>
                  Mark all read
                </button>
              )}
            </div>
            <ul className="nb-list">
              {items.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    className={`nb-item ${n.is_read ? "" : "unread"}`}
                    onClick={() => openItem(n)}
                  >
                    <span className="nb-text">{n.message}</span>
                    <small>{ago(n.created_at)}</small>
                  </button>
                </li>
              ))}
              {items.length === 0 && <li className="nb-empty">No notifications yet</li>}
            </ul>
          </div>
        )}
      </div>

      {splash.length > 0 && (
        <div className="nb-splash-stack" aria-live="polite">
          {splash.map((n) => {
            const kind = kindOf(n);
            const projects = kind === "sprint_added" ? projectsOf(n) : [];
            return (
              <div
                key={n.id}
                className={`nb-splash is-${kind === "sprint_added" ? "sprint" : "project"}`}
                role="status"
                title={n.message}
                onClick={() => openItem(n)}
              >
                <span className="nb-splash-ico">{splashIcon[kind]}</span>
                <div className="nb-splash-body">
                  <span className="nb-splash-label">{splashText[kind]}</span>
                  <strong>{nameOf(n)}</strong>
                  {projects.length > 0 && (
                    <span className="nb-splash-proj">in {projects.join(", ")}</span>
                  )}
                </div>
                <button
                  type="button"
                  className="nb-splash-x"
                  aria-label="Close"
                  onClick={(e) => closeSplash(n, e)}
                >
                  ×
                </button>
              </div>
            );
          })}
          {splashMore > 0 && <span className="nb-splash-more">+{splashMore} more</span>}
        </div>
      )}

      {toast && (
        <div className={`nb-toast ${splash.length ? "is-lifted" : ""}`} role="status" onClick={() => openItem(toast)}>
          <span className="nb-toast-dot" aria-hidden="true" />
          <div>
            <strong>{toastTitle(toast)}</strong>
            <p>{toast.message}</p>
          </div>
          <button
            type="button"
            className="nb-toast-x"
            aria-label="Dismiss"
            onClick={(e) => {
              e.stopPropagation();
              setToast(null);
            }}
          >
            ×
          </button>
        </div>
      )}
    </>
  );
}