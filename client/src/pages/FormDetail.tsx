// src/pages/FormDetail.tsx

import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";

import AppShell from "../components/Shell/AppShell";
import Page from "../ui/Page";
import Card from "../ui/Card";
import EmptyState from "../ui/EmptyState";
import ConfirmDialog from "../ui/ConfirmDialog";

import { useAuth } from "../auth/AuthContext";
import { can } from "../auth/permissions";
import { useToast } from "../components/ToastProvider";

import AddFieldModal from "../components/AddFieldModal";

import {
  getForm,
  updateForm,
  removeField,
  addRecipient,
  removeRecipient,
  reorderFields,
  deleteForm,
  type FormTemplateDto,
} from "../api/forms";

import {
  createSubmission,
  listSubmissions,
  deleteSubmission,
  type SubmissionListItem,
} from "../api/formSubmissions";

import { http } from "../api/http";

// ✅ drag-drop (dnd-kit)
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, arrayMove, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type SiteLite = { _id: string; name: string; address?: string };
type FieldDto = any;

function normalizeEmail(s: string) {
  return String(s || "").trim().toLowerCase();
}

function absUrl(maybeRelative: string) {
  if (!maybeRelative) return "";
  if (maybeRelative.startsWith("http")) return maybeRelative;

  const api = (import.meta.env.VITE_API_URL as string) || ""; // örn: http://localhost:4000/api
  const origin = api.replace(/\/api\/?$/, ""); // -> http://localhost:4000
  return `${origin}${maybeRelative.startsWith("/") ? "" : "/"}${maybeRelative}`;
}

// ✅ order normalize helper: 1..N
function normalizeOrders1N(list: any[]) {
  return list.map((x, idx) => ({ ...x, order: idx + 1 }));
}

function todayIsoDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatLongTrDate(value: string) {
  if (!value) return "-";
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(parsed);
}

function SortableFieldRow({
  f,
  canBuild,
  saving,
  actionBtnStyle,
  onEdit,
  onDelete,
}: {
  f: any;
  canBuild: boolean;
  saving: boolean;
  actionBtnStyle: React.CSSProperties;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: f.key });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} className="fieldRow">
      <div className="fieldRowTop">
        <div className="fieldRowTitle">
          {f.label}
          {f.required ? <span className="fieldRowReq"> *</span> : null}
          <span className="fieldRowKey">{f.key}</span>
        </div>

        {canBuild ? (
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {/* ✅ Drag handle */}
            <button
              className="btn"
              style={{ ...actionBtnStyle, cursor: saving ? "not-allowed" : "grab" }}
              disabled={saving}
              title="Sürükle-bırak ile sırala"
              {...attributes}
              {...listeners}
            >
              ↕︎
            </button>

            {/* ✅ EDIT */}
            <button className="btn" style={actionBtnStyle} disabled={saving} onClick={onEdit} title="Alanı düzenle">
              Düzenle
            </button>

            {/* ✅ DELETE */}
            <button className="btn" style={actionBtnStyle} disabled={saving} onClick={onDelete}>
              Kaldır
            </button>
          </div>
        ) : (
          <span className="hint">{f.type}</span>
        )}
      </div>

      <div className="hint">
        Tip:{" "}
        <b>
          {f.type === "select"
            ? "Çoktan Seçmeli"
            : f.type === "image"
              ? "Resim"
              : f.type === "number"
                ? "Sayı"
                : f.type === "matrix"
                  ? "Matrix"
                  : f.type === "date"
                    ? "Tarih"
                  : "Metin"}
        </b>
        {f.type === "select" ? ` · seçenek: ${(f.options || []).length}` : ""}
        {typeof f.order === "number" ? ` · sıra: ${f.order}` : ""}
      </div>
    </div>
  );
}

