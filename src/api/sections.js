import client from "./client";

// Sections are the working areas inside a development project (e.g. "Shift Management").
// params = { project }
export const getSections = async (params = {}) => {
  const { data } = await client.get("/sections/", { params });
  return data;
};

// payload = { project, name }   (admin only)
export const createSection = async (payload) => {
  const { data } = await client.post("/sections/", payload);
  return data;
};

export const updateSection = async (id, patch) => {
  const { data } = await client.patch(`/sections/${id}/`, patch);
  return data;
};

// Its tasks stay in the project, just without a section.
export const deleteSection = async (id) => {
  await client.delete(`/sections/${id}/`);
};