import { http } from "./http";

export type UploadStatsDto = {
  imageCount: number;
  pdfCount: number;
  total: number;
};

export async function uploadImage(file: File) {
  const fd = new FormData();
  fd.append("file", file);

  // ✅ server: POST /upload/image
  const res = await http.post<{ url: string }>("/upload/image", fd, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data.url; // "/uploads/<file>"
}

export async function getImageCount() {
  // ✅ server: GET /upload/count
  const res = await http.get<{ count: number }>("/upload/count");
  return res.data.count;
}

export async function cleanupImages() {
  // ✅ server: DELETE /upload/clear
  const res = await http.delete<{ deleted: number }>("/upload/clear");
  return { ok: true, deleted: res.data.deleted };
}

export async function getUploadStats() {
  const res = await http.get<UploadStatsDto>("/upload/stats");
  return res.data;
}

export async function purgeUploads() {
  const res = await http.delete("/upload/purge");
  return res.data;
}
