import { useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";

import AppShell from "../components/Shell/AppShell";
import Page from "../ui/Page";
import Card from "../ui/Card";
import EmptyState from "../ui/EmptyState";
import ConfirmDialog from "../ui/ConfirmDialog";
import Modal from "../ui/Modal";

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
  //generatePdf, // sende ayrı import ediyorsun; tek yerden olsun diye burada da bıraktım
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

function buildPersonnelColumns(list: any[]) {
  return (list || []).map((p, idx) => ({
    key: `p${idx}`,
    label: String(p?.name || `Personel ${idx + 1}`),
    subLabel: p?.role ? String(p.role) : undefined,
  }));
}

function slugPersonnelKey(raw: string) {
  const base = String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
  return base || "personel";
}

function uniqByKey(cols: any[]) {
  const map = new Map<string, any>();
  for (const c of cols || []) {
    const key = String(c?.key || "").trim();
    if (!key) continue;
    map.set(key, c);
  }
  return Array.from(map.values());
}

// matrix helpers
function hasAnyCheckedMatrixValue(mv: any, cellType: "boolean" | "text" | "mixed") {
  if (!mv || typeof mv !== "object") return false;
  for (const rk of Object.keys(mv)) {
    if (rk === "_cols" || rk === "_colsSet") continue;
    const row = mv[rk];
    if (!row || typeof row !== "object") continue;
    for (const ck of Object.keys(row)) {
      const v = row[ck];
      if (cellType === "text") {
        if (String(v ?? "").trim()) return true;
      } else if (cellType === "boolean") {
        if (v === true || v === false) return true;
      } else {
        if (v === true || v === false) return true;
        if (String(v ?? "").trim()) return true;
      }
    }
  }
  return false;
}

export default function FormFill() {
  const { submissionId } = useParams<{ submissionId: string }>();

  const toast = useToast();
  const { me } = useAuth();

  // permissions
  const canUse = can(me, "forms.use") || can(me, "forms.builder");
  const canSend = can(me, "forms.send") || can(me, "forms.builder");

  const [sub, setSub] = useState<FormSubmissionDto | null>(null);
  const [tpl, setTpl] = useState<FormTemplateDto | null>(null);
  const [site, setSite] = useState<SiteDto | null>(null);

  const [values, setValues] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraFieldKey, setCameraFieldKey] = useState<string | null>(null);
  const [cameraBusy, setCameraBusy] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // confirm dialogs
  const [confirmCompleteOpen, setConfirmCompleteOpen] = useState(false);

  // manual send
  const recipients = useMemo(() => (tpl?.recipients || []).map((r) => r.email), [tpl]);
  const [manualTo, setManualTo] = useState("");
  const [manualPersonnelDrafts, setManualPersonnelDrafts] = useState<Record<string, { name: string; role: string }>>({});
  const [manualConfirmOpen, setManualConfirmOpen] = useState(false);

  // mail log details toggle
  const [openLog, setOpenLog] = useState<Record<string, boolean>>({});
  const toggleLog = (key: string) => setOpenLog((p) => ({ ...(p || {}), [key]: !p?.[key] }));

  if (!submissionId) return <Navigate to="/forms" replace />;
  if (!canUse) return <Navigate to="/403" replace />;

  const sortedFields = useMemo(() => {
    const f = tpl?.fields || [];
    return [...f].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [tpl]);

  // ✅ required check (matrix dahil)
  const requiredMissing = useMemo(() => {
    if (!sortedFields.length) return false;

    for (const f of sortedFields) {
      if (!f.required) continue;

      const v = values?.[f.key];

      if (f.type === "number") {
        if (v === "" || v === null || v === undefined) return true;
        continue;
      }

      if (f.type === "boolean") {
        // boolean required ise: checkbox unchecked kabul edilebilir mi?
        // Genelde required boolean = "mutlaka işaretlenmeli" beklenir.
        // Eğer "false da geçerli" diyorsan burayı hiç kontrol etme.
        // Ben "varlığı yeterli" gibi davranıyorum:
        continue;
      }

      if (f.type === "matrix") {
        const hasTextCol = (f.columns || []).some((c: any) => c?.cellType === "text");
        const cellType =
          f.columnMode === "manual"
            ? (hasTextCol ? "mixed" : f.cellType === "text" ? "text" : "boolean")
            : "boolean";
        // required matrix: en az 1 hücre dolu
        if (!hasAnyCheckedMatrixValue(v, cellType)) return true;
        continue;
      }

      // text/select/image gibi
      if (f.type === "image") {
        if (Array.isArray(v)) {
          if (v.filter((x) => String(x || "").trim()).length === 0) return true;
        } else if (!String(v ?? "").trim()) {
          return true;
        }
        continue;
      }
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

  // ✅ matrix value shape:
  // values[fieldKey] = {
  //   _cols?: { key: string; label: string; subLabel?: string }[],
  //   _colsSet?: boolean,
  //   [rowKey]: { [colKey]: boolean | string | null }
  // }
  const getMatrixCell = (fieldKey: string, rowKey: string, colKey: string) => {
    const mv = values?.[fieldKey];
    const v = mv?.[rowKey]?.[colKey];
    if (v === true || v === false) return v;
    if (typeof v === "string") return v;
    return "";
  };

  const setMatrixCell = (fieldKey: string, rowKey: string, colKey: string, value: boolean | string | null) => {
    setValues((prev) => {
      const p = prev || {};
      const mv = p[fieldKey] && typeof p[fieldKey] === "object" ? p[fieldKey] : {};
      const row = mv[rowKey] && typeof mv[rowKey] === "object" ? mv[rowKey] : {};

      return {
        ...p,
        [fieldKey]: {
          ...mv,
          [rowKey]: {
            ...row,
            [colKey]: value,
          },
        },
      };
    });
  };

  const setMatrixCols = (fieldKey: string, cols: any[]) => {
    setValues((prev) => {
      const p = prev || {};
      const mv = p[fieldKey] && typeof p[fieldKey] === "object" ? p[fieldKey] : {};
      const next: any = { ...mv, _cols: cols, _colsSet: true };

      // prune removed columns from existing rows
      const colKeys = new Set(cols.map((c: any) => c.key));
      Object.keys(next).forEach((rk) => {
        if (rk === "_cols" || rk === "_colsSet") return;
        const row = next[rk];
        if (!row || typeof row !== "object") return;
        const pruned: any = {};
        Object.keys(row).forEach((ck) => {
          if (colKeys.has(ck)) pruned[ck] = row[ck];
        });
        next[rk] = pruned;
      });

      return { ...p, [fieldKey]: next };
    });
  };

  const clearMatrix = (fieldKey: string) => {
    setValues((p) => {
      const prev = p || {};
      const mv = prev[fieldKey] && typeof prev[fieldKey] === "object" ? prev[fieldKey] : {};
      return { ...prev, [fieldKey]: { _cols: mv._cols || [], _colsSet: mv._colsSet || false } };
    });
  };

  const setManualPersonnelDraft = (fieldKey: string, patch: Partial<{ name: string; role: string }>) => {
    setManualPersonnelDrafts((prev) => {
      const cur = prev[fieldKey] || { name: "", role: "" };
      return {
        ...prev,
        [fieldKey]: {
          ...cur,
          ...patch,
        },
      };
    });
  };

  const addManualPersonnelColumn = (fieldKey: string, currentCols: any[]) => {
    const draft = manualPersonnelDrafts[fieldKey] || { name: "", role: "" };
    const label = String(draft.name || "").trim();
    if (!label) {
      toast.error("Personel adı boş olamaz", "Eksik Bilgi");
      return;
    }

    const role = String(draft.role || "").trim();
    const existingKeys = new Set((currentCols || []).map((c: any) => String(c?.key || "")));
    const base = `m_${slugPersonnelKey(label)}`;
    let key = base;
    let i = 2;
    while (existingKeys.has(key)) {
      key = `${base}_${i}`;
      i += 1;
    }

    const next = uniqByKey([
      ...(currentCols || []),
      {
        key,
        label,
        subLabel: role || undefined,
      },
    ]);

    setMatrixCols(fieldKey, next);
    setManualPersonnelDrafts((prev) => ({ ...prev, [fieldKey]: { name: "", role: "" } }));
  };

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

  const uploadCameraPhoto = async (fieldKey: string, file: File) => {
    setUploadingKey(fieldKey);
    try {
      const res = await uploadImage(file);
      const url = typeof res === "string" ? res : (res as any)?.url ?? (res as any)?.path ?? "";
      if (!url) throw new Error("Upload response url boş");

      setValues((prev) => {
        const p = prev || {};
        const cur = p[fieldKey];
        const arr = Array.isArray(cur) ? cur : cur ? [cur] : [];
        return { ...p, [fieldKey]: [...arr, url] };
      });

      toast.success("Fotoğraf yüklendi", "Başarılı");
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? e?.message ?? "Resim yüklenemedi", "Hata");
    } finally {
      setUploadingKey(null);
    }
  };

  const stopCameraStream = () => {
    const stream = streamRef.current;
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const closeCamera = () => {
    stopCameraStream();
    setCameraOpen(false);
    setCameraFieldKey(null);
    setCameraBusy(false);
    setCameraError("");
  };

  const openCamera = async (fieldKey: string) => {
    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error("Bu cihaz veya tarayıcı kamera erişimini desteklemiyor", "Kamera Yok");
      return;
    }

    stopCameraStream();
    setCameraError("");
    setCameraBusy(false);
    setCameraFieldKey(fieldKey);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
        },
        audio: false,
      });
      streamRef.current = stream;
      setCameraOpen(true);
    } catch (e: any) {
      setCameraFieldKey(null);
      toast.error(e?.message ?? "Kamera açılamadı. Tarayıcı iznini kontrol et.", "Kamera Hatası");
    }
  };

  const captureCameraPhoto = async () => {
    if (!cameraFieldKey || !videoRef.current) return;

    const video = videoRef.current;
    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setCameraError("Fotoğraf hazırlanamadı.");
      return;
    }

    ctx.drawImage(video, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", 0.92);
    });

    if (!blob) {
      setCameraError("Fotoğraf oluşturulamadı.");
      return;
    }

    setCameraBusy(true);
    try {
      const file = new File([blob], `camera-${Date.now()}.jpg`, { type: "image/jpeg" });
      await uploadCameraPhoto(cameraFieldKey, file);
      closeCamera();
    } finally {
      setCameraBusy(false);
    }
  };

  useEffect(() => {
    if (!cameraOpen || !videoRef.current || !streamRef.current) return;
    videoRef.current.srcObject = streamRef.current;
    void videoRef.current.play().catch(() => {
      setCameraError("Kamera görüntüsü başlatılamadı.");
    });
  }, [cameraOpen]);

  useEffect(() => {
    return () => {
      stopCameraStream();
    };
  }, []);

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

    if (f.type === "date") {
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
            type="date"
            value={v ?? ""}
            onChange={(e) => setField(f.key, e.target.value)}
            disabled={saving}
          />
        </div>
      );
    }

    if (f.type === "matrix") {
      const columnMode = f.columnMode === "personnel" ? "personnel" : "manual";
      const rows = (f.rows || []) as any[];
      const allPersonnel = uniqByKey(buildPersonnelColumns(site?.personnel || []));
      const mv = values?.[f.key] || {};
      const storedCols = (mv._cols || []) as any[];
      const hasColsSet = mv._colsSet === true;
      const cols =
        columnMode === "manual"
          ? ((f.columns || []) as any[])
          : (hasColsSet ? uniqByKey(storedCols) : allPersonnel);
      const selectablePersonnel =
        columnMode === "personnel"
          ? uniqByKey([...(storedCols || []), ...allPersonnel])
          : [];
      const manualDraft = manualPersonnelDrafts[f.key] || { name: "", role: "" };

      const hasTextCol = columnMode === "manual" ? cols.some((c: any) => c?.cellType === "text") : false;
      const hasBoolCol = columnMode === "manual" ? cols.some((c: any) => !c?.cellType || c?.cellType === "boolean") : true;
      const cellType = hasTextCol && hasBoolCol ? "mixed" : hasTextCol ? "text" : "boolean";

      const missingRows = !rows.length;
      const missingCols = columnMode === "manual" ? !cols.length : false;

      if (missingRows || missingCols) {
        return (
          <div key={f.key} className="fieldRow">
            <div className="fieldRowTop">
              <div className="fieldRowTitle">
                {f.label}
                {f.required ? <span className="fieldRowReq"> *</span> : null}
                <span className="fieldRowKey">{f.key}</span>
              </div>
            </div>
            <div className="hint">
              Matrix tanımı eksik. Form Yönetimi &gt; Alan Ekle içinde satırları ve sütun kaynağını kaydet.
            </div>
          </div>
        );
      }

      const selectedKeys = new Set(cols.map((c: any) => c.key));

      return (
        <div key={f.key} className="fieldRow">
          <div className="fieldRowTop">
            <div className="fieldRowTitle">
              {f.label}
              {f.required ? <span className="fieldRowReq"> *</span> : null}
              <span className="fieldRowKey">{f.key}</span>
            </div>

            <button
              className="btn"
              style={{ padding: "6px 10px" }}
              disabled={saving}
              onClick={() => clearMatrix(f.key)}
              title="Tüm seçimleri temizle"
            >
              Temizle
            </button>
          </div>

          {columnMode === "personnel" ? (
            <div style={{ display: "grid", gap: 8, marginBottom: 10 }}>
              <div className="hint">Sütun personel seçimi</div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <button
                  className="btn"
                  type="button"
                  style={{ padding: "4px 8px", opacity: 0.85 }}
                  disabled={saving || selectablePersonnel.length === 0}
                  onClick={() => setMatrixCols(f.key, selectablePersonnel)}
                >
                  Tümünü seç
                </button>
                <button
                  className="btn"
                  type="button"
                  style={{ padding: "4px 8px", opacity: 0.85 }}
                  disabled={saving || cols.length === 0}
                  onClick={() => setMatrixCols(f.key, [])}
                >
                  Tümünü kaldır
                </button>
              </div>

              {selectablePersonnel.length === 0 ? (
                <div className="hint">Henüz seçilebilir personel yok. Manuel ekleyebilirsin.</div>
              ) : (
                <div style={{ display: "grid", gap: 6 }}>
                  {selectablePersonnel.map((p: any) => {
                    const checked = selectedKeys.has(p.key);
                    return (
                      <label key={p.key} style={{ display: "flex", gap: 10, alignItems: "center" }}>
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={saving}
                          onChange={(e) => {
                            const next = e.target.checked
                              ? uniqByKey([...(cols || []), p])
                              : cols.filter((c: any) => c.key !== p.key);
                            setMatrixCols(f.key, next);
                          }}
                        />
                        <span>
                          {p.label}
                          {p.subLabel ? ` — ${p.subLabel}` : ""}
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}

              <div style={{ display: "grid", gap: 8, marginTop: 4 }}>
                <div className="hint">Manuel personel ekle (sadece bu kullanım için)</div>
                <input
                  className="ctrl"
                  placeholder="Ad Soyad"
                  value={manualDraft.name}
                  disabled={saving}
                  onChange={(e) => setManualPersonnelDraft(f.key, { name: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addManualPersonnelColumn(f.key, cols);
                    }
                  }}
                />
                <input
                  className="ctrl"
                  placeholder="Görev (opsiyonel)"
                  value={manualDraft.role}
                  disabled={saving}
                  onChange={(e) => setManualPersonnelDraft(f.key, { role: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addManualPersonnelColumn(f.key, cols);
                    }
                  }}
                />
                <button
                  className="btn"
                  type="button"
                  style={{ width: "fit-content" }}
                  disabled={saving || !manualDraft.name.trim()}
                  onClick={() => addManualPersonnelColumn(f.key, cols)}
                >
                  Personel Ekle
                </button>
              </div>
            </div>
          ) : null}

          <div
            style={{
              overflowX: "auto",
              border: "1px solid rgba(255,255,255,.08)",
              borderRadius: 12,
            }}
          >
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
              <thead>
                <tr>
                  <th
                    style={{
                      textAlign: "left",
                      padding: 10,
                      borderBottom: "1px solid rgba(255,255,255,.08)",
                      width: 380,
                    }}
                  >
                    Evrak Kaydı
                  </th>

                  {cols.map((c) => (
                    <th
                      key={c.key}
                      style={{
                        textAlign: "center",
                        padding: 10,
                        borderBottom: "1px solid rgba(255,255,255,.08)",
                        whiteSpace: "nowrap",
                      }}
                      title={c.subLabel ? `${c.label} — ${c.subLabel}` : c.label}
                    >
                      <div style={{ fontWeight: 700 }}>{c.label}</div>
                      {c.subLabel ? (
                        <div className="hint" style={{ marginTop: 4 }}>
                          {c.subLabel}
                        </div>
                      ) : null}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {rows.map((r) => (
                  <tr key={r.key}>
                    <td style={{ padding: 10, borderBottom: "1px solid rgba(255,255,255,.06)" }}>{r.label}</td>

                    {cols.map((c) => {
                      const cell = getMatrixCell(f.key, r.key, c.key);
                      const colCellType =
                        columnMode === "manual"
                          ? (c.cellType === "text" ? "text" : f.cellType === "text" ? "text" : "boolean")
                          : "boolean";
                      return (
                        <td
                          key={`${r.key}-${c.key}`}
                          style={{ padding: 10, borderBottom: "1px solid rgba(255,255,255,.06)", textAlign: "center" }}
                        >
                          {colCellType === "text" ? (
                            <input
                              className="ctrl"
                              value={cell ?? ""}
                              disabled={saving}
                              onChange={(e) => setMatrixCell(f.key, r.key, c.key, e.target.value)}
                              style={{ minWidth: 140 }}
                            />
                          ) : (
                            <select
                              className="ctrl"
                              value={cell === true ? "yes" : cell === false ? "no" : ""}
                              disabled={saving}
                              onChange={(e) => {
                                const val = e.target.value;
                                setMatrixCell(f.key, r.key, c.key, val === "" ? null : val === "yes");
                              }}
                              style={{ minWidth: 90 }}
                            >
                              <option value="">-</option>
                              <option value="yes">Evet</option>
                              <option value="no">Hayır</option>
                            </select>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="hint" style={{ marginTop: 8 }}>
            {cellType === "text"
              ? "İpucu: Her satır için personel/sütunlara metin girebilirsin."
              : cellType === "mixed"
                ? "İpucu: Bazı sütunlar metin, bazıları Evet/Hayır olabilir."
                : "İpucu: Her satır için personelleri işaretleyebilirsin."}
          </div>
        </div>
      );
    }

    // image (single or multiple)
    const urls = Array.isArray(v) ? v : v ? [v] : [];
    const absList = urls.map((u) => absUrl(String(u || ""))).filter(Boolean);

    return (
      <div key={f.key} className="fieldRow">
        <div className="fieldRowTop">
          <div className="fieldRowTitle">
            {f.label}
            {f.required ? <span className="fieldRowReq"> *</span> : null}
            <span className="fieldRowKey">{f.key}</span>
          </div>

          {absList.length ? (
            <button className="btn" style={{ padding: "6px 10px" }} disabled={saving} onClick={() => setField(f.key, "")}>
              Kaldır
            </button>
          ) : (
            <span className="hint"> </span>
          )}
        </div>

        <div style={{ display: "grid", gap: 10 }}>
          <button
            className="btn btnPrimary"
            type="button"
            disabled={saving || uploadingKey === f.key || cameraBusy}
            onClick={() => void openCamera(f.key)}
          >
            {uploadingKey === f.key ? "Yükleniyor..." : "Kamera ile Fotoğraf Çek"}
          </button>

          <div className="hint">Bu alanda cihazdan dosya seçilemez. Yalnızca anlık kamera çekimi kabul edilir.</div>

          {uploadingKey === f.key ? <div className="hint">Yükleniyor...</div> : null}

          {absList.length ? (
            <div className="imagePreview" style={{ display: "grid", gap: 8 }}>
              <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
                {absList.map((src, idx) => (
                  <div key={`${f.key}-${idx}`} style={{ display: "grid", gap: 6 }}>
                    <img
                      src={src}
                      alt={`${f.label} ${idx + 1}`}
                      style={{
                        width: "100%",
                        borderRadius: 12,
                        border: "1px solid rgba(255,255,255,.08)",
                      }}
                    />
                    <button
                      className="btn"
                      style={{ padding: "6px 10px" }}
                      disabled={saving}
                      onClick={() => {
                        setValues((prev) => {
                          const p = prev || {};
                          const cur = Array.isArray(p[f.key]) ? p[f.key] : p[f.key] ? [p[f.key]] : [];
                          const next = cur.filter((_: any, i: number) => i !== idx);
                          return { ...p, [f.key]: next };
                        });
                      }}
                    >
                      Kaldır
                    </button>
                  </div>
                ))}
              </div>
              <div className="hint">Fotoğraflar yüklü ✅</div>
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

  if (!sub || !tpl || !site) return <Navigate to="/forms" replace />;

  const submissionImageCount = sortedFields.reduce((sum: number, f: any) => {
    if (f.type !== "image") return sum;
    const v = values?.[f.key];
    if (Array.isArray(v)) return sum + v.filter((x) => String(x || "").trim()).length;
    return String(v || "").trim() ? sum + 1 : sum;
  }, 0);

  // PDF butonu (istersen aç)
  // const generatePdfOnly = async () => {
  //   if (!sub) return;
  //   if (!canSend) return toast.error("Bu işlem için yetkin yok: PDF üretme", "Erişim Engellendi");
  //   if (saving) return;

  //   try {
  //     setSaving(true);

  //     // önce kaydet (pdf güncel values ile üretilsin)
  //     const updated = await updateSubmission(sub._id, values);
  //     setSub(updated);

  //     await generatePdf(sub._id);

  //     toast.success("PDF üretildi", "Başarılı");
  //     await refresh();
  //   } catch (e: any) {
  //     toast.error(e?.response?.data?.message ?? "PDF üretilemedi", "Hata");
  //   } finally {
  //     setSaving(false);
  //   }
  // };

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

            {/* İstersen aktif et
            <button className="btn" onClick={generatePdfOnly} disabled={saving || !canSend}>
              PDF Üret
            </button>
            */}
          </div>
        }
      >
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
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
                  <a className="btn btnPdf" href={absUrl(sub.pdfPath)} target="_blank" rel="noreferrer">
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

        {cameraOpen ? (
          <Modal title="Kamera ile Fotoğraf Çek" onClose={closeCamera}>
            <div style={{ display: "grid", gap: 12 }}>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                style={{
                  width: "100%",
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,.08)",
                  background: "rgba(0,0,0,.35)",
                  minHeight: 240,
                  objectFit: "cover",
                }}
              />

              {cameraError ? <div className="hint">{cameraError}</div> : null}

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
                <button className="btn" type="button" onClick={closeCamera} disabled={cameraBusy}>
                  Vazgeç
                </button>
                <button className="btn btnPrimary" type="button" onClick={() => void captureCameraPhoto()} disabled={cameraBusy}>
                  {cameraBusy ? "Kaydediliyor..." : "Fotoğraf Çek"}
                </button>
              </div>
            </div>
          </Modal>
        ) : null}
      </Page>
    </AppShell>
  );
}
