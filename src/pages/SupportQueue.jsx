import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  clearEscalation,
  escalateComplaint,
  getComplaint,
  getComplaints,
  getHistory,
  getTeam,
  selfAssignComplaint,
  updateComplaint,
} from "../api/complaints";
import { PRIORITIES, STATUSES, isOverdue, priorityTone, statusTone, useConfig } from "../constants";
import { useProjects } from "../projects";
import "./Urgent.scss";
import "./SupportQueue.scss";

const when = (d) =>
  new Date(d).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

const apiMessage = (err, fallback) => {
  const body = err?.response?.data;
  const first = body && typeof body === "object" ? Object.values(body)[0] : null;
  return (Array.isArray(first) ? first[0] : first) || fallback;
};

// ---------- one case row ----------
function CaseRow({ c, onOpen, onSelfAssign, busy }) {
  const pTone = priorityTone(c.priority);
  const sTone = statusTone(c.status);
  const statusLabel = STATUSES.find((s) => s.value === c.status)?.label || c.status;
  const priorityLabel = PRIORITIES.find((p) => p.value === c.priority)?.label || c.priority;

  return (
    <div
      className={`sq__row ${c.urgent ? "sq__row--urgent" : ""}`}
      role="button"
      tabIndex={0}
      onClick={() => onOpen(c.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(c.id);
        }
      }}
    >
      <div className="sq__row-main">
        <div className="sq__row-id">
          <span className="sq__case-id">{c.case_number || c.task_number}</span>
          {c.urgent && (
            <span className="urgent-light" title="New from admin" aria-label="New from admin" />
          )}
        </div>
        <div className="sq__row-title">{c.title}</div>
        <div className="sq__row-meta">
          {c.customer || "No customer"}
          {c.product_name ? ` · ${c.product_name}` : ""} ·{" "}
          <span className={`sq__prio sq__prio--${pTone}`}>{priorityLabel}</span>
          {c.due_date && (
            <span className={isOverdue(c) ? "sq__overdue" : ""}> · due {c.due_date}</span>
          )}
          {c.assigned_to_name ? ` · ${c.assigned_to_name}` : ""}
        </div>
      </div>

      <div className="sq__row-side">
        {c.escalated_to && (
          <span className="sq__esc" title={`Escalated to ${c.escalated_to_name}`}>
            ⚠ {c.escalated_to_me ? "Escalated to you" : `→ ${c.escalated_to_name}`}
          </span>
        )}
        <span className={`sq__badge sq__badge--${sTone}`}>
          <span className="sq__badge-dot" />
          {statusLabel}
        </span>
        {!c.assigned_to && !c.is_closed && (
          <button
            type="button"
            className="sq__btn sq__btn--primary sq__btn--sm"
            disabled={busy}
            onClick={(e) => {
              e.stopPropagation();
              onSelfAssign(c);
            }}
          >
            Self-assign
          </button>
        )}
      </div>
    </div>
  );
}

function Section({ title, hint, rows, empty, children }) {
  return (
    <section className="sq__section">
      <h2 className="sq__section-title">
        {title} <span className="sq__section-count">{rows.length}</span>
      </h2>
      {hint && <p className="sq__section-hint">{hint}</p>}
      <div className="sq__list">
        {rows.length ? children : <div className="sq__empty">{empty}</div>}
      </div>
    </section>
  );
}