export default function FormDetail() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const toast = useToast();
  const { me } = useAuth();

  const canView = can(me, "forms.view") || can(me, "forms.builder");
  const canBuild = can(me, "forms.builder");
  const canUse = can(me, "forms.use") || canBuild;

  const [tpl, setTpl] = useState<FormTemplateDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmDeleteFormOpen, setConfirmDeleteFormOpen] = useState(false);

  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editProjectResponsible, setEditProjectResponsible] = useState("");
  const [editReportDate, setEditReportDate] = useState(todayIsoDate());

  const [fieldModalOpen, setFieldModalOpen] = useState(false);
  const [editField, setEditField] = useState<FieldDto | null>(null);

  const [newRecipient, setNewRecipient] = useState("");
  const [fieldToDelete, setFieldToDelete] = useState<string | null>(null);

  const [sites, setSites] = useState<SiteLite[]>([]);
  const [siteLoading, setSiteLoading] = useState(false);
  const [selectedSiteId, setSelectedSiteId] = useState<string>("");

  const [subs, setSubs] = useState<SubmissionListItem[]>([]);
  const [subsLoading, setSubsLoading] = useState(false);

  const [draftToDelete, setDraftToDelete] = useState<string | null>(null);

  // ✅ NEW: tümünü sil confirm
  const [confirmDeleteAllOpen, setConfirmDeleteAllOpen] = useState(false);
  const [previewing, setPreviewing] = useState(false);

  // ✅ drag UI list (animasyon için ayrı state)
  const [fieldsUi, setFieldsUi] = useState<any[]>([]);

  if (!canView) return <Navigate to="/403" replace />;
  if (!id) return <Navigate to="/forms" replace />;

  const actionBtnStyle: React.CSSProperties = { padding: "6px 10px" };

  // ✅ sensors (scroll/drag daha iyi)
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 }, // yanlışlıkla click yerine drag olmasın
    })
  );

  const refresh = async () => {
    setLoading(true);
    try {
      const data = await getForm(id);
      setTpl(data);
      setEditName(data.name || "");
      setEditDesc(data.description || "");
      setEditProjectResponsible("");
      setEditReportDate(todayIsoDate());

      // ✅ drag UI list sync (order'a göre)
      const sorted = [...(data.fields || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      setFieldsUi(sorted);
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? "Form detayı alınamadı", "Hata");
      setTpl(null);
      setFieldsUi([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchSites = async () => {
    if (!canUse && !canBuild) return;
    setSiteLoading(true);
    try {
      const res = await http.get<SiteLite[]>("/sites");
      setSites(res.data || []);
      if (!selectedSiteId && res.data?.[0]?._id) setSelectedSiteId(res.data[0]._id);
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? "Siteler alınamadı", "Hata");
      setSites([]);
    } finally {
      setSiteLoading(false);
    }
  };

  const fetchSubmissions = async () => {
    if (!id) return;
    setSubsLoading(true);
    try {
      const rows = await listSubmissions({ templateId: id, limit: 50 });
      setSubs(rows);
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? "Kayıtlar alınamadı", "Hata");
      setSubs([]);
    } finally {
      setSubsLoading(false);
    }
  };

  const handleDeleteForm = async () => {
    if (!tpl) return;
    if (!canBuild) return;

    try {
      setSaving(true);
      await deleteForm(tpl._id);
      toast.success("Form kaldırıldı", "Başarılı");
      nav("/forms");
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? "Form kaldırılamadı", "Hata");
    } finally {
      setSaving(false);
      setConfirmDeleteFormOpen(false);
    }
  };


  useEffect(() => {
    refresh();
    fetchSites();
    fetchSubmissions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // tpl değiştiyse UI listesi boş kalmasın
  useEffect(() => {
    const f = tpl?.fields || [];
    const sorted = [...f].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    setFieldsUi(sorted);
  }, [tpl]);

  const saveMeta = async () => {
    if (!tpl) return;
    if (!canBuild) return toast.error("Bu işlem için yetkin yok: Form Oluşturma / Düzenleme", "Erişim Engellendi");
    if (saving) return;

    const name = editName.trim();
    const description = editDesc.trim();
    if (!name) return toast.error("Form adı zorunlu", "Eksik Bilgi");

    try {
      setSaving(true);
      const updated = await updateForm(tpl._id, {
        name,
        description,
      });
      setTpl(updated);
      toast.success("Form bilgileri kaydedildi", "Başarılı");
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? "Kaydetme başarısız", "Hata");
    } finally {
      setSaving(false);
    }
  };


  const handleDeleteField = async () => {
    if (!tpl || !fieldToDelete) return;
    if (!canBuild) return;

    try {
      setSaving(true);
      const updated = await removeField(tpl._id, fieldToDelete);
      setTpl(updated);
      toast.success("Alan kaldırıldı", "Başarılı");
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? "Alan kaldırılamadı", "Hata");
    } finally {
      setSaving(false);
      setFieldToDelete(null);
    }
  };

  const handleAddRecipient = async () => {
    if (!tpl) return;
    if (!canBuild) return toast.error("Bu işlem için yetkin yok: Form Oluşturma / Düzenleme", "Erişim Engellendi");
    if (saving) return;

    const email = normalizeEmail(newRecipient);
    if (!email || !email.includes("@")) return toast.error("Geçerli bir email gir", "Geçersiz Email");

    try {
      setSaving(true);
      const updated = await addRecipient(tpl._id, email);
      setTpl(updated);
      setNewRecipient("");
      toast.success("Mail alıcısı eklendi", "Başarılı");
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? "Mail alıcısı eklenemedi", "Hata");
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveRecipient = async (email: string) => {
    if (!tpl) return;
    if (!canBuild) return;

    try {
      setSaving(true);
      const updated = await removeRecipient(tpl._id, email);
      setTpl(updated);
      toast.success("Mail alıcısı kaldırıldı", "Başarılı");
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? "Mail alıcısı kaldırılamadı", "Hata");
    } finally {
      setSaving(false);
    }
  };

  const useThisForm = async () => {
    if (!tpl) return;
    if (!canUse) return toast.error("Bu işlem için yetkin yok: Form Doldurma", "Erişim Engellendi");
    if (!selectedSiteId) return toast.error("Önce bir site seç", "Eksik Bilgi");
    if (!editProjectResponsible.trim()) return toast.error("Proje sorumlusu zorunlu", "Eksik Bilgi");
    if (saving) return;

    try {
      setSaving(true);
      const initialValues = {
        _meta: {
          projectResponsible: editProjectResponsible.trim(),
          reportDate: (editReportDate || todayIsoDate()).trim(),
        },
      };
      const sub = await createSubmission(tpl._id, selectedSiteId, initialValues);
      toast.success("Form başlatıldı", "Başarılı");
      await fetchSubmissions();
      nav(`/forms/fill/${sub._id}`);
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? "Form başlatılamadı", "Hata");
    } finally {
      setSaving(false);
    }
  };

  const confirmDeleteDraft = async () => {
    if (!draftToDelete) return;
    try {
      setSaving(true);
      await deleteSubmission(draftToDelete);
      toast.success("Kayıt silindi", "Başarılı");
      setDraftToDelete(null);
      await fetchSubmissions();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? "Silinemedi", "Hata");
    } finally {
      setSaving(false);
    }
  };

  // ✅ NEW: tüm kayıtları sil
  const confirmDeleteAll = async () => {
    if (subs.length === 0) return;

    try {
      setSaving(true);

      const results = await Promise.allSettled(subs.map((s) => deleteSubmission(s._id)));
      const okCount = results.filter((r) => r.status === "fulfilled").length;
      const failCount = results.length - okCount;

      // hızlı UI güncelle
      setSubs([]);

      if (failCount === 0) toast.success(`Tüm kayıtlar silindi (${okCount}).`, "Başarılı");
      else toast.error(`Bazı kayıtlar silinemedi. Silinen: ${okCount}, Hata: ${failCount}`, "Hata");
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? "Tümünü silme başarısız.", "Hata");
    } finally {
      setSaving(false);
      setConfirmDeleteAllOpen(false);
    }
  };

  const openPreview = async () => {
    if (!tpl || loading) return;
    if (!canUse) return toast.error("Bu işlem için yetkin yok: Form Doldurma", "Erişim Engellendi");

    const normalizedFields = normalizeOrders1N([...(fieldsUi || [])]).map((f: any) => ({
      key: f.key,
      label: f.label,
      type: f.type,
      required: Boolean(f.required),
      order: f.order,
      min: f.min,
      max: f.max,
      options: Array.isArray(f.options) ? f.options : [],
      defaultValue: f.defaultValue,
      columnMode: f.columnMode,
      cellType: f.cellType,
      columns: Array.isArray(f.columns) ? f.columns : undefined,
      rows: Array.isArray(f.rows) ? f.rows : undefined,
    }));

    const selectedSite = sites.find((s) => s._id === selectedSiteId) || sites[0];

    const previewTemplate = {
      name: editName.trim() || tpl.name || "Form",
      description: editDesc.trim(),
      fields: normalizedFields,
      pdfLayout: tpl.pdfLayout || [],
      pdfLayoutMode: tpl.pdfLayoutMode || "1x1",
      pdfLayoutSlots: tpl.pdfLayoutSlots || {},
      pdfLayoutRatios: tpl.pdfLayoutRatios || {},
      pdfGrid: tpl.pdfGrid,
    };

    const previewSite = {
      name: selectedSite?.name || "Önizleme Sitesi",
      address: selectedSite?.address || "",
      logoUrl: "",
      dynamic: {},
      personnel: [],
    };

    try {
      setPreviewing(true);
      const res = await http.post("/forms/preview-pdf", {
        template: previewTemplate,
        site: previewSite,
        values: {
          _meta: {
            projectResponsible: editProjectResponsible.trim(),
            reportDate: (editReportDate || todayIsoDate()).trim(),
          },
        },
      }, {
        responseType: "blob",
      });

      const blob = new Blob([res.data], { type: "application/pdf" });
      const blobUrl = URL.createObjectURL(blob);
      window.location.href = blobUrl;
      setTimeout(() => URL.revokeObjectURL(blobUrl), 120000);
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? "PDF önizleme üretilemedi.", "Hata");
    } finally {
      setPreviewing(false);
    }
  };

  // ✅ drag commit: UI anında + backend reorderFields
  const commitReorder = async (movedUi: any[]) => {
    if (!tpl || !canBuild) return;

    // UI’da order da 1..N görünsün (optimistic)
    const normalized = normalizeOrders1N(movedUi);
    setFieldsUi(normalized);
    setTpl((prev) => (prev ? { ...prev, fields: normalized } : prev));

    const keys = normalized.map((x) => x.key);

    try {
      setSaving(true);
      const updated = await reorderFields(tpl._id, keys);
      setTpl(updated);

      // server dönen order'a göre UI tekrar senkron
      const sorted = [...(updated.fields || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      setFieldsUi(sorted);

      toast.success("Sıralama kaydedildi", "Başarılı");
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? "Sıralama kaydedilemedi", "Hata");
      await refresh(); // geri al
    } finally {
      setSaving(false);
    }
  };

  const onDragEnd = (event: any) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    let moved: any[] | null = null;

    setFieldsUi((prev) => {
      const oldIndex = prev.findIndex((x) => x.key === active.id);
      const newIndex = prev.findIndex((x) => x.key === over.id);
      if (oldIndex < 0 || newIndex < 0) return prev;

      moved = arrayMove(prev, oldIndex, newIndex);
      return moved;
    });

    // ✅ side-effect setState dışı: StrictMode'da 2 kere tetiklenmez
    if (moved) {
      void commitReorder(moved);
    }
  };

  const drafts = useMemo(() => subs.filter((x) => String(x.status).toUpperCase() === "DRAFT"), [subs]);
  const completed = useMemo(() => subs.filter((x) => String(x.status).toUpperCase() !== "DRAFT"), [subs]);
  const canStartForm = Boolean(selectedSiteId && editProjectResponsible.trim() && !saving);

  return (
    <AppShell title="Form Detayı" active="forms">
      <Page
        title={loading ? "Yükleniyor..." : tpl?.name ?? "Form"}
        subtitle="Form şablonu, alanlar, mail alıcıları ve kayıtlar"
        right={
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link className="btn" to="/forms">
              ← Formlar
            </Link>
            {canUse && (
              <button className="btn" disabled={loading || previewing} onClick={openPreview}>
                {previewing ? "Önizleniyor..." : "Önizle"}
              </button>
            )}
            {canBuild && (
              <button className="btn btnPrimary" disabled={saving || loading} onClick={saveMeta}>
                {saving ? "Kaydediliyor..." : "Kaydet"}
              </button>
            )}
            {canBuild && (
              <button
                className="btn btnDanger"
                disabled={saving || loading}
                onClick={() => setConfirmDeleteFormOpen(true)}
                title="Formu kalıcı olarak sil"
              >
                Formu Kaldır
              </button>
            )}
          </div>
        }
      >

        {!tpl && !loading ? (
          <EmptyState title="Form bulunamadı" description="Form silinmiş olabilir veya erişimin yok." />
        ) : (
          <>
            <div className="formDetailGrid">
              <Card title="Form Bilgileri" subtitle={canBuild ? "Düzenleyebilirsin" : "Salt görüntüleme"}>
                {loading ? (
                  <div className="hint">Yükleniyor...</div>
                ) : (
                  <div style={{ display: "grid", gap: 12 }}>
                    <div className="field">
                      <div className="label">Ad</div>
                      {canBuild ? (
                        <input className="ctrl" value={editName} onChange={(e) => setEditName(e.target.value)} />
                      ) : (
                        <div className="hint">{tpl?.name}</div>
                      )}
                    </div>

                    <div className="field">
                      <div className="label">Açıklama</div>
                      {canBuild ? (
                        <textarea className="ctrl" rows={3} value={editDesc} onChange={(e) => setEditDesc(e.target.value)} />
                      ) : (
                        <div className="hint">{tpl?.description || "-"}</div>
                      )}
                    </div>

                    <div className="hint">
                      Alan sayısı: <b>{tpl?.fields?.length ?? 0}</b> · Mail alıcısı: <b>{tpl?.recipients?.length ?? 0}</b>
                    </div>
                  </div>
                )}
              </Card>

              <Card title="Formu Kullan" subtitle="Bir site seç ve formu doldurmaya başla">
                {!canUse ? (
                  <div className="hint">Form doldurma yetkin yok.</div>
                ) : siteLoading ? (
                  <div className="hint">Siteler yükleniyor...</div>
                ) : sites.length === 0 ? (
                  <EmptyState title="Site yok" description="Önce en az 1 site oluşturmalısın." />
                ) : (
                  <div style={{ display: "grid", gap: 10 }}>
                    <div className="field">
                      <div className="label">Site</div>
                      <select className="ctrl" value={selectedSiteId} onChange={(e) => setSelectedSiteId(e.target.value)} disabled={saving}>
                        {sites.map((s) => (
                          <option key={s._id} value={s._id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                      <div style={{ height: 16 }} />
                      <div className="hint" style={{ marginBottom: 16 }}>
                        {selectedSiteId ? sites.find((x) => x._id === selectedSiteId)?.address ?? "" : ""}
                      </div>
                    </div>

                    <div className="field">
                      <div className="label">Proje Sorumlusu</div>
                      <input
                        className="ctrl"
                        value={editProjectResponsible}
                        onChange={(e) => setEditProjectResponsible(e.target.value)}
                        placeholder="Proje sorumlusunu gir"
                        disabled={saving}
                      />
                    </div>

                    <div className="field">
                      <div className="label">Tarih</div>
                      <input className="ctrl" value={formatLongTrDate(editReportDate)} readOnly />
                    </div>

                    <button
                      className="btn btnPrimary"
                      disabled={!canStartForm}
                      onClick={useThisForm}
                      style={
                        canStartForm
                          ? undefined
                          : {
                              background: "rgba(148, 163, 184, 0.18)",
                              borderColor: "rgba(148, 163, 184, 0.28)",
                              color: "rgba(226, 232, 240, 0.72)",
                              boxShadow: "none",
                              cursor: "not-allowed",
                            }
                      }
                    >
                      {saving ? "Başlatılıyor..." : "Formu Başlat"}
                    </button>
                  </div>
                )}
              </Card>
            </div>

            <div style={{ height: 12 }} />

            <div className="formDetailGrid">
              <Card
                title="Alanlar"
                subtitle={canBuild ? "Sürükle-bırak ile sırala (order otomatik 1..N)." : "Form alanları"}
                right={
                  canBuild ? (
                    <button className="btn" onClick={() => setFieldModalOpen(true)} disabled={saving || loading}>
                      + Alan Ekle
                    </button>
                  ) : undefined
                }
              >
                {loading ? (
                  <div className="hint">Yükleniyor...</div>
                ) : fieldsUi.length === 0 ? (
                  <EmptyState title="Alan yok" description={canBuild ? "Alan ekleyerek başlayabilirsin." : "Bu formda alan tanımı yok."} />
                ) : (
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                    <SortableContext items={fieldsUi.map((x) => x.key)} strategy={verticalListSortingStrategy}>
                      <div style={{ display: "grid", gap: 10 }}>
                        {fieldsUi.map((f: any) => (
                          <SortableFieldRow
                            key={f.key}
                            f={f}
                            canBuild={Boolean(canBuild)}
                            saving={Boolean(saving)}
                            actionBtnStyle={actionBtnStyle}
                            onEdit={() => setEditField(f)}
                            onDelete={() => setFieldToDelete(f.key)}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                )}
              </Card>

              <Card title="Mail Atılacak Kişiler" subtitle={canBuild ? "Ekle / sil" : "Salt görüntüleme"}>
                {loading ? (
                  <div className="hint">Yükleniyor...</div>
                ) : (
                  <div style={{ display: "grid", gap: 10 }}>
                    {canBuild && (
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                        <input
                          className="ctrl"
                          placeholder="email ekle (örn: a@b.com)"
                          value={newRecipient}
                          onChange={(e) => setNewRecipient(e.target.value)}
                          style={{ flex: 1, minWidth: 0 }}
                          disabled={saving}
                        />
                        <button className="btn btnPrimary" disabled={saving} onClick={handleAddRecipient}>
                          Ekle
                        </button>
                      </div>
                    )}

                    {(tpl?.recipients || []).length === 0 ? (
                      <EmptyState title="Alıcı yok" description={canBuild ? "En az 1 mail alıcısı ekle." : "Bu form için mail alıcısı tanımlı değil."} />
                    ) : (
                      <div style={{ display: "grid", gap: 8 }}>
                        {(tpl?.recipients || []).map((r) => (
                          <div key={r.email} className="fieldRow">
                            <div className="fieldRowTop">
                              <div className="fieldRowTitle">{r.email}</div>
                              {canBuild ? (
                                <button className="btn" style={actionBtnStyle} disabled={saving} onClick={() => handleRemoveRecipient(r.email)}>
                                  Sil
                                </button>
                              ) : (
                                <span className="hint"> </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </Card>
            </div>

            <div style={{ height: 12 }} />

            <Card
              title="Taslaklar & Gönderimler"
              subtitle="Kaydedilen taslakları buradan devam ettirebilirsin"
              right={
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button className="btn" onClick={fetchSubmissions} disabled={subsLoading}>
                    {subsLoading ? "Yükleniyor..." : "Yenile"}
                  </button>

                  {canBuild && (
                    <button
                      className="btn btnDanger"
                      disabled={saving || subsLoading || subs.length === 0}
                      onClick={() => setConfirmDeleteAllOpen(true)}
                      title={subs.length === 0 ? "Silinecek kayıt yok" : "Tüm taslak ve gönderimleri sil"}
                    >
                      Tümünü Sil
                    </button>
                  )}
                </div>
              }
            >
              {subsLoading ? (
                <div className="hint">Yükleniyor...</div>
              ) : subs.length === 0 ? (
                <EmptyState title="Kayıt yok" description="Bu form için henüz başlatılmış bir kayıt yok." />
              ) : (
                <div style={{ display: "grid", gap: 12 }}>
                  <div>
                    <div className="hint" style={{ marginBottom: 8 }}>
                      Taslaklar: <b>{drafts.length}</b>
                    </div>

                    {drafts.length === 0 ? (
                      <div className="hint">Taslak yok.</div>
                    ) : (
                      <div style={{ display: "grid", gap: 10 }}>
                        {drafts.map((s) => (
                          <div key={s._id} className="fieldRow">
                            <div className="fieldRowTop">
                              <div className="fieldRowTitle">
                                {s.site?.name ?? "Site"} <span className="fieldRowKey">{s.status}</span>
                              </div>

                              <div style={{ display: "flex", gap: 8 }}>
                                <Link className="btn" style={actionBtnStyle} to={`/forms/fill/${s._id}`}>
                                  Devam Et
                                </Link>

                                <button
                                  className="btn btnDanger"
                                  style={actionBtnStyle}
                                  disabled={saving}
                                  onClick={() => setDraftToDelete(s._id)}
                                  title="Taslağı sil"
                                >
                                  Sil
                                </button>
                              </div>
                            </div>

                            <div className="hint">{s.updatedAt ? `Son güncelleme: ${new Date(s.updatedAt).toLocaleString("tr-TR")}` : ""}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="hint" style={{ marginBottom: 8 }}>
                      Gönderilenler / Tamamlananlar: <b>{completed.length}</b>
                    </div>

                    {completed.length === 0 ? (
                      <div className="hint">Gönderilen kayıt yok.</div>
                    ) : (
                      <div style={{ display: "grid", gap: 10 }}>
                        {completed.map((s) => (
                          <div key={s._id} className="fieldRow">
                            <div className="fieldRowTop">
                              <div className="fieldRowTitle">
                                {s.site?.name ?? "Site"} <span className="fieldRowKey">{s.status}</span>
                              </div>

                              <div style={{ display: "flex", gap: 8 }}>
                                <Link className="btn" style={actionBtnStyle} to={`/forms/fill/${s._id}`}>
                                  Aç
                                </Link>

                                {s.pdfPath ? (
                                  <a className="btn" style={actionBtnStyle} href={absUrl(String(s.pdfPath))} target="_blank" rel="noreferrer">
                                    📄 PDF
                                  </a>
                                ) : null}

                                <button className="btn btnDanger" style={actionBtnStyle} disabled={saving} onClick={() => setDraftToDelete(s._id)}>
                                  Sil
                                </button>
                              </div>
                            </div>

                            <div className="hint">
                              {s.updatedAt ? `Son güncelleme: ${new Date(s.updatedAt).toLocaleString("tr-TR")}` : ""}
                              {typeof s.mailLogCount === "number" ? ` · Mail: ${s.mailLogCount}` : ""}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </Card>

            <div style={{ height: 12 }} />

            {/* ✅ ADD */}
            <AddFieldModal
              open={fieldModalOpen}
              onClose={() => setFieldModalOpen(false)}
              templateId={id}
              mode="add"
              sites={sites.map((s) => ({ _id: s._id, name: s.name }))}
              defaultSiteId={selectedSiteId}
              onCreated={async () => {
                await refresh();
              }}
            />

            {/* ✅ EDIT */}
            <AddFieldModal
              open={Boolean(editField)}
              onClose={() => setEditField(null)}
              templateId={id}
              mode="edit"
              initialField={editField}
              sites={sites.map((s) => ({ _id: s._id, name: s.name }))}
              defaultSiteId={selectedSiteId}
              onCreated={async () => {
                await refresh();
              }}
            />


            <ConfirmDialog
              open={Boolean(fieldToDelete)}
              title="Alanı Kaldır"
              message={fieldToDelete ? `"${fieldToDelete}" alanı kaldırılacak. Emin misin?` : "Alan seçili değil."}
              confirmText="Kaldır"
              cancelText="Vazgeç"
              danger
              disabled={saving}
              onClose={() => setFieldToDelete(null)}
              onConfirm={handleDeleteField}
            />

            <ConfirmDialog
              open={Boolean(draftToDelete)}
              title="Kaydı Sil"
              message="Bu kayıt kalıcı olarak silinecek. Emin misin?"
              confirmText="Sil"
              cancelText="Vazgeç"
              danger
              disabled={saving}
              onClose={() => setDraftToDelete(null)}
              onConfirm={confirmDeleteDraft}
            />

            {/* ✅ NEW: delete all confirm */}
            <ConfirmDialog
              open={confirmDeleteAllOpen}
              title="Tüm Kayıtları Sil"
              message={`Bu form için tüm taslaklar ve gönderimler (${subs.length}) kalıcı olarak silinecek. Emin misin?`}
              confirmText="Hepsini Sil"
              cancelText="Vazgeç"
              danger
              disabled={saving}
              onClose={() => setConfirmDeleteAllOpen(false)}
              onConfirm={confirmDeleteAll}
            />

            <ConfirmDialog
              open={confirmDeleteFormOpen}
              title="Formu Kaldır"
              message="Bu form kalıcı olarak silinecek. Bu işlem geri alınamaz. Emin misin?"
              confirmText="Evet, Sil"
              cancelText="Vazgeç"
              danger
              disabled={saving}
              onClose={() => setConfirmDeleteFormOpen(false)}
              onConfirm={handleDeleteForm}
            />

          </>
        )}
      </Page>
    </AppShell>
  );
}
