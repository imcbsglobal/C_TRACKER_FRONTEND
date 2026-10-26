import client from "./client";

// params = { project, status }  status = "planned" | "active" | "completed"
export const getSprints = async (params = {}) => {
  const { data } = await client.get("/sprints/", { params });
  return data;
};

export const createSprint = async (payload) => {
  const { data } = await client.post("/sprints/", payload);
  return data;
};

export const updateSprint = async (id, patch) => {
  const { data } = await client.patch(`/sprints/${id}/`, patch);
  return data;
};

export const deleteSprint = async (id) => {
  await client.delete(`/sprints/${id}/`);
};

export const startSprint = async (id) => {
  const { data } = await client.post(`/sprints/${id}/start/`);
  return data;
};

// moveTo = id of a planned sprint, or null to send unfinished cases to the backlog
export const completeSprint = async (id, moveTo = null) => {
  const { data } = await client.post(`/sprints/${id}/complete/`, { move_to: moveTo });
  return data;
};

export const addCasesToSprint = async (id, cases) => {
  const { data } = await client.post(`/sprints/${id}/add-cases/`, { cases });
  return data;
};

export const removeCasesFromSprint = async (id, cases) => {
  const { data } = await client.post(`/sprints/${id}/remove-cases/`, { cases });
  return data;
};

// Cases of a sprint: getComplaints({ sprint: id }) — backlog: getComplaints({ sprint: "none", project })