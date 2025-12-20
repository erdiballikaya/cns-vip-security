import { http } from "./http";

export type FieldType = "text" | "number" | "boolean" | "select" | "image";
export type PageField = {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  order?: number;
  min?: number;
  max?: number;
  options?: { label: string; value: string }[];
  defaultValue?: any;
};

export type PageSchemaDto = {
  pageKey: string;
  title: string;
  fields: PageField[];
};

export async function getPageSchema(pageKey: string) {
  const res = await http.get<PageSchemaDto>(`/page-schemas/${pageKey}`);
  return res.data;
}

export async function addPageField(pageKey: string, payload: any) {
  const res = await http.post<PageSchemaDto>(`/page-schemas/${pageKey}/fields`, payload);
  return res.data;
}

export async function updatePageField(pageKey: string, fieldKey: string, payload: any) {
  const res = await http.put<PageSchemaDto>(`/page-schemas/${pageKey}/fields/${fieldKey}`, payload);
  return res.data;
}

export async function removePageField(pageKey: string, fieldKey: string) {
  const res = await http.delete<PageSchemaDto>(`/page-schemas/${pageKey}/fields/${fieldKey}`);
  return res.data;
}
