import client from "./client";

export const getProjects = async () => {
  const { data } = await client.get("/projects/");
  return data;
};

export const createProject = async (payload) => {
  const { data } = await client.post("/projects/", payload);
  return data;
};

export const updateProject = async (id, patch) => {
  const { data } = await client.patch(`/projects/${id}/`, patch);
  return data;
};

export const deleteProject = async (id) => {
  await client.delete(`/projects/${id}/`);
};

export const getProjectHistory = async (id) => {
  const { data } = await client.get(`/projects/${id}/history/`);
  return data;
};