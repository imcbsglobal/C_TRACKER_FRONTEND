import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useAccess } from "../auth/access";
import { getComplaints } from "../api/complaints";
import NotificationBell from "./NotificationBell";
import ProjectHistoryDrawer from "../pages/ProjectHistoryDrawer";
import { loadProjects, useProjects } from "../projects";
import "./Layout.scss";
import "./LayoutAuth.scss";
import "./LayoutHistory.scss";

const svgProps = {
  viewBox: "0 0 24 24",
  width: 18,
  height: 18,
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
};

const icons = {
  dashboard: (
    <svg {...svgProps}>
      <rect x="3" y="3" width="7.5" height="9" rx="2" />
      <rect x="13.5" y="3" width="7.5" height="5" rx="2" />
      <rect x="13.5" y="11" width="7.5" height="10" rx="2" />
      <rect x="3" y="15" width="7.5" height="6" rx="2" />
    </svg>
  ),
  list: (
    <svg {...svgProps}>
      <rect x="3" y="4" width="18" height="16" rx="2.5" />
      <line x1="9" y1="4" x2="9" y2="20" />
      <line x1="13" y1="9" x2="18" y2="9" />
      <line x1="13" y1="14" x2="18" y2="14" />
    </svg>
  ),
  plus: (
    <svg {...svgProps}>
      <circle cx="12" cy="12" r="9" />
      <line x1="12" y1="8" x2="12" y2="16" />
      <line x1="8" y1="12" x2="16" y2="12" />
    </svg>
  ),
  plusSm: (
    <svg {...svgProps} width={16} height={16} strokeWidth={2}>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  ),
  history: (
    <svg {...svgProps} width={16} height={16}>
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 15.5 14" />
    </svg>
  ),
  sprint: (
    <svg {...svgProps}>
      <path d="M17 2l4 4-4 4" />
      <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
      <path d="M7 22l-4-4 4-4" />
      <path d="M21 13v1a4 4 0 0 1-4 4H3" />
    </svg>
  ),
  flag: (
    <svg {...svgProps}>
      <path d="M5 21V4" />
      <path d="M5 4h11l-2 4 2 4H5" />
    </svg>
  ),
  clipboard: (
    <svg {...svgProps}>
      <rect x="5" y="4" width="14" height="17" rx="2.5" />
      <path d="M9 4V3.5A1.5 1.5 0 0 1 10.5 2h3A1.5 1.5 0 0 1 15 3.5V4" />
      <polyline points="9 13.5 11.2 15.7 15.2 11" />
    </svg>
  ),
  users: (
    <svg {...svgProps}>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20v-1a5.5 5.5 0 0 1 5.5-5.5h2A5.5 5.5 0 0 1 15.5 19v1" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M17.5 14a4.5 4.5 0 0 1 4 4.5V20" />
    </svg>
  ),
  folder: (
    <svg {...svgProps}>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
    </svg>
  ),
  key: (
    <svg {...svgProps}>
      <circle cx="7.5" cy="15.5" r="4.5" />
      <path d="M10.7 12.3 21 2" />
      <path d="M17 6l3 3" />
    </svg>
  ),
  logout: (
    <svg {...svgProps}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  ),
  menu: (
    <svg {...svgProps} width={20} height={20}>
      <line x1="4" y1="7" x2="20" y2="7" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="17" x2="20" y2="17" />
    </svg>
  ),
  panel: (
    <svg {...svgProps} width={16} height={16}>
      <rect x="3" y="4" width="18" height="16" rx="3" />
      <line x1="9" y1="4" x2="9" y2="20" />
    </svg>
  ),
  caret: (
    <svg {...svgProps} width={14} height={14}>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  ),
  close: (
    <svg {...svgProps}>
      <line x1="6" y1="6" x2="18" y2="18" />
      <line x1="18" y1="6" x2="6" y2="18" />
    </svg>
  ),
  search: (
    <svg {...svgProps} width={17} height={17}>
      <circle cx="11" cy="11" r="7" />
      <line x1="20" y1="20" x2="16.2" y2="16.2" />
    </svg>
  ),
};

