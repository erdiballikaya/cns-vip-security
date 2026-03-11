import { http } from "./http";

export type SiteDto = {
  _id: string;
  name: string;
  address?: string;
  logoUrl?: string;
  dynamic?: Record<string, any>;
  personnel?: SitePersonnelDto[];
  createdAt: string;
  updatedAt?: string;
};

export type SitePersonnelDto = {
  name: string;
  role?: string;
  phone?: string;
  email?: string;
};

export async function getSites() {
  const res = await http.get<SiteDto[]>("/sites");
  return res.data;
}

export async function getSiteById(id: string) {
  const res = await http.get<SiteDto>(`/sites/${id}`);
  return res.data;
}

export async function updateSite(
  id: string,
  payload: Partial<Pick<SiteDto, "name" | "address" | "logoUrl" | "dynamic" | "personnel">>
) {
  const res = await http.patch<SiteDto>(`/sites/${id}`, payload);
  return res.data;
}

export async function deleteSite(id: string) {
  await http.delete(`/sites/${id}`);
}
