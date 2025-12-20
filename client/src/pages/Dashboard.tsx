import { useEffect, useMemo, useState } from "react";
import AppShell from "../components/Shell/AppShell";
import Page from "../ui/Page";
import Card from "../ui/Card";
import EmptyState from "../ui/EmptyState";
import ConfirmDialog from "../ui/ConfirmDialog";

import { http } from "../api/http";
import { useToast } from "../components/ToastProvider";

import { useAuth } from "../auth/AuthContext";
import { can } from "../auth/permissions";

type DashboardDto = {
  sites?: { total?: number; active?: number };
  users?: { total?: number; personnel?: number };
  audits?: { today?: number };
  notifications?: { open?: number };
};

type UploadStatsDto = {
  imageCount: number;
  pdfCount: number;
  total: number;
};

const UPLOAD_LIMIT = 2;

export default function Dashboard() {
  const toast = useToast();
  const { me } = useAuth();

  const canBuild = can(me, "forms.builder"); // form düzenleme yetkisi

  const [data, setData] = useState<DashboardDto | null>(null);
  const [loading, setLoading] = useState(true);

  // uploads stats
  const [uploadStats, setUploadStats] = useState<UploadStatsDto | null>(null);
  const [uploadsLoading, setUploadsLoading] = useState(false);

  // modal states
  const [uploadsWarnOpen, setUploadsWarnOpen] = useState(false);
  const [purgeConfirmOpen, setPurgeConfirmOpen] = useState(false);
  const [purging, setPurging] = useState(false);

  const fetchDashboard = async () => {
    setLoading(true);
    try {
      const res = await http.get<DashboardDto>("/stats/overview");
      setData(res.data);
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? "Dashboard verileri alınamadı.", "Hata");
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const fetchUploadStats = async () => {
    setUploadsLoading(true);
    try {
      const res = await http.get<UploadStatsDto>("/upload/stats");
      const s = res.data;
      setUploadStats(s);

      // ✅ açılışta kontrol: > 20 ise modalı aç
      if ((s?.total ?? 0) > UPLOAD_LIMIT) {
        setUploadsWarnOpen(true);
      }
    } catch (e: any) {
      // uploads stats alınamazsa dashboard'u bozmayalım; sadece uyarı verelim
      toast.error(e?.response?.data?.message ?? "Uploads sayıları alınamadı.", "Hata");
      setUploadStats(null);
    } finally {
      setUploadsLoading(false);
    }
  };

  const purgeUploads = async () => {
    if (!canBuild) {
      toast.error("Bu işlem için yetkin yok.", "Erişim Engellendi");
      return;
    }
    if (purging) return;

    try {
      setPurgeConfirmOpen(false);
      setPurging(true);

      await http.delete("/upload/purge");

      toast.success("Sunucudaki resim/PDF dosyaları silindi.", "Başarılı");

      setUploadsWarnOpen(false);

      // yeniden say
      await fetchUploadStats();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? "Silme işlemi başarısız.", "Hata");
    } finally {
      setPurging(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
    fetchUploadStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const kpi = {
    activeSites: data?.sites?.active ?? 0,
    totalSites: data?.sites?.total ?? 0,
    personnel: data?.users?.personnel ?? 0,
    totalUsers: data?.users?.total ?? 0,
    todayAudits: data?.audits?.today ?? 0,
    openNotifications: data?.notifications?.open ?? 0,
  };

  const uploadsWarningMessage = useMemo(() => {
    const img = uploadStats?.imageCount ?? 0;
    const pdf = uploadStats?.pdfCount ?? 0;
    const total = uploadStats?.total ?? 0;

    const base =
      `Dikkat! Sunucudaki fotoğraf/PDF sayısı çok fazla.\n` +
      `Fotoğraf: ${img} · PDF: ${pdf} · Toplam: ${total}\n\n` +
      `Lütfen silin; yetkiniz yoksa yetkili birinden sildirin.`;

    if (!canBuild) {
      return base + `\n\nYetkiniz yok.`;
    }
    return base;
  }, [uploadStats, canBuild]);

  return (
    <AppShell title="Genel Bakış" active="dashboard">
      <Page
        title="Genel Bakış"
        subtitle="Operasyon özetini buradan takip edebilirsin."
        right={
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              className="btn"
              onClick={async () => {
                await fetchDashboard();
                await fetchUploadStats();
              }}
              disabled={loading || uploadsLoading || purging}
            >
              {loading || uploadsLoading ? "Yükleniyor..." : "Yenile"}
            </button>
          </div>
        }
      >
        <Card title="Hızlı Özet" subtitle="Canlı operasyon verileri">
          {loading ? (
            <div className="kpiGrid">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="kpi">
                  <div className="kpiTop">
                    <span className="kpiIcon">⏳</span>
                    <span className="kpiTitle">Yükleniyor</span>
                  </div>
                  <div className="kpiValue">—</div>
                  <div className="kpiSub">Lütfen bekleyin</div>
                </div>
              ))}
            </div>
          ) : !data ? (
            <EmptyState
              title="Veri yok"
              description="Dashboard verisi alınamadı. Yenilemeyi deneyebilirsin."
              right={
                <button className="btn btnPrimary" onClick={fetchDashboard}>
                  Yeniden Dene
                </button>
              }
            />
          ) : (
            <div className="kpiGrid">
              <div className="kpi">
                <div className="kpiTop">
                  <span className="kpiIcon">🏢</span>
                  <span className="kpiTitle">Aktif Site</span>
                </div>
                <div className="kpiValue">{kpi.activeSites}</div>
                <div className="kpiSub">Toplam: {kpi.totalSites}</div>
              </div>

              <div className="kpi">
                <div className="kpiTop">
                  <span className="kpiIcon">👮</span>
                  <span className="kpiTitle">Personel</span>
                </div>
                <div className="kpiValue">{kpi.personnel}</div>
                <div className="kpiSub">Toplam kullanıcı: {kpi.totalUsers}</div>
              </div>

              <div className="kpi">
                <div className="kpiTop">
                  <span className="kpiIcon">📋</span>
                  <span className="kpiTitle">Bugünkü Denetim</span>
                </div>
                <div className="kpiValue">{kpi.todayAudits}</div>
                <div className="kpiSub">Bugün tamamlanan</div>
              </div>

              <div className="kpi">
                <div className="kpiTop">
                  <span className="kpiIcon">🔔</span>
                  <span className="kpiTitle">Açık Bildirim</span>
                </div>
                <div className="kpiValue">{kpi.openNotifications}</div>
                <div className="kpiSub">Bekleyen bildirim</div>
              </div>
            </div>
          )}
        </Card>

        {/* ✅ Uploads uyarı modalı */}
        <ConfirmDialog
          open={uploadsWarnOpen}
          title="Dikkat"
          message={uploadsWarningMessage}
          danger={canBuild}
          disabled={purging}
          confirmText={canBuild ? (purging ? "Siliniyor..." : "Tümünü Sil") : "Tamam"}
          cancelText={canBuild ? "Kapat" : undefined}
          onClose={() => setUploadsWarnOpen(false)}
          onConfirm={() => {
            if (!canBuild) {
              setUploadsWarnOpen(false);
              return;
            }
            setPurgeConfirmOpen(true);
          }}
        />

        {/* ✅ Silme için ikinci onay */}
        <ConfirmDialog
          open={purgeConfirmOpen}
          title="Tüm Dosyaları Sil"
          message="Bu işlem uploads altındaki resim ve PDF dosyalarının tamamını siler. Emin misin?"
          danger
          disabled={purging}
          confirmText={purging ? "Siliniyor..." : "Evet, Sil"}
          cancelText="Vazgeç"
          onClose={() => setPurgeConfirmOpen(false)}
          onConfirm={purgeUploads}
        />
      </Page>
    </AppShell>
  );
}