// admin: only the super admin. mine: a login with developer / both access (not the admin).
// support: a login with support / both access (not the admin).
// Sprints are planned and run by the admin only; developers just follow the sprints the
// admin gave them under "My sprints" and update their own tasks. Support users have no
// sprints: they file complaints and add tasks to them under "My complaints".
const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: "dashboard", group: "Workspace" },
  { to: "/", label: "All tasks", icon: "list", end: true, group: "Workspace" },
  { to: "/new", label: "New complaint", icon: "plus", group: "Workspace" },
  { to: "/sprints", label: "Sprints", icon: "sprint", admin: true, group: "Workspace" },
  { to: "/my-sprints", label: "My sprints", icon: "flag", mine: true, group: "Workspace" },
  { to: "/my-complaints", label: "My complaints", icon: "clipboard", support: true, group: "Workspace" },
  { to: "/team", label: "Team", icon: "users", admin: true, group: "Admin" },
  { to: "/projects", label: "Projects", icon: "folder", admin: true, group: "Admin" },
  { to: "/users", label: "User logins", icon: "key", admin: true, group: "Admin" },
];

// Wording per side: support talks about complaints, developers about tasks.
const WORDS = {
  support: {
    list: "Complaints",
    listSub: "Track and follow up on every complaint",
    create: "New complaint",
    createSub: "Log a new complaint for follow-up",
    detail: "Complaint details",
    detailSub: "Full history and follow-ups for this complaint",
    search: "Search complaints or people...",
  },
  developer: {
    list: "All tasks",
    listSub: "Track every task and bug in your projects",
    create: "New task",
    createSub: "Add a task or bug to a project",
    detail: "Task details",
    detailSub: "Full history and actions for this task",
    search: "Search tasks, bugs, or people...",
  },
  both: {
    list: "All tasks",
    listSub: "Track and follow up on every complaint and task",
    create: "New item",
    createSub: "Log a complaint, task or bug",
    detail: "Task details",
    detailSub: "Full history and actions for this item",
    search: "Search complaints, tasks, or people...",
  },
};

// The dashboard has its own greeting and buttons, so it has no entry here.
const PAGES = {
  "/sprints": { title: "Sprints", sub: "Plan, run and review development work in sprints" },
  "/team": { title: "Team", sub: "Manage the people handling complaints" },
  "/projects": { title: "Projects", sub: "Create projects and choose who works in them" },
  "/users": { title: "User logins", sub: "Control who can sign in" },
};

const pageFor = (path, words) => {
  if (path === "/") return { title: words.list, sub: words.listSub };
  if (path === "/new") return { title: words.create, sub: words.createSub };
  if (PAGES[path]) return PAGES[path];
  if (path.startsWith("/complaints/")) return { title: words.detail, sub: words.detailSub };
  return { title: "", sub: "" };
};

const readCollapsed = () => {
  try {
    return localStorage.getItem("sidebar-collapsed") === "1";
  } catch {
    return false;
  }
};

const SEEN_KEY = "complaints-last-seen-id";
const POLL_MS = 15000;

const readSeen = () => {
  try {
    const v = localStorage.getItem(SEEN_KEY);
    return v === null ? null : Number(v);
  } catch {
    return null;
  }
};

const writeSeen = (id) => {
  try {
    localStorage.setItem(SEEN_KEY, String(id));
  } catch {
    /* ignore */
  }
};

