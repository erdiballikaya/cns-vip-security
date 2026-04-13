import { useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";

import AppShell from "../components/Shell/AppShell";
import Page from "../ui/Page";
import Card from "../ui/Card";
import EmptyState from "../ui/EmptyState";

import { useAuth } from "../auth/AuthContext";
import { can } from "../auth/permissions";
import { useToast } from "../components/ToastProvider";
import { listMailLogs, type MailLogDto } from "../api/mailLogs";

function shortErr(s: string, max = 140) {
  const t = String(s || "").trim();
  if (!t) return "";
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

export default function MailLogs() {
  const { me } = useAuth();
  const toast = useToast();

  const canView = can(me, "forms.send");

  const [items, setItems] = useState<MailLogDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [retentionDays, setRetentionDays] = useState(15);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | "ok" | "fail">("all");

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return (items || []).filter((x) => {
      if (status === "ok" && !x.ok) return false;
      if (status === "fail" && x.ok) return false;
      if (!query) return true;
      return [x.to, x.templateName, x.siteName, x.subject, x.error]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(query));
    });
  }, [items, q, status]);

  useEffect(() => {
    if (!canView) return;
    (async () => {
      setLoading(true);
      try {
        const res = await listMailLogs(300);
        setItems(res.items || []);
        setRetentionDays(Number(res.retentionDays || 15));
      } catch (e: any) {
        toast.error(e?.response?.data?.message ?? "Mail logları alınamadı.", "Hata");
      } finally {
        setLoading(false);
      }
    })();
  }, [canView, toast]);

  if (!canView) return <Navigate to="/403" replace />;

  return (
    <AppShell title="Mail Gönderim Kayıtları" active="mailLogs">
      <Page
        title="Mail Gönderim Kayıtları"
        subtitle={`Loglar ${retentionDays} gün tutulur. Her yeni kayıt sırasında ${retentionDays} günden eski loglar otomatik silinir.`}
        right={
          <div className="mailLogsToolbar">
            <input
              className="ctrl"
              placeholder="Ara: alıcı / form / site"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <select className="ctrl mailLogsStatus" value={status} onChange={(e) => setStatus(e.target.value as "all" | "ok" | "fail")}>
              <option value="all">Tümü</option>
              <option value="ok">Başarılı</option>
              <option value="fail">Başarısız</option>
            </select>
          </div>
        }
      >
        <Card title="Gönderim Geçmişi" subtitle={`${filtered.length} kayıt`}>
          {loading ? (
            <div className="hint">Yükleniyor...</div>
          ) : filtered.length === 0 ? (
            <EmptyState title="Log bulunamadı" description="Son 15 gün içinde eşleşen mail logu yok." />
          ) : (
            <div className="mailLogsList">
              {filtered.map((item) => (
                <div key={item._id} className="fieldRow">
                  <div className="fieldRowTop" style={{ alignItems: "flex-start" }}>
                    <div>
                      <div className="fieldRowTitle">
                        {item.to} <span className="fieldRowKey">{item.ok ? "BAŞARILI" : "BAŞARISIZ"}</span>
                      </div>
                      <div className="hint" style={{ marginTop: 6 }}>
                        {item.siteName || "Site yok"} · {item.templateName || "Form yok"} · {item.mode === "manual" ? "Tekil gönderim" : "Toplu gönderim"}
                      </div>
                    </div>

                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: item.ok ? "#34d399" : "#f87171",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {item.ok ? "Başarılı" : "Başarısız"}
                    </div>
                  </div>

                  <div className="mailLogMeta">
                    <div>
                      <span className="hint">Tarih:</span> {new Date(item.sentAt || item.createdAt).toLocaleString("tr-TR")}
                    </div>
                    <div>
                      <span className="hint">Konu:</span> {item.subject || "-"}
                    </div>
                    {item.submissionId ? (
                      <div>
                        <span className="hint">Kayıt:</span>{" "}
                        <Link to={`/forms/fill/${item.submissionId}`}>{item.submissionId}</Link>
                      </div>
                    ) : null}
                  </div>

                  {!item.ok && item.error ? (
                    <div
                      style={{
                        padding: 10,
                        borderRadius: 12,
                        border: "1px solid rgba(239,68,68,.25)",
                        background: "rgba(239,68,68,.08)",
                        fontSize: 12,
                        lineHeight: 1.5,
                        wordBreak: "break-word",
                      }}
                      title={item.error}
                    >
                      {shortErr(item.error, 220)}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </Card>
      </Page>
    </AppShell>
  );
}
