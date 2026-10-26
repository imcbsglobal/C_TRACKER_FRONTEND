import { useEffect, useState } from "react";
import { getProjects } from "./api/projects";

// The projects the logged-in user can see (admin: all; users: only theirs).
// The array is replaced in place so every screen reads the current list.
export const PROJECTS = [];

const listeners = new Set();
const notify = () => listeners.forEach((fn) => fn());

export const applyProjects = (list) => {
  PROJECTS.splice(0, PROJECTS.length, ...list);
  notify();
};

export const loadProjects = () =>
  getProjects()
    .then((list) => {
      applyProjects(list);
      return list;
    })
    .catch(() => {});

// Which project the board is showing ("" = all projects). Remembered per browser.
const KEY = "project";
export const setSelectedProject = (id) => {
  try {
    localStorage.setItem(KEY, id ? String(id) : "");
  } catch {
    /* ignore */
  }
  notify();
};

export function useProjects() {
  const [, bump] = useState(0);
  useEffect(() => {
    const fn = () => bump((n) => n + 1);
    listeners.add(fn);
    loadProjects(); // refetch on every mount so a different login never sees stale projects
    return () => listeners.delete(fn);
  }, []);

  let stored = "";
  try {
    stored = localStorage.getItem(KEY) || "";
  } catch {
    /* ignore */
  }
  const selected = PROJECTS.some((p) => String(p.id) === stored) ? stored : "";
  return { projects: PROJECTS, selected, select: setSelectedProject };
}