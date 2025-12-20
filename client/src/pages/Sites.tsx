import { useEffect, useMemo, useState } from "react";
import AppShell from "../components/Shell/AppShell";
import Page from "../ui/Page";
import Card from "../ui/Card";
import EmptyState from "../ui/EmptyState";
import { getSites, type SiteDto } from "../api/sites";
import { useNavigate } from "react-router-dom";

export default function Sites() {
  const [sites, setSites] = useState<SiteDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    getSites()
      .then(setSites)
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return sites;
    return sites.filter(
      (s) =>
        s.name.toLowerCase().includes(t) ||
        (s.address ?? "").toLowerCase().includes(t)
    );
  }, [q, sites]);

  const nav = useNavigate();
  
  return (
    <AppShell title="Siteler" active="sites">
      <Page
        title="Siteler"
        subtitle="Kayıtlı siteleri buradan yönetebilirsin"
        right={
          <a className="btn btnPrimary" href="/sites/create">
            + Site Ekle
          </a>
        }
      >
        <Card
          title="Site Listesi"
          subtitle={`${filtered.length} kayıt`}
          right={
            <input
              className="ctrl"
              style={{ width: 280 }}
              placeholder="Ara: site adı / adres"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          }
        >
          {loading ? (
            <div className="hint">Yükleniyor...</div>
          ) : filtered.length === 0 ? (
            <EmptyState
              title="Site bulunamadı"
              description="Henüz hiç site eklenmemiş veya arama sonucu boş."
              right={
                <a className="btn btnPrimary" href="/sites/create">
                  + Site Ekle
                </a>
              }
            />
          ) : (
            <div className="siteTable">
              {filtered.map((s) => (
                <div
                  key={s._id}
                  className="siteRow"
                  onClick={() => nav(`/sites/${s._id}`)}
                >
                  <div className="siteMain">
                    <div className="siteName">{s.name}</div>
                    <div className="siteAddress">
                      {s.address || "Adres girilmemiş"}
                    </div>
                  </div>

                  <div className="siteMeta">
                    {new Date(s.createdAt).toLocaleDateString("tr-TR")}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </Page>
    </AppShell>
  );
}
