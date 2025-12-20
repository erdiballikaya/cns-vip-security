import { http } from "./http";

export type SiteDto = {
  _id: string;
  name: string;
  address?: string;
  dynamic?: Record<string, any>;
  createdAt: string;
  updatedAt?: string;
};

export async function getSites() {
  const res = await http.get<SiteDto[]>("/sites");
  return res.data;
}

export async function getSiteById(id: string) {
  const res = await http.get<SiteDto>(`/sites/${id}`);
  return res.data;
}

export async function updateSite(id: string, payload: Partial<Pick<SiteDto, "name" | "address" | "dynamic">>) {
  const res = await http.patch<SiteDto>(`/sites/${id}`, payload);
  return res.data;
}

export async function deleteSite(id: string) {
  await http.delete(`/sites/${id}`);
}

