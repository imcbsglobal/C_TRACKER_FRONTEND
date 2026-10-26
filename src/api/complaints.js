import client from "./client";

export const getComplaints = async (params = {}) => {
  const { data } = await client.get("/complaints/", { params });
  return data;
};

export const getComplaint = async (id) => {
  const { data } = await client.get(`/complaints/${id}/`);
  return data;
};

// files = optional images (sent together with the fields as multipart)
export const createComplaint = async (payload, files = []) => {
  if (files.length) {
    const form = new FormData();
    Object.entries(payload).forEach(([key, value]) => {
      if (value === null || value === undefined || value === "") return;
      if (Array.isArray(value)) value.forEach((v) => form.append(key, v));
      else form.append(key, value);
    });
    files.forEach((f) => form.append("images", f));
    const { data } = await client.post("/complaints/", form);
    return data;
  }
  const { data } = await client.post("/complaints/", payload);
  return data;
};

export const updateComplaint = async (id, patch) => {
  const { data } = await client.patch(`/complaints/${id}/`, patch);
  return data;
};

export const updateStatus = (id, status) => updateComplaint(id, { status });

export const deleteComplaint = async (id) => {
  await client.delete(`/complaints/${id}/`);
};

export const getHistory = async (id) => {
  const { data } = await client.get(`/complaints/${id}/history/`);
  return data;
};

export const selfAssignComplaint = async (id) => {
  const { data } = await client.post(`/complaints/${id}/self-assign/`);
  return data;
};

export const escalateComplaint = async (id, member) => {
  const { data } = await client.post(`/complaints/${id}/escalate/`, { member });
  return data;
};

export const clearEscalation = async (id) => {
  const { data } = await client.post(`/complaints/${id}/clear-escalation/`);
  return data;
};

// ---------- tasks (name + goal) added to a support complaint ----------

// GET /complaint-tasks/?complaint=<id>&project=<id>
export const getComplaintTasks = async (params = {}) => {
  const { data } = await client.get("/complaint-tasks/", { params });
  return data;
};

// payload = { complaint, name, goal, status? }
export const createComplaintTask = async (payload) => {
  const { data } = await client.post("/complaint-tasks/", payload);
  return data;
};

// patch = { name?, goal?, status? }
export const updateComplaintTask = async (id, patch) => {
  const { data } = await client.patch(`/complaint-tasks/${id}/`, patch);
  return data;
};

export const deleteComplaintTask = async (id) => {
  await client.delete(`/complaint-tasks/${id}/`);
};

// Hand one task up: to the admin, or to the developers of the same-named development project.
// body = { target: "admin" | "developers", note?, kind?: "bug" | "task", priority? }
export const escalateComplaintTask = async (id, body) => {
  const { data } = await client.post(`/complaint-tasks/${id}/escalate/`, body);
  return data;
};

// Follow-ups on one task. payload = { task, note }
export const createTaskFollowup = async (payload) => {
  const { data } = await client.post("/task-followups/", payload);
  return data;
};

export const updateTaskFollowup = async (id, note) => {
  const { data } = await client.patch(`/task-followups/${id}/`, { note });
  return data;
};

export const deleteTaskFollowup = async (id) => {
  await client.delete(`/task-followups/${id}/`);
};

// files = optional images (sent together with the note as multipart)
export const addFollowup = async (id, note, files = []) => {
  if (files.length) {
    const form = new FormData();
    form.append("note", note);
    files.forEach((f) => form.append("images", f));
    const { data } = await client.post(`/complaints/${id}/followups/`, form);
    return data;
  }
  const { data } = await client.post(`/complaints/${id}/followups/`, { note });
  return data;
};

export const deleteAttachment = async (id) => {
  await client.delete(`/attachments/${id}/`);
};

export const updateFollowup = async (id, note) => {
  const { data } = await client.patch(`/followups/${id}/`, { note });
  return data;
};

export const deleteFollowup = async (id) => {
  await client.delete(`/followups/${id}/`);
};

// Toggle an emoji reaction on a follow-up (same emoji again removes it).
// emoji = "thumbsup" | "thumbsdown" | "check" | "smile" | "heart" | "tada" | "eyes" | "pray" | "fire" | "wow"
export const reactToFollowup = async (id, emoji) => {
  const { data } = await client.post(`/followups/${id}/react/`, { emoji });
  return data;
};

export const getTeam = async () => {
  const { data } = await client.get("/team/");
  return data;
};

export const createMember = async (payload) => {
  const { data } = await client.post("/team/", payload);
  return data;
};

export const updateMember = async (id, patch) => {
  const { data } = await client.patch(`/team/${id}/`, patch);
  return data;
};

export const removeMember = async (id) => {
  await client.delete(`/team/${id}/`);
};

export const getNotifications = async () => {
  const { data } = await client.get("/notifications/");
  return data;
};

export const markNotificationRead = async (id) => {
  await client.post(`/notifications/${id}/read/`);
};

export const markAllNotificationsRead = async () => {
  await client.post("/notifications/read-all/");
};