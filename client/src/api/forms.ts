import { http } from "./http";

export type FieldType = "text" | "number" | "boolean" | "select" | "image" | "matrix" | "date";

export type FormField = {
  key: string; label: string; type: FieldType;
  required?: boolean; order?: number;
  min?: number; max?: number;
  options?: { label: string; value: string }[];
  defaultValue?: any;
  columnMode?: "manual" | "personnel";
  cellType?: "boolean" | "text";
  columns?: { key: string; label: string; subLabel?: string; cellType?: "boolean" | "text" }[];
  rows?: { key: string; label: string }[];
};

export type FormTemplateDto = {
  _id: string;
  name: string;
  description?: string;
  fields: FormField[];
  recipients: { email: string }[];
  pdfLayout?: string[]; // legacy
  pdfLayoutMode?: "1x1" | "1x2" | "2x1" | "2x2";
  pdfLayoutSlots?: Record<string, string[]>;
  pdfLayoutRatios?: { rows?: [number, number]; cols?: [number, number] };
  pdfGrid?: {
    rows: number;
    cols: number;
    cells: Record<string, string>;
    rowRatios: number[];
    colRatios: number[];
  };
  createdAt?: string;
};

export async function listForms() {
  const res = await http.get<FormTemplateDto[]>("/forms");
  return res.data;
}

export async function createForm(name: string, description?: string) {
  const res = await http.post<FormTemplateDto>("/forms", { name, description });
  return res.data;
}

export async function getForm(id: string) {
  const res = await http.get<FormTemplateDto>(`/forms/${id}`);
  return res.data;
}

export async function updateForm(
  id: string,
  patch: Partial<
    Pick<
      FormTemplateDto,
      "name" | "description" | "pdfLayout" | "pdfLayoutMode" | "pdfLayoutSlots" | "pdfLayoutRatios" | "pdfGrid"
    >
  >
) {
  const res = await http.patch<FormTemplateDto>(`/forms/${id}`, patch);
  return res.data;
}

export async function addField(formId: string, payload: any) {
  const res = await http.post<FormTemplateDto>(`/forms/${formId}/fields`, payload);
  return res.data;
}

export async function removeField(formId: string, fieldKey: string) {
  const res = await http.delete<FormTemplateDto>(`/forms/${formId}/fields/${fieldKey}`);
  return res.data;
}

export async function addRecipient(formId: string, email: string) {
  const res = await http.post<FormTemplateDto>(`/forms/${formId}/recipients`, { email });
  return res.data;
}

export async function removeRecipient(formId: string, email: string) {
  const res = await http.delete<FormTemplateDto>(`/forms/${formId}/recipients/${encodeURIComponent(email)}`);
  return res.data;
}

export async function updateField(templateId: string, fieldKey: string, payload: any) {
  const res = await http.put<FormTemplateDto>(`/forms/${templateId}/fields/${fieldKey}`, payload);
  return res.data;
}

export async function reorderFields(templateId: string, keys: string[]) {
  const res = await http.patch<FormTemplateDto>(`/forms/${templateId}/fields/reorder`, { keys });
  return res.data;
}

export async function deleteForm(formId: string) {
  const res = await http.delete(`/forms/${formId}`);
  return res.data;
}
