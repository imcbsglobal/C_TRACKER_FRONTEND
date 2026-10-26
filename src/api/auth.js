import client from "./client";

export const login = async (email, password) => {
  const { data } = await client.post("/auth/login/", { email, password });
  return data;
};

export const logout = async () => {
  await client.post("/auth/logout/");
};

export const getMe = async () => {
  const { data } = await client.get("/auth/me/");
  return data;
};

export const getUsers = async () => {
  const { data } = await client.get("/users/");
  return data;
};

export const createUser = async (payload) => {
  const { data } = await client.post("/users/", payload);
  return data;
};

export const updateUser = async (id, patch) => {
  const { data } = await client.patch(`/users/${id}/`, patch);
  return data;
};

export const deleteUser = async (id) => {
  await client.delete(`/users/${id}/`);
};