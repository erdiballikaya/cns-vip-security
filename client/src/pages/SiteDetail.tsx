import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";

import AppShell from "../components/Shell/AppShell";
import Page from "../ui/Page";
import Card from "../ui/Card";
import EmptyState from "../ui/EmptyState";
import ConfirmDialog from "../ui/ConfirmDialog";

import { getSiteById, updateSite, deleteSite, type SiteDto, type SitePersonnelDto } from "../api/sites";
import { uploadCompanyLogo } from "../api/uploads";

function absUrl(maybeRelative: string) {
  if (!maybeRelative) return "";
  if (maybeRelative.startsWith("http")) return maybeRelative;
  const base = (import.meta.env.VITE_API_URL as string) || "";
  return `${base}${maybeRelative.startsWith("/") ? "" : "/"}${maybeRelative}`;
}
import { useAuth } from "../auth/AuthContext";
import { can } from "../auth/permissions";
import { useToast } from "../components/ToastProvider";

export default function SiteDetail() {
  const toast = useToast();
  const nav = useNavigate();

  const { me } = useAuth();
  const canView = can(me, "sites.view");
  const canEdit = can(me, "sites.edit");
  const canDelete = can(me, "sites.delete");

  const { id } = useParams<{ id: string }>();

  const [site, setSite] = useState<SiteDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [editDyn, setEditDyn] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);

  const [editName, setEditName] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editLogoUrl, setEditLogoUrl] = useState("");
  const [editPersonnel, setEditPersonnel] = useState<SitePersonnelDto[]>([]);
  const [logoUploading, setLogoUploading] = useState(false);

  // Alan Ekle
  const [adding, setAdding] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");

  // ConfirmDialog (dinamik alan silme)
  const [confirmFieldOpen, setConfirmFieldOpen] = useState(false);
  const [pendingRemoveKey, setPendingRemoveKey] = useState<string | null>(null);

  // Personel ekleme
  const [addingPerson, setAddingPerson] = useState(false);
  const [newPersonName, setNewPersonName] = useState("");
  const [newPersonRole, setNewPersonRole] = useState("");
  const [newPersonPhone, setNewPersonPhone] = useState("");
  const [newPersonEmail, setNewPersonEmail] = useState("");

  // ConfirmDialog (personel silme)
  const [confirmPersonOpen, setConfirmPersonOpen] = useState(false);
  const [pendingPersonIndex, setPendingPersonIndex] = useState<number | null>(null);

  // ConfirmDialog (site silme)
  const [confirmSiteDeleteOpen, setConfirmSiteDeleteOpen] = useState(false);

  useEffect(() => {
    if (!id) return;

    setLoading(true);
    setNotFound(false);

    getSiteById(id)
      .then((s) => {
        setSite(s);
        setEditDyn(s.dynamic ?? {});
        setEditName(s.name ?? "");
        setEditAddress(s.address ?? "");
        setEditLogoUrl(s.logoUrl ?? "");
        setEditPersonnel(s.personnel ?? []);
      })
      .catch((e: any) => {
        if (e?.response?.status === 404) setNotFound(true);
        else toast.error(e?.response?.data?.message ?? "Site yüklenemedi.", "Hata");
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const dynamicKeys = useMemo(() => Object.keys(editDyn ?? {}), [editDyn]);

  const resetEdits = () => {
    setEditDyn(site?.dynamic ?? {});
    setEditName(site?.name ?? "");
    setEditAddress(site?.address ?? "");
    setEditLogoUrl(site?.logoUrl ?? "");
    setEditPersonnel(site?.personnel ?? []);
    setAdding(false);
    setNewKey("");
    setNewValue("");
    setAddingPerson(false);
    setNewPersonName("");
    setNewPersonRole("");
    setNewPersonPhone("");
    setNewPersonEmail("");
    toast.info("Değişiklikler geri alındı.", "Bilgi");
  };

  const saveAll = async () => {
    if (!id) return;

    if (!canEdit) {
      toast.error("Bu işlem için yetkin yok: Site Düzenleme", "Erişim Engellendi");
      return;
    }

    if (saving) return;

    try {
      setSaving(true);
      const updated = await updateSite(id, {
        name: editName,
        address: editAddress,
        logoUrl: editLogoUrl,
        dynamic: editDyn,
        personnel: editPersonnel,
      });

      setSite(updated);
      setEditDyn(updated.dynamic ?? {});
      setEditName(updated.name ?? "");
      setEditAddress(updated.address ?? "");
      setEditLogoUrl(updated.logoUrl ?? "");
      setEditPersonnel(updated.personnel ?? []);
      setAdding(false);
      setNewKey("");
      setNewValue("");
      setAddingPerson(false);
      setNewPersonName("");
      setNewPersonRole("");
      setNewPersonPhone("");
      setNewPersonEmail("");

      toast.success("Site kaydedildi.", "Başarılı");
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? "Kaydetme başarısız.", "Hata");
    } finally {
      setSaving(false);
    }
  };

  const onLogoPick = async (file: File | null) => {
    if (!file) return;
    if (!canEdit) {
      toast.error("Bu işlem için yetkin yok: Site Düzenleme", "Erişim Engellendi");
      return;
    }
    try {
      setLogoUploading(true);
      const url = await uploadCompanyLogo(file);
      setEditLogoUrl(url);
      toast.success("Logo yüklendi.", "Başarılı");
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? "Logo yüklenemedi.", "Hata");
    } finally {
      setLogoUploading(false);
    }
  };

  const addField = () => {
    if (!canEdit) {
      toast.error("Bu işlem için yetkin yok: Site Düzenleme", "Erişim Engellendi");
      return;
    }

    const k = newKey.trim();
    const v = newValue; // string olarak kalsın (istersen trimleyebiliriz)
    if (!k) return toast.error("Alan adı boş olamaz.", "Eksik Bilgi");
    if (k.includes(".")) return toast.error("Alan adı '.' içeremez.", "Geçersiz Alan");
    if (Object.prototype.hasOwnProperty.call(editDyn, k))
      return toast.error("Bu alan zaten var.", "Çakışma");

    setEditDyn((prev) => ({ ...(prev ?? {}), [k]: v }));
    setNewKey("");
    setNewValue("");
    setAdding(false);

    toast.success(`Alan eklendi: ${k}`, "Başarılı");
  };

  const requestRemoveField = (k: string) => {
    if (!canEdit) {
      toast.error("Bu işlem için yetkin yok: Site Düzenleme", "Erişim Engellendi");
      return;
    }
    if (saving) return;

    setPendingRemoveKey(k);
    setConfirmFieldOpen(true);
  };

  const confirmRemoveField = () => {
    const k = pendingRemoveKey;
    if (!k) return;

    setEditDyn((prev) => {
      const copy = { ...(prev ?? {}) };
      delete copy[k];
      return copy;
    });

    toast.success(`Alan kaldırıldı: ${k}`, "Başarılı");
    setPendingRemoveKey(null);
    setConfirmFieldOpen(false);
  };

  const updatePerson = (index: number, patch: Partial<SitePersonnelDto>) => {
    setEditPersonnel((prev) => (prev ?? []).map((p, i) => (i === index ? { ...p, ...patch } : p)));
  };

  const addPerson = () => {
    if (!canEdit) {
      toast.error("Bu işlem için yetkin yok: Site Düzenleme", "Erişim Engellendi");
      return;
    }
    if (!newPersonName.trim()) return toast.error("Personel adı zorunlu.", "Eksik Bilgi");

    const entry: SitePersonnelDto = {
      name: newPersonName.trim(),
      role: newPersonRole.trim(),
      phone: newPersonPhone.trim(),
      email: newPersonEmail.trim(),
    };

    setEditPersonnel((prev) => [...(prev ?? []), entry]);
    setAddingPerson(false);
    setNewPersonName("");
    setNewPersonRole("");
    setNewPersonPhone("");
    setNewPersonEmail("");

    toast.success("Personel eklendi.", "Başarılı");
  };

  const requestRemovePerson = (index: number) => {
    if (!canEdit) {
      toast.error("Bu işlem için yetkin yok: Site Düzenleme", "Erişim Engellendi");
      return;
    }
    if (saving) return;
    setPendingPersonIndex(index);
    setConfirmPersonOpen(true);
  };

  const confirmRemovePerson = () => {
    if (pendingPersonIndex === null) return;
    setEditPersonnel((prev) => (prev ?? []).filter((_, i) => i !== pendingPersonIndex));
    setPendingPersonIndex(null);
    setConfirmPersonOpen(false);
    toast.success("Personel kaldırıldı.", "Başarılı");
  };

  // Site silme
  const requestDeleteSite = () => {
    if (!site || !id) return;

    if (!canDelete) {
      toast.error("Bu işlem için yetkin yok: Site Silme", "Erişim Engellendi");
      return;
    }

    if (saving) return;
    setConfirmSiteDeleteOpen(true);
  };

  const confirmDeleteSite = async () => {
    if (!id) return;

    try {
      setSaving(true);
      await deleteSite(id);

      toast.success("Site silindi.", "Başarılı");
      nav("/sites", { replace: true });
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? "Site silinemedi.", "Hata");
    } finally {
      setSaving(false);
      setConfirmSiteDeleteOpen(false);
    }
  };

  if (!id) return <Navigate to="/sites" replace />;
  if (!canView) return <Navigate to="/403" replace />;
  if (notFound) return <Navigate to="/sites" replace />;

  return (
    <AppShell title="Site Detayı" active="sites">
      <Page
        title={loading ? "Yükleniyor..." : site?.name ?? "Site"}
        subtitle={site?.address ?? "Adres girilmemiş"}
        right={
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <Link className="btn" to="/sites">
              ← Siteler
            </Link>

            {canEdit ? (
              <>
                <button className="btn btnPrimary" disabled={Boolean(loading || saving)} onClick={saveAll}>
                  {saving ? "Kaydediliyor..." : "Kaydet"}
                </button>
                <button className="btn" disabled={Boolean(loading || saving)} onClick={resetEdits}>
                  Vazgeç
                </button>
              </>
            ) : (
              <span className="hint">Salt görüntüleme</span>
            )}

            {canDelete && (
              <button
                className="btn btnDanger"
                disabled={Boolean(loading || saving || !site)}
                onClick={requestDeleteSite}
                title={!site ? "Site yüklenmeden silinemez" : "Siteyi sil"}
              >
                Siteyi Sil
              </button>
            )}
          </div>
        }
      >
        <Card title="Genel Bilgiler" subtitle="Site adı ve adresi">
          {loading ? (
            <div className="hint">Yükleniyor...</div>
          ) : !site ? (
            <EmptyState title="Site bulunamadı" description="Site silinmiş veya erişimin yok." />
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              <div className="field">
                <div className="label">Site Adı</div>
                {canEdit ? (
                  <input
                    className="input"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Örn: Site A"
                    disabled={saving}
                  />
                ) : (
                  <div className="hint">{editName || "-"}</div>
                )}
              </div>

              <div className="field">
                <div className="label">Adres</div>
                {canEdit ? (
                  <input
                    className="input"
                    value={editAddress}
                    onChange={(e) => setEditAddress(e.target.value)}
                    placeholder="Örn: İstanbul, ..."
                    disabled={saving}
                  />
                ) : (
                  <div className="hint">{editAddress || "-"}</div>
                )}
              </div>

              <div className="field">
                <div className="label">Logo</div>
                {editLogoUrl ? (
                  <img
                    src={absUrl(editLogoUrl)}
                    alt="Site logo"
                    style={{ maxHeight: 80, objectFit: "contain", borderRadius: 8, border: "1px solid #1f2937" }}
                  />
                ) : (
                  <div className="hint">Logo yok</div>
                )}
                {canEdit ? (
                  <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                    <label className="btn" style={{ padding: "6px 10px" }}>
                      {editLogoUrl ? "Değiştir" : "Logo Yükle"}
                      <input
                        type="file"
                        accept="image/*"
                        style={{ display: "none" }}
                        disabled={saving || logoUploading}
                        onChange={(e) => onLogoPick(e.target.files?.[0] ?? null)}
                      />
                    </label>
                    {editLogoUrl ? (
                      <button
                        className="btn"
                        disabled={saving || logoUploading}
                        onClick={() => setEditLogoUrl("")}
                      >
                        Kaldır
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div className="hint">
                Oluşturma: {site?.createdAt ? new Date(site.createdAt).toLocaleString("tr-TR") : "-"}
              </div>
            </div>
          )}
        </Card>

        <div style={{ height: 12 }} />

        <Card
          title="Dinamik Alanlar"
          subtitle={
            canEdit
              ? "Alan ekleyebilir, düzenleyebilir, silebilir ve Kaydet’e basabilirsin."
              : "Bu alanları görüntüleyebilirsin (düzenleme yetkin yok)."
          }
          right={
            canEdit ? (
              <button
                className="btn btnPrimary"
                disabled={Boolean(loading || saving)}
                onClick={() => setAdding((v) => !v)}
              >
                + Alan Ekle
              </button>
            ) : undefined
          }
        >
          {loading ? (
            <div className="hint">Yükleniyor...</div>
          ) : (
            <>
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
                      disabled={saving}
                    />
                    <input
                      className="ctrl"
                      value={newValue}
                      onChange={(e) => setNewValue(e.target.value)}
                      placeholder="Varsayılan değer (opsiyonel)"
                      disabled={saving}
                    />

                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <button className="btn btnPrimary" disabled={Boolean(saving)} onClick={addField}>
                        Ekle
                      </button>
                      <button
                        className="btn"
                        disabled={Boolean(saving)}
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
                  description={
                    canEdit
                      ? "“Alan Ekle” ile bu siteye yeni alan ekleyebilirsin."
                      : "Bu site için kayıtlı dinamik alan yok."
                  }
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
                    const v = editDyn?.[k];

                    return (
                      <div key={k} className="fieldRow">
                        <div className="fieldRowTop">
                          <div className="fieldRowTitle">{k}</div>

                          {canEdit ? (
                            <button className="btn" onClick={() => requestRemoveField(k)} disabled={Boolean(saving)}>
                              Sil
                            </button>
                          ) : (
                            <span className="hint" />
                          )}
                        </div>

                        {canEdit ? (
                          <input
                            className="ctrl"
                            value={v ?? ""}
                            onChange={(e) =>
                              setEditDyn((prev) => ({
                                ...(prev ?? {}),
                                [k]: e.target.value,
                              }))
                            }
                            placeholder="Değer"
                            disabled={Boolean(saving)}
                          />
                        ) : (
                          <div className="hint">{String(v ?? "-")}</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
          </Card>

        <div style={{ height: 12 }} />

        <Card
          title="Personeller"
          subtitle={
            canEdit
              ? "Personel ekleyebilir/silebilir ve Kaydet’e basabilirsin."
              : "Bu alanları görüntüleyebilirsin (düzenleme yetkin yok)."
          }
          right={
            canEdit ? (
              <button
                className="btn btnPrimary"
                disabled={Boolean(loading || saving)}
                onClick={() => setAddingPerson((v) => !v)}
              >
                + Personel Ekle
              </button>
            ) : undefined
          }
        >
          {loading ? (
            <div className="hint">Yükleniyor...</div>
          ) : (
            <>
              {canEdit && addingPerson && (
                <div className="fieldRow" style={{ marginBottom: 12 }}>
                  <div className="fieldRowTop">
                    <div className="fieldRowTitle">Yeni Personel</div>
                    <div className="hint">Site personeli</div>
                  </div>

                  <div style={{ display: "grid", gap: 10 }}>
                    <input
                      className="ctrl"
                      value={newPersonName}
                      onChange={(e) => setNewPersonName(e.target.value)}
                      placeholder="Ad Soyad *"
                      disabled={saving}
                    />
                    <input
                      className="ctrl"
                      value={newPersonRole}
                      onChange={(e) => setNewPersonRole(e.target.value)}
                      placeholder="Görev / Ünvan"
                      disabled={saving}
                    />
                    <input
                      className="ctrl"
                      value={newPersonPhone}
                      onChange={(e) => setNewPersonPhone(e.target.value)}
                      placeholder="Telefon"
                      disabled={saving}
                    />
                    <input
                      className="ctrl"
                      value={newPersonEmail}
                      onChange={(e) => setNewPersonEmail(e.target.value)}
                      placeholder="Email"
                      disabled={saving}
                    />

                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <button className="btn btnPrimary" disabled={Boolean(saving)} onClick={addPerson}>
                        Ekle
                      </button>
                      <button
                        className="btn"
                        disabled={Boolean(saving)}
                        onClick={() => {
                          setAddingPerson(false);
                          setNewPersonName("");
                          setNewPersonRole("");
                          setNewPersonPhone("");
                          setNewPersonEmail("");
                        }}
                      >
                        İptal
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {editPersonnel.length === 0 ? (
                <EmptyState
                  title="Personel yok"
                  description={
                    canEdit
                      ? "“Personel Ekle” ile bu siteye personel ekleyebilirsin."
                      : "Bu site için kayıtlı personel yok."
                  }
                  right={
                    canEdit ? (
                      <button className="btn btnPrimary" onClick={() => setAddingPerson(true)}>
                        + Personel Ekle
                      </button>
                    ) : undefined
                  }
                />
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  {editPersonnel.map((p, idx) => (
                    <div key={`${p.name}-${idx}`} className="fieldRow">
                      <div className="fieldRowTop">
                        <div className="fieldRowTitle">{p.name}</div>
                        {canEdit ? (
                          <button className="btn" onClick={() => requestRemovePerson(idx)} disabled={Boolean(saving)}>
                            Sil
                          </button>
                        ) : (
                          <span className="hint" />
                        )}
                      </div>

                      {canEdit ? (
                        <div
                          style={{
                            display: "grid",
                            gap: 10,
                            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                          }}
                        >
                          <div className="field">
                            <div className="label">Ad Soyad</div>
                            <input
                              className="ctrl"
                              value={p.name ?? ""}
                              onChange={(e) => updatePerson(idx, { name: e.target.value })}
                              placeholder="Ad Soyad"
                              disabled={saving}
                            />
                          </div>
                          <div className="field">
                            <div className="label">Görev / Ünvan</div>
                            <input
                              className="ctrl"
                              value={p.role ?? ""}
                              onChange={(e) => updatePerson(idx, { role: e.target.value })}
                              placeholder="Görev"
                              disabled={saving}
                            />
                          </div>
                          <div className="field">
                            <div className="label">Telefon</div>
                            <input
                              className="ctrl"
                              value={p.phone ?? ""}
                              onChange={(e) => updatePerson(idx, { phone: e.target.value })}
                              placeholder="Telefon"
                              disabled={saving}
                            />
                          </div>
                          <div className="field">
                            <div className="label">Email</div>
                            <input
                              className="ctrl"
                              value={p.email ?? ""}
                              onChange={(e) => updatePerson(idx, { email: e.target.value })}
                              placeholder="Email"
                              disabled={saving}
                            />
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: "grid", gap: 8 }}>
                          <div className="hint">{p.role ? `Görev: ${p.role}` : "Görev: -"}</div>
                          <div className="hint">{p.phone ? `Telefon: ${p.phone}` : "Telefon: -"}</div>
                          <div className="hint">{p.email ? `Email: ${p.email}` : "Email: -"}</div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </Card>

        <ConfirmDialog
          open={confirmFieldOpen}
          title="Alanı Sil"
          message={
            pendingRemoveKey
              ? `"${pendingRemoveKey}" alanı silinsin mi?\n\nBu değişiklik kaydetmeden geri alınabilir (Vazgeç).`
              : "Alan seçili değil."
          }
          confirmText="Sil"
          cancelText="Vazgeç"
          danger
          disabled={saving}
          onClose={() => {
            setConfirmFieldOpen(false);
            setPendingRemoveKey(null);
          }}
          onConfirm={confirmRemoveField}
        />

        <ConfirmDialog
          open={confirmPersonOpen}
          title="Personeli Sil"
          message="Seçili personel silinsin mi?\n\nBu değişiklik kaydetmeden geri alınabilir (Vazgeç)."
          confirmText="Sil"
          cancelText="Vazgeç"
          danger
          disabled={saving}
          onClose={() => {
            setConfirmPersonOpen(false);
            setPendingPersonIndex(null);
          }}
          onConfirm={confirmRemovePerson}
        />

        <ConfirmDialog
          open={confirmSiteDeleteOpen}
          title="Siteyi Sil"
          message={site ? `"${site.name}" sitesi silinsin mi?\n\nBu işlem geri alınamaz.` : "Site seçili değil."}
          confirmText="Siteyi Sil"
          cancelText="Vazgeç"
          danger
          disabled={saving}
          onClose={() => setConfirmSiteDeleteOpen(false)}
          onConfirm={confirmDeleteSite}
        />
      </Page>
    </AppShell>
  );
}