// ---------- case drawer ----------
function CaseDrawer({ c, team, onClose, onChange, onNotice }) {
  const { projects } = useProjects();
  const [history, setHistory] = useState([]);
  const [loadingLog, setLoadingLog] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const reloadLog = () =>
    getHistory(c.id)
      .then(setHistory)
      .catch(() => {})
      .finally(() => setLoadingLog(false));

  useEffect(() => {
    setLoadingLog(true);
    reloadLog();
    // opening a case puts out its "new from admin" light for this user
    getComplaint(c.id).then(onChange).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c.id]);

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

  const run = async (fn, okText) => {
    setBusy(true);
    setError("");
    try {
      const updated = await fn();
      onChange(updated);
      if (okText) onNotice(okText);
      await reloadLog();
    } catch (err) {
      setError(apiMessage(err, "That didn't save. Try again."));
    }
    setBusy(false);
  };

  const canEdit = c.can_edit !== false;
  // Support people in this case's project (the backend only accepts project members).
  const proj = projects.find((p) => p.id === c.project);
  const teamHere = team.filter(
    (t) =>
      (!t.access || ["support", "both"].includes(t.access)) &&
      (!proj || proj.members.includes(t.id) || t.id === c.assigned_to)
  );
  const escalateOptions = teamHere.filter((t) => t.id !== c.assigned_to);
  if (c.escalated_to && !escalateOptions.some((t) => t.id === c.escalated_to)) {
    escalateOptions.push({ id: c.escalated_to, full_name: c.escalated_to_name });
  }
  const idx = Math.max(0, STATUSES.findIndex((s) => s.value === c.status));

  return (
    <div className="sq__overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <aside className="sq__drawer" role="dialog" aria-modal="true" aria-label="Case details">
        <header className="sq__drawer-head">
          <button type="button" className="sq__close" onClick={onClose} aria-label="Close">
            ✕
          </button>
          <span className="sq__eyebrow">Case</span>
          <div className="sq__drawer-id">{c.case_number || c.task_number}</div>
          <div className="sq__drawer-sub">
            {c.product_name || "No product set"}
          </div>
        </header>

        <div className="sq__drawer-body">
          <h3 className="sq__drawer-title">{c.title}</h3>
          <p className="sq__drawer-desc">{c.description || "No further description provided."}</p>
          <p className="sq__drawer-desc">
            Customer: <strong>{c.customer || "—"}</strong>
            {c.phone ? ` · ${c.phone}` : ""}
          </p>
          <Link to={`/complaints/${c.id}`} className="sq__link">
            Open full page (follow-ups, helpers, due date) →
          </Link>

          {error && <div className="sq__alert" role="alert">{error}</div>}
          {!canEdit && (
            <div className="sq__note" role="status">
              {c.assigned_to
                ? `Assigned to ${c.assigned_to_name}. Only the assignee, helpers or whoever filed it can change this case.`
                : "You can view this case. Self-assign it to work on it."}
            </div>
          )}

          <div className="sq__label">Progress</div>
          <ol className="sq__stepper">
            {STATUSES.map((s, i) => (
              <li
                key={s.value}
                className={`sq__step ${i < idx ? "is-done" : ""} ${i === idx ? "is-current" : ""}`}
              >
                <span className="sq__step-dot">{i < idx ? "✓" : i + 1}</span>
                <span className="sq__step-label">{s.label}</span>
              </li>
            ))}
          </ol>

          <div className="sq__label">Assignment</div>
          <div className="sq__assign">
            {canEdit ? (
              <select
                className="sq__input"
                value={c.assigned_to || ""}
                disabled={busy}
                onChange={(e) =>
                  run(
                    () => updateComplaint(c.id, { assigned_to: e.target.value || null }),
                    "Assignment updated."
                  )
                }
              >
                <option value="">Unassigned</option>
                {teamHere.map((t) => (
                  <option key={t.id} value={t.id}>{t.full_name}</option>
                ))}
              </select>
            ) : (
              <span className="sq__input sq__input--static">{c.assigned_to_name || "Unassigned"}</span>
            )}
            {!c.assigned_to && !c.is_closed && (
              <button
                type="button"
                className="sq__btn sq__btn--primary sq__btn--sm"
                disabled={busy}
                onClick={() => run(() => selfAssignComplaint(c.id), "Case assigned to you.")}
              >
                Self-assign
              </button>
            )}
          </div>

          <div className="sq__label">Priority</div>
          <div className="sq__pills">
            {PRIORITIES.map((p) => (
              <button
                key={p.value}
                type="button"
                disabled={!canEdit || busy}
                className={`sq__pill sq__pill--${priorityTone(p.value)} ${c.priority === p.value ? "is-on" : ""}`}
                onClick={() =>
                  c.priority !== p.value &&
                  run(() => updateComplaint(c.id, { priority: p.value }), "Priority updated.")
                }
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="sq__label">Update status</div>
          <div className="sq__pills">
            {STATUSES.map((s) => (
              <button
                key={s.value}
                type="button"
                className="sq__btn sq__btn--ghost sq__btn--sm"
                disabled={!canEdit || busy || c.status === s.value}
                onClick={() =>
                  run(() => updateComplaint(c.id, { status: s.value }), `Case marked ${s.label}.`)
                }
              >
                {s.label}
              </button>
            ))}
          </div>

          <div className="sq__label">Escalate to</div>
          <div className="sq__assign">
            <select
              className="sq__input"
              value={c.escalated_to || ""}
              disabled={!canEdit || busy || c.is_closed}
              onChange={(e) =>
                e.target.value
                  ? run(() => escalateComplaint(c.id, Number(e.target.value)), "Case escalated.")
                  : run(() => clearEscalation(c.id), "Escalation cleared.")
              }
            >
              <option value="">Not escalated</option>
              {escalateOptions.map((t) => (
                <option key={t.id} value={t.id}>{t.full_name}</option>
              ))}
            </select>
          </div>
          <p className="sq__muted">The person you pick is added as a helper and notified.</p>

          <div className="sq__label">History &amp; log</div>
          {loadingLog && <p className="sq__muted">Loading...</p>}
          <ul className="sq__timeline">
            {history.map((h) => (
              <li key={h.id}>
                <span className="sq__tl-dot" aria-hidden="true">•</span>
                <div>
                  <div className="sq__tl-text">
                    <strong>{h.actor || "Someone"}</strong> — {h.message}
                  </div>
                  <small className="sq__muted">{when(h.created_at)}</small>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}

// ---------- the queue ----------
export default function SupportQueue() {
  useConfig(); // re-render when the admin changes statuses / priorities
  const [params] = useSearchParams();
  const q = (params.get("q") || "").toLowerCase();
  const { selected: fProject } = useProjects();

  const [items, setItems] = useState([]);
  const [team, setTeam] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [openId, setOpenId] = useState(null);
  const [showClosed, setShowClosed] = useState(false);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    Promise.all([getComplaints(), getTeam()])
      .then(([c, t]) => {
        setItems(c);
        setTeam(t);
      })
      .catch(() => setError("Could not load cases. Is the backend running?"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!notice) return undefined;
    const t = setTimeout(() => setNotice(""), 3500);
    return () => clearTimeout(t);
  }, [notice]);

  const replace = (updated) =>
    setItems((prev) => prev.map((x) => (x.id === updated.id ? { ...x, ...updated } : x)));

  const selfAssign = async (c) => {
    setBusyId(c.id);
    setError("");
    try {
      replace(await selfAssignComplaint(c.id));
      setNotice(`${c.case_number} is now assigned to you.`);
    } catch (err) {
      setError(apiMessage(err, "Could not self-assign this case."));
    }
    setBusyId(null);
  };

  const shown = useMemo(
    () =>
      items.filter(
        (c) =>
          c.kind === "complaint" &&
          (!fProject || String(c.project) === String(fProject)) &&
          `${c.title} ${c.case_number || ""} ${c.customer || ""} ${c.product_name || ""}`
            .toLowerCase()
            .includes(q)
      ),
    [items, fProject, q]
  );

  const active = shown.filter((c) => !c.is_closed);
  const unassigned = active.filter((c) => !c.assigned_to);
  const mine = active.filter((c) => c.assigned_to && c.is_mine);
  const rest = active.filter((c) => c.assigned_to && !c.is_mine);
  const closed = shown.filter((c) => c.is_closed);
  const escalated = active.filter((c) => c.escalated_to);

  const open = items.find((c) => c.id === openId);
  const row = (c) => (
    <CaseRow key={c.id} c={c} onOpen={setOpenId} onSelfAssign={selfAssign} busy={busyId === c.id} />
  );

  return (
    <div className="sq">
      <div className="sq__head">
        <div>
          <h1 className="sq__title">Support queue</h1>
          <p className="sq__sub">Pick up unassigned cases or work your own. You can read every case, and edit your own.</p>
        </div>
      </div>

      {error && <div className="sq__alert" role="alert">{error}</div>}
      {notice && <div className="sq__toast" role="status">{notice}</div>}

      <div className="sq__stats">
        <div className="sq__stat"><div className="sq__stat-n">{unassigned.length}</div><div className="sq__stat-l">Unassigned</div></div>
        <div className="sq__stat"><div className="sq__stat-n">{mine.length}</div><div className="sq__stat-l">Assigned to me</div></div>
        <div className="sq__stat"><div className="sq__stat-n">{escalated.length}</div><div className="sq__stat-l">Escalated</div></div>
      </div>

      {loading ? (
        <p className="sq__muted">Loading...</p>
      ) : (
        <>
          <Section
            title="Unassigned"
            hint="Self-assign a case to take it on."
            rows={unassigned}
            empty="Queue is clear."
          >
            {unassigned.map(row)}
          </Section>

          <Section title="My cases" rows={mine} empty="Nothing assigned to you right now.">
            {mine.map(row)}
          </Section>

          <Section
            title="Rest of the team"
            hint="Read-only for you unless you are added as a helper."
            rows={rest}
            empty="No other active cases."
          >
            {rest.map(row)}
          </Section>

          {closed.length > 0 && (
            <div className="sq__closed">
              <button
                type="button"
                className="sq__btn sq__btn--ghost sq__btn--sm"
                onClick={() => setShowClosed((s) => !s)}
                aria-expanded={showClosed}
              >
                {showClosed ? "Hide" : "Show"} closed cases ({closed.length})
              </button>
              {showClosed && <div className="sq__list">{closed.map(row)}</div>}
            </div>
          )}
        </>
      )}

      {open && (
        <CaseDrawer
          key={open.id}
          c={open}
          team={team}
          onClose={() => setOpenId(null)}
          onChange={replace}
          onNotice={setNotice}
        />
      )}
    </div>
  );
}