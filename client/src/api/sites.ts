import { http } from "./http";

export type SiteDto = {
  _id: string;
  name: string;
  address?: string;
  logoUrl?: string;
  dynamic?: Record<string, any>;
  personnel?: SitePersonnelDto[];
  notificationRecipients?: { email: string }[];
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
  payload: Partial<Pick<SiteDto, "name" | "address" | "logoUrl" | "dynamic" | "personnel" | "notificationRecipients">>
) {
  const res = await http.patch<SiteDto>(`/sites/${id}`, payload);
  return res.data;
}

export async function deleteSite(id: string) {
  await http.delete(`/sites/${id}`);
}

export async function addSiteRecipient(siteId: string, email: string) {
  const res = await http.post<SiteDto>(`/sites/${siteId}/recipients`, { email });
  return res.data;
}

export async function removeSiteRecipient(siteId: string, email: string) {
  const res = await http.delete<SiteDto>(`/sites/${siteId}/recipients/${encodeURIComponent(email)}`);
  return res.data;
}
