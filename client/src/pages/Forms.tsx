import { useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";

import AppShell from "../components/Shell/AppShell";
import Page from "../ui/Page";
import Card from "../ui/Card";
import EmptyState from "../ui/EmptyState";
import ConfirmDialog from "../ui/ConfirmDialog";

import { useToast } from "../components/ToastProvider";
import { useAuth } from "../auth/AuthContext";
import { can } from "../auth/permissions";
import { createForm, listForms, type FormTemplateDto } from "../api/forms";

export default function Forms() {
  const { me } = useAuth();
  const toast = useToast();

  // ✅ me daha gelmeden 403’e atmasın
  // (AuthContext’te loading yoksa en güvenli çözüm budur)
  if (!me) {
    return (
      <AppShell title="Form Yönetimi" active="forms">
        <Page title="Formlar" subtitle="Yükleniyor...">
          <Card title="Form Şablonları">
            <div className="hint">Yükleniyor...</div>
          </Card>
        </Page>
      </AppShell>
    );
  }

  // ✅ role normalize (Admin/Admin/ADMIN hepsi aynı)
  const isAdmin = String((me as any)?.role ?? "").toUpperCase() === "ADMIN";

  // ✅ admin için her zaman true
  const canView = isAdmin || can(me, "forms.view");
  const canBuild = isAdmin || can(me, "forms.builder");

  const [items, setItems] = useState<FormTemplateDto[]>([]);
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return items;
    return items.filter((x) => x.name.toLowerCase().includes(t));
  }, [q, items]);

  const refresh = async () => {
    setLoading(true);
    try {
      const data = await listForms();
      setItems(data);
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? "Formlar alınamadı", "Hata");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (canView) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canView]);

  // ✅ artık me var ve admin kontrolü de doğru
  if (!canView) return <Navigate to="/403" replace />;

  const confirmCreate = async () => {
    const n = name.trim();
    if (!n) return toast.error("Form adı zorunlu", "Eksik Bilgi");

    try {
      await createForm(n);
      toast.success("Form oluşturuldu", "Başarılı");
      setCreateOpen(false);
      setName("");
      await refresh();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? "Form oluşturulamadı", "Hata");
    }
  };

  return (
    <AppShell title="Form Yönetimi" active="forms">
      <Page
        title="Formlar"
        subtitle="Form şablonlarını yönet ve kullan."
        right={
          <div className="formsToolbar">
            <input
              className="ctrl"
              placeholder="Ara: form adı"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />

            {canBuild && (
              <button className="btn btnPrimary" onClick={() => setCreateOpen(true)}>
                + Form Oluştur
              </button>
            )}
          </div>
        }
      >
        <Card className="formsPrimaryCard" title="Form Şablonları" subtitle={`${filtered.length} kayıt`}>
          {loading ? (
            <div className="hint">Yükleniyor...</div>
          ) : filtered.length === 0 ? (
            <EmptyState title="Form yok" description="Henüz form şablonu oluşturulmamış." />
          ) : (
            <div className="formTemplateList">
              {filtered.map((f) => (
                <Link
                  key={f._id}
                  to={`/forms/${f._id}`}
                  className="fieldRow formTemplateItem"
                  style={{ textDecoration: "none" }}
                >
                  <div className="fieldRowTop formTemplateHead">
                    <div className="formTemplateMain">
                      <div className="fieldRowTitle formTemplateTitle">{f.name}</div>
                    </div>
                    <div className="hint formTemplateCount">{(f.fields || []).length} alan</div>
                  </div>
                  {/* <div className="formTemplateStats">
                    <span>{(f.fields || []).length} alan</span>
                    <span>{(f.recipients || []).length} mail alıcısı</span>
                  </div> */}
                </Link>
              ))}
            </div>
          )}
        </Card>

        {/* Basit create panel (ConfirmDialog input desteklemiyorsa bu yeterli) */}
        {createOpen && (
          <div style={{ marginTop: 12 }}>
            <Card title="Yeni Form">
              <div className="formsCreateRow">
                <input
                  className="ctrl"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="örn: Günlük Denetim"
                />
                <button className="btn btnPrimary" onClick={confirmCreate}>
                  Oluştur
                </button>
                <button
                  className="btn"
                  onClick={() => {
                    setCreateOpen(false);
                    setName("");
                  }}
                >
                  İptal
                </button>
              </div>
            </Card>
          </div>
        )}

        {/* İstersen ConfirmDialog kalsın ama şu an iki create UI var; birini seçmek daha temiz */}
        <ConfirmDialog
          open={false}
          title="Form Oluştur"
          message="Yeni form şablonu adı:"
          confirmText="Oluştur"
          cancelText="Vazgeç"
          onClose={() => {}}
          onConfirm={() => {}}
        />
      </Page>
    </AppShell>
  );
}
