import { http } from "./http";

export type MailLogDto = {
  _id: string;
  submissionId?: string;
  templateId?: string;
  templateName: string;
  siteId?: string;
  siteName: string;
  to: string;
  ok: boolean;
  error?: string;
  subject?: string;
  mode: "bulk" | "manual";
  pdfPath?: string;
  createdAt: string;
  sentAt?: string;
};

export async function listMailLogs(limit = 200) {
  const res = await http.get<{ retentionDays: number; items: MailLogDto[] }>("/mail-logs", {
    params: { limit },
  });
  return res.data;
}
