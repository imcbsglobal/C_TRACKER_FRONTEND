import client from "./client";

export const getConfig = async () => {
  const { data } = await client.get("/config/");
  return data;
};

// kind = "statuses" | "priorities" | "categories"
export const createOption = async (kind, payload) => {
  const { data } = await client.post(`/${kind}/`, payload);
  return data;
};

export const updateOption = async (kind, id, patch) => {
  const { data } = await client.patch(`/${kind}/${id}/`, patch);
  return data;
};

export const deleteOption = async (kind, id) => {
  await client.delete(`/${kind}/${id}/`);
};

export const reorderOptions = async (kind, ids) => {
  const { data } = await client.post(`/${kind}/reorder/`, { ids });
  return data;
};