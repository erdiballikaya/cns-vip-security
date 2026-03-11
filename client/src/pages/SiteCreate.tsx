import { useMemo, useState } from "react";
import AppShell from "../components/Shell/AppShell";
import Page from "../ui/Page";
import Card from "../ui/Card";
import Alert from "../ui/Alert";
import EmptyState from "../ui/EmptyState";
import { TwoCol, Stack } from "../ui/Grid";
import { http } from "../api/http";
import { uploadCompanyLogo } from "../api/uploads";
import { useAuth } from "../auth/AuthContext";
import { can } from "../auth/permissions";

function absUrl(maybeRelative: string) {
  if (!maybeRelative) return "";
  if (maybeRelative.startsWith("http")) return maybeRelative;
  const base = (import.meta.env.VITE_API_URL as string) || "";
  return `${base}${maybeRelative.startsWith("/") ? "" : "/"}${maybeRelative}`;
}

export default function SiteCreate() {
  const { me } = useAuth();
  const canEdit = can(me, "sites.edit"); // SiteCreate'de dinamik alan ekleme için sites.edit mantıklı
  // Eğer illa forms.builder ile kontrol etmek istiyorsan bunu değiştir.

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [logoUploading, setLogoUploading] = useState(false);

  const [dynamic, setDynamic] = useState<Record<string, any>>({});

  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ type: "ok" | "err" | "info"; title: string; msg: string } | null>(null);

  // ✅ SiteDetail ile aynı: Alan Ekle state'leri
  const [adding, setAdding] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");

  const dynamicKeys = useMemo(() => Object.keys(dynamic ?? {}), [dynamic]);

  const addField = () => {
    if (!canEdit) {
      setNotice({ type: "err", title: "Erişim Engellendi", msg: "Bu işlem için yetkin yok: Site Düzenleme" });
      return;
    }

    const k = newKey.trim();
    const v = newValue;

    if (!k) {
      setNotice({ type: "err", title: "Eksik Bilgi", msg: "Alan adı boş olamaz." });
      return;
    }
    if (k.includes(".")) {
      setNotice({ type: "err", title: "Geçersiz Alan", msg: "Alan adı '.' içeremez." });
      return;
    }
    if (Object.prototype.hasOwnProperty.call(dynamic, k)) {
      setNotice({ type: "err", title: "Çakışma", msg: "Bu alan zaten var." });
      return;
    }

    setDynamic((prev) => ({ ...(prev ?? {}), [k]: v }));
    setNewKey("");
    setNewValue("");
    setAdding(false);

    setNotice({ type: "ok", title: "Başarılı", msg: `Alan eklendi: ${k}` });
  };

  const removeField = (k: string) => {
    if (!canEdit) {
      setNotice({ type: "err", title: "Erişim Engellendi", msg: "Bu işlem için yetkin yok: Site Düzenleme" });
      return;
    }

    if (!confirm(`"${k}" alanı kaldırılacak. Emin misin?`)) return;

    setDynamic((prev) => {
      const copy = { ...(prev ?? {}) };
      delete copy[k];
      return copy;
    });

    setNotice({ type: "ok", title: "Başarılı", msg: `Alan kaldırıldı: ${k}` });
  };

  const create = async () => {
    setNotice(null);

    if (!name.trim()) return setNotice({ type: "err", title: "Hata", msg: "Site adı zorunlu." });

    setBusy(true);
    try {
      const res = await http.post("/sites", {
        name: name.trim(),
        address: address.trim(),
        logoUrl,
        dynamic,
      });

      setNotice({ type: "ok", title: "Kaydedildi", msg: `Oluşturuldu: ${res.data.name}` });

      setName("");
      setAddress("");
      setLogoUrl("");
      setDynamic({});
      setAdding(false);
      setNewKey("");
      setNewValue("");
    } catch (e: any) {
      setNotice({ type: "err", title: "Hata", msg: e?.response?.data?.message ?? "Kayıt sırasında hata oluştu." });
    } finally {
      setBusy(false);
    }
  };

  const onLogoPick = async (file: File | null) => {
    if (!file) return;
    if (!canEdit) {
      setNotice({ type: "err", title: "Erişim Engellendi", msg: "Bu işlem için yetkin yok: Site Düzenleme" });
      return;
    }
    try {
      setLogoUploading(true);
      const url = await uploadCompanyLogo(file);
      setLogoUrl(url);
      setNotice({ type: "ok", title: "Logo yüklendi", msg: "Logo başarıyla yüklendi." });
    } catch (e: any) {
      setNotice({ type: "err", title: "Hata", msg: e?.response?.data?.message ?? "Logo yüklenemedi." });
    } finally {
      setLogoUploading(false);
    }
  };

  return (
    <AppShell title="Site Ekle" active="sites">
      <Page
        title="Site Ekle"
        subtitle="Temel bilgileri gir, dinamik alanları ekle ve kaydet."
        right={
          <button className="btn btnPrimary" onClick={create} disabled={busy} style={{ minWidth: 140 }}>
            {busy ? "Kaydediliyor..." : "Kaydet"}
          </button>
        }
      >
        <TwoCol
          left={
            <Stack>
              <Card title="Site Bilgileri" subtitle="Zorunlu alan: Site adı">
                <div className="formGrid">
                  <div>
                    <div className="formLabel">Site adı *</div>
                    <input className="ctrl" value={name} onChange={(e) => setName(e.target.value)} />
                  </div>

                  <div>
                    <div className="formLabel">Adres</div>
                    <input className="ctrl" value={address} onChange={(e) => setAddress(e.target.value)} />
                  </div>

                  <div>
                    <div className="formLabel">Logo</div>
                    {logoUrl ? (
                      <div style={{ display: "grid", gap: 8 }}>
                        <img
                          src={absUrl(logoUrl)}
                          alt="Site logo"
                          style={{ maxHeight: 80, objectFit: "contain", borderRadius: 8, border: "1px solid #1f2937" }}
                        />
                        <div style={{ display: "flex", gap: 8 }}>
                          <label className="btn" style={{ padding: "6px 10px" }}>
                            Değiştir
                            <input
                              type="file"
                              accept="image/*"
                              style={{ display: "none" }}
                              disabled={logoUploading || busy}
                              onChange={(e) => onLogoPick(e.target.files?.[0] ?? null)}
                            />
                          </label>
                          <button className="btn" disabled={logoUploading || busy} onClick={() => setLogoUrl("")}>
                            Kaldır
                          </button>
                        </div>
                      </div>
                    ) : (
                      <label className="btn" style={{ padding: "6px 10px", width: "fit-content" }}>
                        Logo Yükle
                        <input
                          type="file"
                          accept="image/*"
                          style={{ display: "none" }}
                          disabled={logoUploading || busy}
                          onChange={(e) => onLogoPick(e.target.files?.[0] ?? null)}
                        />
                      </label>
                    )}
                  </div>

                  {notice ? <Alert type={notice.type} title={notice.title} message={notice.msg} /> : null}
                </div>
              </Card>

              <Card title="İpuçları" subtitle="Operasyon için faydalı notlar" className="siteHints">
                <ul>
                  <li>Dinamik alanlar: Bu siteye özel key/value alanlarıdır.</li>
                  <li>Bu alanlar form şablonu değildir; site kaydı içinde saklanır.</li>
                </ul>
              </Card>
            </Stack>
          }
          right={
            <Card
              title="Dinamik Alanlar"
              subtitle={canEdit ? "Alan ekleyebilir/silebilir (Site kaydıyla birlikte kaydolur)." : "Salt görüntüleme"}
              right={
                canEdit ? (
                  <button className="btn" onClick={() => setAdding((v) => !v)} disabled={busy}>
                    + Alan Ekle
                  </button>
                ) : undefined
              }
            >
              {canEdit && adding && (
                <div className="fieldRow" style={{ marginBottom: 12 }}>
                  <div className="fieldRowTop">
                    <div className="fieldRowTitle">Yeni Alan</div>
                    <div className="hint">Site dynamic</div>
                  </div>

                  <div style={{ display: "grid", gap: 10 }}>
                    <input
                      className="ctrl"
                      value={newKey}
                      onChange={(e) => setNewKey(e.target.value)}
                      placeholder="Alan adı (örn: kameraSayisi)"
                      disabled={busy}
                    />
                    <input
                      className="ctrl"
                      value={newValue}
                      onChange={(e) => setNewValue(e.target.value)}
                      placeholder="Varsayılan değer (opsiyonel)"
                      disabled={busy}
                    />

                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <button className="btn btnPrimary" disabled={busy} onClick={addField}>
                        Ekle
                      </button>
                      <button
                        className="btn"
                        disabled={busy}
                        onClick={() => {
                          setAdding(false);
                          setNewKey("");
                          setNewValue("");
                        }}
                      >
                        İptal
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {dynamicKeys.length === 0 ? (
                <EmptyState
                  title="Dinamik alan yok"
                  description={canEdit ? "“Alan Ekle” ile bu siteye yeni alan ekleyebilirsin." : "Dinamik alan yok."}
                  right={
                    canEdit ? (
                      <button className="btn btnPrimary" onClick={() => setAdding(true)}>
                        + Alan Ekle
                      </button>
                    ) : undefined
                  }
                />
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  {dynamicKeys.map((k) => {
                    const v = dynamic?.[k];

                    return (
                      <div key={k} className="fieldRow">
                        <div className="fieldRowTop">
                          <div className="fieldRowTitle">{k}</div>

                          {canEdit ? (
                            <button className="btn" onClick={() => removeField(k)} disabled={busy}>
                              Sil
                            </button>
                          ) : (
                            <span className="hint" />
                          )}
                        </div>

                        <input
                          className="ctrl"
                          value={v ?? ""}
                          onChange={(e) =>
                            setDynamic((prev) => ({
                              ...(prev ?? {}),
                              [k]: e.target.value,
                            }))
                          }
                          placeholder="Değer"
                          disabled={!canEdit || busy}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          }
        />
      </Page>
    </AppShell>
  );
}
