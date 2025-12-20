import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";

import AppShell from "../components/Shell/AppShell";
import Page from "../ui/Page";
import Card from "../ui/Card";
import EmptyState from "../ui/EmptyState";
import ConfirmDialog from "../ui/ConfirmDialog";

import { useAuth } from "../auth/AuthContext";
import { can } from "../auth/permissions";
import { useToast } from "../components/ToastProvider";

import { getForm, type FormTemplateDto } from "../api/forms";
import {
  completeAndSend,
  getSubmission,
  sendToOne,
  updateSubmission,
  type FormSubmissionDto,
} from "../api/formSubmissions";

import { getSiteById, type SiteDto } from "../api/sites";
import { uploadImage } from "../api/uploads";

function absUrl(maybeRelative: string) {
  if (!maybeRelative) return "";
  if (maybeRelative.startsWith("http")) return maybeRelative;
  const base = (import.meta.env.VITE_API_URL as string) || "";
  return `${base}${maybeRelative.startsWith("/") ? "" : "/"}${maybeRelative}`;
}

// UI: mail error preview
function shortErr(s: string, max = 80) {
  const t = String(s || "").trim();
  if (!t) return "";
  if (t.length <= max) return t;
  return t.slice(0, max) + "…";
}

export default function FormFill() {
  // ✅ route: /forms/fill/:submissionId
  const { submissionId } = useParams<{ submissionId: string }>();

  const toast = useToast();
  const { me } = useAuth();

  // yetkiler
  const canUse = can(me, "forms.use") || can(me, "forms.builder");
  const canSend = can(me, "forms.send") || can(me, "forms.builder");

  const [sub, setSub] = useState<FormSubmissionDto | null>(null);
  const [tpl, setTpl] = useState<FormTemplateDto | null>(null);
  const [site, setSite] = useState<SiteDto | null>(null);

  const [values, setValues] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [uploadingKey, setUploadingKey] = useState<string | null>(null);

  // confirmations
  const [confirmCompleteOpen, setConfirmCompleteOpen] = useState(false);

  // manual send
  const recipients = useMemo(() => (tpl?.recipients || []).map((r) => r.email), [tpl]);
  const [manualTo, setManualTo] = useState("");
  const [manualConfirmOpen, setManualConfirmOpen] = useState(false);

  // ✅ mail log detay toggle
  const [openLog, setOpenLog] = useState<Record<string, boolean>>({}); // key: `${i}-${to}-${at}`
  const toggleLog = (key: string) => setOpenLog((p) => ({ ...(p || {}), [key]: !p?.[key] }));

  if (!submissionId) return <Navigate to="/forms" replace />;
  if (!canUse) return <Navigate to="/403" replace />;

  const sortedFields = useMemo(() => {
    const f = tpl?.fields || [];
    return [...f].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [tpl]);

  const requiredMissing = useMemo(() => {
    if (!sortedFields.length) return false;

    for (const f of sortedFields) {
      if (!f.required) continue;
      const v = values?.[f.key];

      if (f.type === "number") {
        if (v === "" || v === null || v === undefined) return true;
        continue;
      }
      if (f.type === "boolean") continue;

      if (!String(v ?? "").trim()) return true;
    }
    return false;
  }, [sortedFields, values]);

  const refresh = async () => {
    setLoading(true);
    try {
      const s = await getSubmission(submissionId);
      setSub(s);
      setValues(s.values || {});

      const t = await getForm(String(s.templateId));
      setTpl(t);

      const siteData = await getSiteById(String(s.siteId));
      setSite(siteData);

      if (!manualTo && (t.recipients || []).length) setManualTo(t.recipients[0].email);
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? "Form kaydı yüklenemedi", "Hata");
      setSub(null);
      setTpl(null);
      setSite(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submissionId]);

  const setField = (key: string, v: any) => setValues((p) => ({ ...(p || {}), [key]: v }));

  const saveDraft = async () => {
    if (!sub) return;
    if (saving) return;

    try {
      setSaving(true);
      const updated = await updateSubmission(sub._id, values);
      setSub(updated);
      toast.success("Taslak kaydedildi", "Başarılı");
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? "Taslak kaydedilemedi", "Hata");
    } finally {
      setSaving(false);
    }
  };

  const requestComplete = () => {
    if (!canSend) return toast.error("Bu işlem için yetkin yok: Form Mail Gönderme", "Erişim Engellendi");
    if (!tpl) return;

    if ((tpl.recipients || []).length === 0) {
      return toast.error("Mail alıcıları boş. Önce Form Detayı sayfasından alıcı ekle.", "Eksik Bilgi");
    }
    if (requiredMissing) {
      return toast.error("Zorunlu alanlar eksik. Tamamlamadan önce doldur.", "Eksik Bilgi");
    }

    setConfirmCompleteOpen(true);
  };

  const confirmComplete = async () => {
    if (!sub) return;
    if (!canSend) return;

    try {
      setSaving(true);

      // önce kaydet
      const updated = await updateSubmission(sub._id, values);
      setSub(updated);

      // sonra complete & send
      await completeAndSend(sub._id);

      toast.success("Mail gönderimi başlatıldı", "Başarılı");
      await refresh();
      setConfirmCompleteOpen(false);
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? "Tamamlama/Mail gönderimi başarısız", "Hata");
    } finally {
      setSaving(false);
    }
  };

  const requestManualSend = () => {
    if (!canSend) return toast.error("Bu işlem için yetkin yok: Form Mail Gönderme", "Erişim Engellendi");
    if (!manualTo || !manualTo.includes("@")) return toast.error("Geçerli bir email seç", "Eksik Bilgi");
    setManualConfirmOpen(true);
  };

  const confirmManualSend = async () => {
    if (!sub) return;
    if (!canSend) return;

    try {
      setSaving(true);

      // önce kaydet
      await updateSubmission(sub._id, values);

      await sendToOne(sub._id, manualTo);
      toast.success("Mail gönderildi", "Başarılı");

      await refresh();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? "Mail gönderilemedi", "Hata");
    } finally {
      setSaving(false);
      setManualConfirmOpen(false);
    }
  };

  const uploadForField = async (fieldKey: string, file: File) => {
    setUploadingKey(fieldKey);
    try {
      const res = await uploadImage(file);
      const url = typeof res === "string" ? res : (res as any)?.url ?? (res as any)?.path ?? "";
      if (!url) throw new Error("Upload response url boş");

      setField(fieldKey, url);
      toast.success("Resim yüklendi", "Başarılı");
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? e?.message ?? "Resim yüklenemedi", "Hata");
    } finally {
      setUploadingKey(null);
    }
  };

  const renderField = (f: any) => {
    const v = values?.[f.key];

    if (f.type === "text") {
      return (
        <div key={f.key} className="fieldRow">
          <div className="fieldRowTop">
            <div className="fieldRowTitle">
              {f.label}
              {f.required ? <span className="fieldRowReq"> *</span> : null}
              <span className="fieldRowKey">{f.key}</span>
            </div>
          </div>
          <input className="ctrl" value={v ?? ""} onChange={(e) => setField(f.key, e.target.value)} disabled={saving} />
        </div>
      );
    }

    if (f.type === "number") {
      return (
        <div key={f.key} className="fieldRow">
          <div className="fieldRowTop">
            <div className="fieldRowTitle">
              {f.label}
              {f.required ? <span className="fieldRowReq"> *</span> : null}
              <span className="fieldRowKey">{f.key}</span>
            </div>
          </div>
          <input
            className="ctrl"
            type="number"
            min={f.min}
            max={f.max}
            value={v ?? ""}
            onChange={(e) => setField(f.key, e.target.value === "" ? "" : Number(e.target.value))}
            disabled={saving}
          />
        </div>
      );
    }

    if (f.type === "boolean") {
      return (
        <div key={f.key} className="fieldRow">
          <div className="fieldRowTop">
            <div className="fieldRowTitle">
              {f.label}
              {f.required ? <span className="fieldRowReq"> *</span> : null}
              <span className="fieldRowKey">{f.key}</span>
            </div>
          </div>

          <label style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <input type="checkbox" checked={Boolean(v)} onChange={(e) => setField(f.key, e.target.checked)} disabled={saving} />
            <span className="hint">{Boolean(v) ? "Evet" : "Hayır"}</span>
          </label>
        </div>
      );
    }

    if (f.type === "select") {
      return (
        <div key={f.key} className="fieldRow">
          <div className="fieldRowTop">
            <div className="fieldRowTitle">
              {f.label}
              {f.required ? <span className="fieldRowReq"> *</span> : null}
              <span className="fieldRowKey">{f.key}</span>
            </div>
          </div>

          <select className="ctrl" value={v ?? ""} onChange={(e) => setField(f.key, e.target.value)} disabled={saving}>
            <option value="">Seçiniz</option>
            {(f.options || []).map((o: any) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      );
    }

    // image
    const url = String(v || "");
    const abs = absUrl(url);  
    return (
      <div key={f.key} className="fieldRow">
        <div className="fieldRowTop">
          <div className="fieldRowTitle">
            {f.label}
            {f.required ? <span className="fieldRowReq"> *</span> : null}
            <span className="fieldRowKey">{f.key}</span>
          </div>

          {url ? (
            <button className="btn" style={{ padding: "6px 10px" }} disabled={saving} onClick={() => setField(f.key, "")}>
              Kaldır
            </button>
          ) : (
            <span className="hint"> </span>
          )}
        </div>

        <div style={{ display: "grid", gap: 10 }}>
          <input
            type="file"
            accept="image/*"
            disabled={saving || uploadingKey === f.key}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              await uploadForField(f.key, file);
              // bazı browser'larda input unmount olabiliyor; null guard:
              if (e.currentTarget) e.currentTarget.value = "";
            }}
          />

          {uploadingKey === f.key ? <div className="hint">Yükleniyor...</div> : null}

          {url ? (
            <div className="imagePreview" style={{ display: "grid", gap: 8 }}>
              <img src={abs} alt={f.label} style={{ width: "100%", borderRadius: 12, border: "1px solid rgba(255,255,255,.08)" }} />
              <div className="hint">Fotoğraf yüklü ✅</div>
            </div>
          ) : (
            <div className="hint">Henüz fotoğraf seçilmedi.</div>
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <AppShell title="Form Doldur" active="forms">
        <Page title="Yükleniyor..." subtitle="Form kaydı hazırlanıyor">
          <Card title="Form" subtitle="Lütfen bekleyin">
            <div className="hint">Yükleniyor...</div>
          </Card>
        </Page>
      </AppShell>
    );
  }

  if (!sub || !tpl || !site) {
    return <Navigate to="/forms" replace />;
  }

  const submissionImageCount = sortedFields.filter((f: any) => f.type === "image" && String(values?.[f.key] || "")).length;

  return (
    <AppShell title="Form Doldur" active="forms">
      <Page
        title={`${tpl.name} — ${site.name ?? "Site"}`}
        subtitle={site.address ?? ""}
        right={
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <Link className="btn" to={`/forms/${tpl._id}`}>
              ← Form Detayı
            </Link>

            <button className="btn" onClick={refresh} disabled={saving}>
              Yenile
            </button>

            <button className="btn btnPrimary" onClick={saveDraft} disabled={saving}>
              {saving ? "Kaydediliyor..." : "Taslağı Kaydet"}
            </button>

            <button
              className="btn btnPrimary"
              onClick={requestComplete}
              disabled={saving || !canSend}
              title={!canSend ? "Mail gönderme yetkin yok" : undefined}
            >
              Tamamla ve Mail Gönder
            </button>
          </div>
        }
      >
        <div style={{ display: "grid", gridTemplateColumns: "1.25fr .75fr", gap: 12 }}>
          <Card title="Form" subtitle={`Durum: ${sub.status} · Fotoğraf: ${submissionImageCount}`}>
            {sortedFields.length === 0 ? (
              <EmptyState title="Alan yok" description="Bu form şablonunda alan tanımı yok." />
            ) : (
              <div style={{ display: "grid", gap: 10 }}>{sortedFields.map(renderField)}</div>
            )}

            {requiredMissing ? (
              <div className="hint" style={{ marginTop: 10 }}>
                ⚠️ Zorunlu alanlar eksik görünüyor.
              </div>
            ) : null}
          </Card>

          <Card title="Mail Gönderimi" subtitle="Toplu veya tekil gönder">
            <div style={{ display: "grid", gap: 10 }}>
              <div className="hint">
                Alıcı sayısı: <b>{recipients.length}</b>
              </div>

              {recipients.length ? (
                <div className="field">
                  <div className="label">Tek kişiye manuel gönder</div>
                  <select className="ctrl" value={manualTo} onChange={(e) => setManualTo(e.target.value)} disabled={saving || !canSend}>
                    {recipients.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>

                  <button className="btn" style={{ marginTop: 10 }} onClick={requestManualSend} disabled={saving || !canSend}>
                    Seçili Kişiye Mail At
                  </button>
                </div>
              ) : (
                <EmptyState title="Alıcı yok" description="Önce Form Detayı sayfasından mail alıcısı ekle." />
              )}

              {sub.pdfPath ? (
                <div className="field">
                  <a
                    className="btn btnPdf"
                    href={absUrl(sub.pdfPath)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    📄 PDF’i Aç
                  </a>
                </div>

              ) : null}

              {(sub.mailLog || []).length ? (
                <div className="field">
                  <div className="label">Mail Log</div>

                  <div style={{ display: "grid", gap: 8 }}>
                    {(sub.mailLog || [])
                      .slice()
                      .reverse()
                      .slice(0, 20)
                      .map((x, i) => {
                        const key = `${i}-${x.to}-${x.at ?? ""}`;
                        const isOpen = Boolean(openLog[key]);
                        const err = String(x.error || "");

                        return (
                          <div key={key} className="fieldRow">
                            <div className="fieldRowTop" style={{ alignItems: "flex-start" }}>
                              <div className="fieldRowTitle">
                                {x.to} <span className="fieldRowKey">{x.ok ? "OK" : "FAIL"}</span>
                              </div>

                              <div style={{ display: "flex", gap: 8 }}>
                                {!x.ok && err ? (
                                  <a className="btn" style={{ padding: "6px 10px" }} onClick={() => toggleLog(key)}>
                                    {isOpen ? "Detay Gizle" : "Detay Göster"}
                                  </a>
                                ) : null}
                                <div className="hint">{x.ok ? "✅" : "❌"}</div>
                              </div>
                            </div>

                            <div className="hint" style={{ marginTop: 6 }}>
                              {x.at ? new Date(x.at).toLocaleString("tr-TR") : ""}
                              {!x.ok && !isOpen && err ? ` · ${shortErr(err, 90)}` : ""}
                            </div>

                            {!x.ok && isOpen && err ? (
                              <div
                                style={{
                                  marginTop: 8,
                                  whiteSpace: "pre-wrap",
                                  wordBreak: "break-word",
                                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                                  fontSize: 12,
                                  lineHeight: 1.4,
                                  padding: 10,
                                  borderRadius: 12,
                                  border: "1px solid rgba(255,255,255,.08)",
                                  background: "rgba(255,255,255,.03)",
                                }}
                              >
                                {err}
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                  </div>
                </div>
              ) : (
                <div className="hint">Henüz mail gönderimi yok.</div>
              )}
            </div>
          </Card>
        </div>

        <ConfirmDialog
          open={confirmCompleteOpen}
          title="Tamamla ve Mail Gönder"
          message="Form tamamlanacak, PDF üretilecek ve tüm alıcılara mail atılacak. Onaylıyor musun?"
          confirmText="Evet, Gönder"
          cancelText="Vazgeç"
          disabled={saving}
          onClose={() => setConfirmCompleteOpen(false)}
          onConfirm={confirmComplete}
        />

        <ConfirmDialog
          open={manualConfirmOpen}
          title="Tek Kişiye Mail At"
          message={manualTo ? `${manualTo} adresine form PDF gönderilsin mi?` : "Email seçili değil."}
          confirmText="Gönder"
          cancelText="Vazgeç"
          disabled={saving}
          onClose={() => setManualConfirmOpen(false)}
          onConfirm={confirmManualSend}
        />
      </Page>
    </AppShell>
  );
}
