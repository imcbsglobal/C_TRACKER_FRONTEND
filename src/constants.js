import { useEffect, useState } from "react";
import { getConfig } from "./api/config";

// Statuses, priorities and categories are managed by the admin and stored on the
// server. These arrays start with the original defaults and are replaced in place
// as soon as the real lists arrive, so every file that imports them (including
// ones that don't call useConfig) always reads the current values.
export const STATUSES = [
  { value: "open", label: "Open", tone: "grey", is_closed: false },
  { value: "in_progress", label: "In progress", tone: "blue", is_closed: false },
  { value: "resolved", label: "Resolved", tone: "green", is_closed: true },
  { value: "closed", label: "Closed", tone: "purple", is_closed: true },
];

// Ordered lowest -> highest
export const PRIORITIES = [
  { value: "low", label: "Low", tone: "green" },
  { value: "medium", label: "Medium", tone: "yellow" },
  { value: "high", label: "High", tone: "red" },
];

export const CATEGORIES = ["General", "Maintenance", "Service", "Billing"];

export const TONE_COLORS = {
  grey: { bg: "#ecefe9", fg: "#566052" },
  blue: { bg: "#dfeafb", fg: "#2461c4" },
  yellow: { bg: "#fcecc6", fg: "#9a6200" },
  green: { bg: "#dcf2dc", fg: "#2c7a38" },
  purple: { bg: "#ebe2fb", fg: "#6a3fc0" },
  red: { bg: "#fde3e0", fg: "#d23a30" },
};
export const TONES = Object.keys(TONE_COLORS);

export const statusTone = (value) =>
  STATUSES.find((s) => s.value === value)?.tone || "grey";
export const priorityTone = (value) =>
  PRIORITIES.find((p) => p.value === value)?.tone || "grey";

export const isClosedStatus = (value) => {
  const s = STATUSES.find((x) => x.value === value);
  return s ? !!s.is_closed : ["resolved", "closed", "done"].includes(value);
};

export const isOverdue = (c) =>
  c.due_date &&
  !isClosedStatus(c.status) &&
  c.due_date < new Date().toISOString().slice(0, 10);

// What a brand-new task starts with (the classic default if it still exists).
export const defaultChoices = () => ({
  status: (STATUSES.find((s) => s.value === "open") || STATUSES[0])?.value || "open",
  priority:
    (PRIORITIES.find((p) => p.value === "medium") || PRIORITIES[0])?.value || "medium",
  category: CATEGORIES.includes("General") ? "General" : CATEGORIES[0] || "General",
});

// ---------- loading + live updates ----------
const listeners = new Set();
let inflight = null;

const replace = (arr, next) => arr.splice(0, arr.length, ...next);

export const applyConfig = ({ statuses, priorities, categories }) => {
  replace(
    STATUSES,
    statuses.map((s) => ({
      value: s.value,
      label: s.label,
      tone: s.tone,
      is_closed: s.is_closed,
    }))
  );
  replace(
    PRIORITIES,
    priorities.map((p) => ({ value: p.value, label: p.label, tone: p.tone }))
  );
  replace(
    CATEGORIES,
    categories.map((c) => c.name)
  );
  listeners.forEach((fn) => fn());
};

export const loadConfig = (force = false) => {
  if (inflight && !force) return inflight;
  inflight = getConfig()
    .then((data) => {
      applyConfig(data);
      return data;
    })
    .catch(() => {
      inflight = null; // try again next time
    });
  return inflight;
};

// Call at the top of any component that shows these lists so it re-renders
// when they load or when the admin changes them.
export function useConfig() {
  const [, bump] = useState(0);
  useEffect(() => {
    const fn = () => bump((n) => n + 1);
    listeners.add(fn);
    loadConfig();
    return () => listeners.delete(fn);
  }, []);
}

export const isAdminUser = () => {
  try {
    return !!JSON.parse(localStorage.getItem("user") || "{}").is_admin;
  } catch {
    return false;
  }
};