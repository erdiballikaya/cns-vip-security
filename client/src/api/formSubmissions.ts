import { http } from "./http";

export type FormSubmissionDto = {
  _id: string;
  templateId: string;
  siteId: string;
  values: Record<string, any>;
  status: "DRAFT" | "COMPLETED";
  pdfPath?: string;
  mailLog?: { to: string; ok: boolean; at: string; error?: string }[];
};

export type SubmissionListItem = {
  _id: string;
  status: string;
  site: { _id: string; name: string; address?: string } | null;
  template: { _id: string; name: string } | null;
  pdfPath?: string | null;
  mailLogCount?: number;
  createdAt?: string;
  updatedAt?: string;
};

export async function createSubmission(templateId: string, siteId: string) {
  const res = await http.post<FormSubmissionDto>("/form-submissions", { templateId, siteId });
  return res.data;
}

export async function getSubmission(id: string) {
  const res = await http.get<FormSubmissionDto>(`/form-submissions/${id}`);
  return res.data;
}

export async function updateSubmission(id: string, values: any) {
  const res = await http.put(`/form-submissions/${id}`, { values });
  return res.data;
}


export async function completeAndSend(id: string) {
  const res = await http.post(`/form-submissions/${id}/complete-and-send`);
  return res.data;
}

export async function sendToOne(id: string, to: string) {
  const res = await http.post(`/form-submissions/${id}/send`, { to });
  return res.data;
}

export async function listSubmissions(params: {
  templateId?: string;
  status?: string;
  siteId?: string;
  limit?: number;
}) {
  const res = await http.get<SubmissionListItem[]>("/form-submissions", { params });
  return res.data || [];
}

export async function deleteSubmission(id: string) {
  await http.delete(`/form-submissions/${id}`);
}

export async function generatePdf(submissionId: string) {
  const res = await http.post<{ ok: boolean; pdfPath?: string }>(
    `/form-submissions/${submissionId}/pdf`,
    {}
  );
  return res.data;
}