export default function Layout() {
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const { user, isAdmin, logout } = useAuth();
  const { access } = useAccess();
  const words = WORDS[access];
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [unread, setUnread] = useState(0);
  const [query, setQuery] = useState("");
  const { projects, selected, select } = useProjects();
  const menuRef = useRef(null);
  const searchRef = useRef(null);
  const cancelRef = useRef(null);

  // The project picked in the sidebar (null when "All tasks" is showing).
  const selectedProject = selected
    ? projects.find((p) => String(p.id) === String(selected)) || null
    : null;

  useEffect(() => {
    setMobileOpen(false);
    setMenuOpen(false);
  }, [pathname]);

  // Close the project history if the page or the selected project changes.
  useEffect(() => {
    setHistoryOpen(false);
  }, [pathname, selected]);

  // Cmd/Ctrl + K focuses the search box.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Close the account menu on outside click / Escape.
  useEffect(() => {
    if (!menuOpen) return undefined;
    const onDown = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  // Logout confirmation: focus Cancel, close on Escape.
  useEffect(() => {
    if (!confirmOpen) return undefined;
    cancelRef.current?.focus();
    const onKey = (e) => {
      if (e.key === "Escape" && !signingOut) setConfirmOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [confirmOpen, signingOut]);

  const myName = user?.full_name;

  // Keep the sidebar project list fresh (new assignments show up without a reload).
  useEffect(() => {
    const timer = setInterval(loadProjects, POLL_MS);
    return () => clearInterval(timer);
  }, []);

  // Admin only: count complaints added by users since the admin last opened the list.
  useEffect(() => {
    if (!isAdmin) {
      setUnread(0);
      return undefined;
    }
    let cancelled = false;

    const check = async () => {
      try {
        const items = await getComplaints();
        if (cancelled) return;
        const maxId = items.reduce((m, c) => Math.max(m, c.id), 0);
        let seen = readSeen();

        if (pathname === "/") {
          writeSeen(maxId);
          setUnread(0);
          return;
        }
        if (seen === null) {
          writeSeen(maxId);
          seen = maxId;
        }
        setUnread(
          items.filter((c) => c.id > seen && c.created_by_name !== myName).length
        );
      } catch {
        /* ignore, try again on next poll */
      }
    };

    check();
    const timer = setInterval(check, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [isAdmin, pathname, myName]);

  const toggleCollapse = () => {
    setCollapsed((c) => {
      try {
        localStorage.setItem("sidebar-collapsed", c ? "0" : "1");
      } catch {
        /* ignore */
      }
      return !c;
    });
  };

  // Step 1: the logout buttons only open the confirmation.
  const askSignOut = () => {
    setMenuOpen(false);
    setMobileOpen(false);
    setConfirmOpen(true);
  };

  // Step 2: the real logout, run only after the user confirms.
  const signOut = async () => {
    setSigningOut(true);
    try {
      await logout();
    } finally {
      setSigningOut(false);
      setConfirmOpen(false);
    }
    navigate("/login", { replace: true });
  };

  const submitSearch = (e) => {
    e.preventDefault();
    const q = query.trim();
    navigate(q ? `/?q=${encodeURIComponent(q)}` : "/");
  };

  const name = user?.full_name || "User";
  const role = isAdmin ? "Super admin" : "User";
  const initial = name.charAt(0).toUpperCase();
  const page = pageFor(pathname, words);

  // Sprints are for the development side: admin, or developer / both access (not support).
  const canSeeSprints = isAdmin || access === "developer" || access === "both";
  // "My complaints" is for the support side: support / both access (not the admin).
  const canSeeComplaints = !isAdmin && (access === "support" || access === "both");

  // "My sprints": the sprints the admin gave this person (not shown to the admin).
  // For a non-admin developer, a project in the sidebar opens that project's sprints.
  // For a support user, a project in the sidebar opens that project's complaints.
  // The admin gets the same complaints page for a support project (all complaints, not just their own).
  const onMySprints = pathname.startsWith("/my-sprints");
  const onMyComplaints = pathname.startsWith("/my-complaints");
  const sprintProject = onMySprints ? new URLSearchParams(search).get("project") || "" : "";
  const complaintProject = onMyComplaints ? new URLSearchParams(search).get("project") || "" : "";

  // Where a project in the sidebar leads, and whether it is the open one.
  const projectTarget = (p) => {
    const supportSide = p.kind === "support" || access === "support";
    if ((canSeeComplaints || isAdmin) && supportSide) {
      return {
        to: `/my-complaints?project=${p.id}`,
        active: complaintProject === String(p.id),
      };
    }
    if (canSeeSprints && !supportSide) {
      return {
        to: `/my-sprints?project=${p.id}`,
        active: sprintProject === String(p.id),
      };
    }
    return { to: "/", active: pathname === "/" && selected === String(p.id) };
  };

  // Admin (and "both") see development and support projects as two groups.
  const projectGroups =
    access === "both"
      ? [
          { title: "Development projects", list: projects.filter((p) => p.kind !== "support") },
          { title: "Support projects", list: projects.filter((p) => p.kind === "support") },
        ]
      : [{ title: "Your projects", list: projects }];

  // "Sprints" (plan and run) is admin only; "My sprints" is for everyone else on the dev side;
  // "My complaints" is for the support side.
  const visibleNav = NAV.filter(
    (n) =>
      (!n.admin || isAdmin) &&
      (!n.mine || (!isAdmin && canSeeSprints)) &&
      (!n.support || canSeeComplaints)
  ).map((n) =>
    n.to === "/"
      ? { ...n, label: words.list }
      : n.to === "/new"
        ? { ...n, label: words.create }
        : n
  );
  const groups = visibleNav.reduce((acc, n) => {
    const g = acc.find((x) => x.name === n.group);
    if (g) g.items.push(n);
    else acc.push({ name: n.group, items: [n] });
    return acc;
  }, []);

  const badgeFor = (n) =>
    n.to === "/" && isAdmin && unread > 0 ? (
      <span className="lay-badge" aria-label={`${unread} new complaints`}>
        {unread > 99 ? "99+" : unread}
      </span>
    ) : null;

  return (
    <div className={`lay ${collapsed ? "is-collapsed" : ""} ${mobileOpen ? "is-open" : ""}`}>
      <aside className="lay-side" aria-label="Main navigation">
        <div className="lay-brand">
          <Link to="/" className="lay-logo" title="Complaint Followup">
            <span className="lay-mark">C</span>
            <span className="lay-name">Complaint Followup</span>
          </Link>
          <button
            type="button"
            className="lay-collapse"
            onClick={toggleCollapse}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {icons.panel}
          </button>
          <button
            type="button"
            className="lay-close"
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
          >
            {icons.close}
          </button>
        </div>

        <button
          type="button"
          className="lay-sidesearch"
          onClick={() => {
            setMobileOpen(false);
            searchRef.current?.focus();
          }}
          title="Search"
        >
          <span className="lay-sidesearch-ico">{icons.search}</span>
          <span className="lay-sidesearch-text">Search...</span>
          <kbd className="lay-kbd">⌘ K</kbd>
        </button>

        <nav className="lay-nav">
          {groups.map((g) => (
            <div className="lay-group" key={g.name}>
              <span className="lay-group-title">{g.name}</span>
              {g.items.map((n) => (
                <NavLink
                  key={n.to}
                  to={n.to}
                  end={n.end}
                  title={n.label}
                  className={({ isActive }) =>
                    `lay-link ${
                      isActive &&
                      !(n.to === "/" && selected) &&
                      !(n.to === "/my-sprints" && sprintProject) &&
                      !(n.to === "/my-complaints" && complaintProject)
                        ? "active"
                        : ""
                    }`
                  }
                  onClick={n.to === "/" ? () => select("") : undefined}
                >
                  <span className="lay-ico">
                    {icons[n.icon]}
                    {badgeFor(n)}
                  </span>
                  <span className="lay-label">{n.label}</span>
                </NavLink>
              ))}
            </div>
          ))}

          {projectGroups.map((g) => (
            <div className="lay-group" key={g.title}>
              <span className="lay-group-title">{g.title}</span>
              {g.list.map((p) => {
                const target = projectTarget(p);
                return (
                  <Link
                    key={p.id}
                    to={target.to}
                    title={p.name}
                    className={`lay-link ${target.active ? "active" : ""}`}
                    onClick={() => select(p.id)}
                  >
                    <span className="lay-ico">{icons.folder}</span>
                    <span className="lay-label">{p.name}</span>
                  </Link>
                );
              })}
              {g.list.length === 0 && (
                <span className="lay-label" style={{ padding: "6px 12px", opacity: 0.6, fontSize: 13 }}>
                  No projects yet
                </span>
              )}
            </div>
          ))}
        </nav>

        <div className="lay-foot">
          <span className="lay-avatar">{initial}</span>
          <div className="lay-user">
            <strong>{name}</strong>
            <small>{role}</small>
          </div>
          <button
            type="button"
            className="lay-logout"
            onClick={askSignOut}
            title="Sign out"
            aria-label="Sign out"
          >
            {icons.logout}
          </button>
        </div>
      </aside>

      <div className="lay-backdrop" onClick={() => setMobileOpen(false)} />

      <div className="lay-content">
        <header className="lay-top">
          <button
            type="button"
            className="lay-burger"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            {icons.menu}
          </button>

          <form className="lay-search" role="search" onSubmit={submitSearch}>
            <span className="lay-search-ico">{icons.search}</span>
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={words.search}
              aria-label="Search"
            />
          </form>

          <NotificationBell />

          <div className="lay-account" ref={menuRef}>
            <button
              type="button"
              className="lay-account-btn"
              onClick={() => setMenuOpen((o) => !o)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label="Account menu"
            >
              <span className="lay-avatar lay-avatar-sm">{initial}</span>
              <span className="lay-account-name">{name}</span>
              <span className="lay-account-caret">{icons.caret}</span>
            </button>

            {menuOpen && (
              <div className="lay-menu" role="menu">
                <div className="lay-menu-head">
                  <strong>{name}</strong>
                  <small>{role}</small>
                </div>
                <button type="button" role="menuitem" className="lay-menu-item" onClick={askSignOut}>
                  {icons.logout}
                  <span>Sign out</span>
                </button>
              </div>
            )}
          </div>
        </header>

        <div className="lay-card">
          {page.title && (
            <div className="lay-pagehead">
              <div className="lay-pagehead-text">
                <h1>{page.title}</h1>
                <p>{page.sub}</p>
              </div>
              <div
                className="lay-pagehead-actions"
                style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 12 }}
              >
                <div id="lay-head-slot" className="lay-head-slot" style={{ display: "contents" }} />
                {pathname === "/" && selectedProject && (
                  <button
                    type="button"
                    className="lay-hist"
                    onClick={() => setHistoryOpen(true)}
                    title={`History of ${selectedProject.name}`}
                  >
                    {icons.history}
                    <span>Project history</span>
                  </button>
                )}
                {pathname !== "/sprints" && (
                  <Link to="/new" className="lay-new">
                    {icons.plusSm}
                    <span>{words.create}</span>
                  </Link>
                )}
              </div>
            </div>
          )}
          <main className="lay-main">
            <Outlet />
          </main>
        </div>
      </div>

      {/* Mobile bottom navigation */}
      <nav className="lay-bottom" aria-label="Quick navigation">
        {visibleNav.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            className={({ isActive }) => `lay-bn-link ${isActive ? "active" : ""}`}
          >
            <span className="lay-ico">
              {icons[n.icon]}
              {badgeFor(n)}
            </span>
            <span className="lay-bn-label">{n.label}</span>
          </NavLink>
        ))}
      </nav>

      {historyOpen && selectedProject && (
        <ProjectHistoryDrawer
          project={selectedProject}
          onClose={() => setHistoryOpen(false)}
        />
      )}

      {/* Logout confirmation */}
      {confirmOpen && (
        <div
          className="lay-confirm-backdrop"
          onClick={() => !signingOut && setConfirmOpen(false)}
        >
          <div
            className="lay-confirm"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="lay-confirm-title"
            aria-describedby="lay-confirm-text"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="lay-confirm-ico">{icons.logout}</span>
            <h2 id="lay-confirm-title">Sign out?</h2>
            <p id="lay-confirm-text">You will need to sign in again to continue.</p>
            <div className="lay-confirm-actions">
              <button
                type="button"
                ref={cancelRef}
                className="lay-confirm-btn"
                onClick={() => setConfirmOpen(false)}
                disabled={signingOut}
              >
                Cancel
              </button>
              <button
                type="button"
                className="lay-confirm-btn is-danger"
                onClick={signOut}
                disabled={signingOut}
              >
                {signingOut ? "Signing out..." : "Sign out"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}