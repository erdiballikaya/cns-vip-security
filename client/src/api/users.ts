import { http } from "./http";

export type UserDto = {
  _id: string;
  email: string;
  role: "ADMIN" | "MANAGER" | "PERSONNEL";
  enabledModules: string[];
  createdAt: string;
};

export async function getUsers() {
  const res = await http.get<UserDto[]>("/users");
  return res.data;
}

export async function updateUserModules(id: string, enable: string[], disable: string[]) {
  const res = await http.patch<{ id: string; enabledModules: string[] }>(`/users/${id}/modules`, {
    enable,
    disable,
  });
  return res.data;
}

export async function updateUserRole(id: string, role: UserDto["role"]) {
  const res = await http.patch<UserDto>(`/users/${id}/role`, { role });
  return res.data;
}

export async function createUser(payload: {
  email: string;
  password: string;
  role: UserDto["role"];
  enabledModules: string[];
}) {
  const res = await http.post<UserDto>("/users", payload);
  return res.data;
}

export async function deleteUser(id: string) {
  const res = await http.delete<{ ok: boolean; id: string }>(`/users/${id}`);
  return res.data;
}

