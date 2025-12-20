import { http } from "./http";
import type { FieldDto } from "../components/AddFieldModal";

// Page schema (site-create gibi) için ayrı endpoint
export async function addPageField(pageKey: string, payload: FieldDto) {
  const res = await http.post(`/pages/${pageKey}/fields`, payload);
  return res.data;
}

export async function updatePageField(pageKey: string, fieldKey: string, payload: FieldDto) {
  const res = await http.put(`/pages/${pageKey}/fields/${fieldKey}`, payload);
  return res.data;
}
