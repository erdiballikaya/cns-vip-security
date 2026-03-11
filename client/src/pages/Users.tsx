import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";

import AppShell from "../components/Shell/AppShell";
import Page from "../ui/Page";
import Card from "../ui/Card";
import EmptyState from "../ui/EmptyState";

import {
  createUser,
  deleteUser,
  getUsers,
  updateUserModules,
  updateUserRole,
  type UserDto,
} from "../api/users";

import { useAuth } from "../auth/AuthContext";
import { can } from "../auth/permissions";

import { PERMISSIONS, type PermissionKey } from "../constants/permissions";
import { useToast } from "../components/ToastProvider";
import ConfirmDialog from "../ui/ConfirmDialog";

const GROUPS = ["Kullanıcılar", "Siteler", "Formlar"] as const;

export default function Users() {
  const { me } = useAuth();
  const toast = useToast();

  // me bazen {id} bazen {_id}
  const meId = (me as any)?.id ?? (me as any)?._id ?? null;

  const isAdmin = me?.role === "ADMIN";
  const canViewUsers = isAdmin || can(me, "users.view");
  const canManageUsers = isAdmin || can(me, "users.manage"); // silme dahil

  const [users, setUsers] = useState<UserDto[]>([]);
  const [active, setActive] = useState<UserDto | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [q, setQ] = useState("");

  // Create user panel (admin)
  const [showCreate, setShowCreate] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newPass, setNewPass] = useState("");
  const [newRole, setNewRole] = useState<UserDto["role"]>("PERSONNEL");

  // Delete confirm
  const [confirmOpen, setConfirmOpen] = useState(false);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return users;
    return users.filter((u) => u.email.toLowerCase().includes(t));
  }, [q, users]);

  const refresh = async () => {
    setLoading(true);
    try {
      const data = await getUsers();
      setUsers(data);

      // aktif kullanıcı listeden silindiyse temizle
      if (active && !data.find((x) => x._id === active._id)) setActive(null);
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? "Kullanıcılar alınamadı", "Hata");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!canViewUsers) return;
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canViewUsers]);

  // Sayfayı görme yetkisi yoksa 403
  if (!canViewUsers) return <Navigate to="/403" replace />;

  const isSelf =
    Boolean(active?._id) && Boolean(meId) && String(active?._id) === String(meId);

  const toggleModule = (key: PermissionKey) => {
    if (!active) return;
    if (!canManageUsers) return;

    const set = new Set(active.enabledModules || []);
    if (set.has(key)) set.delete(key);
    else set.add(key);

    setActive({ ...active, enabledModules: Array.from(set) });
  };

  const saveModules = async () => {
    if (!active) return;

    if (!canManageUsers) {
      toast.error("Bu işlem için yetkin yok: Kullanıcı Yönetimi", "Erişim Engellendi");
      return;
    }
    if (saving) return;

    const current = users.find((u) => u._id === active._id)?.enabledModules || [];
    const next = active.enabledModules || [];

    const curSet = new Set(current);
    const nextSet = new Set(next);

    const enable = next.filter((m) => !curSet.has(m));
    const disable = current.filter((m) => !nextSet.has(m));

    try {
      setSaving(true);
      const res = await updateUserModules(active._id, enable, disable);

      setUsers((prev) =>
        prev.map((u) =>
          u._id === active._id ? { ...u, enabledModules: res.enabledModules } : u
        )
      );
      setActive((prev) => (prev ? { ...prev, enabledModules: res.enabledModules } : prev));

      toast.success("Yetkiler kaydedildi", "Başarılı");
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? "Kaydetme başarısız", "Hata");
    } finally {
      setSaving(false);
    }
  };

  const saveRole = async (role: UserDto["role"]) => {
    if (!active) return;

    if (!canManageUsers) {
      toast.error("Bu işlem için yetkin yok: Kullanıcı Yönetimi", "Erişim Engellendi");
      return;
    }
    if (saving) return;

    try {
      setSaving(true);
      const updated = await updateUserRole(active._id, role);

      setUsers((prev) => prev.map((u) => (u._id === active._id ? updated : u)));
      setActive(updated);

      toast.success("Rol güncellendi", "Başarılı");
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? "Rol güncellenemedi", "Hata");
    } finally {
      setSaving(false);
    }
  };

  const closeCreate = () => {
    setShowCreate(false);
    setNewEmail("");
    setNewPass("");
    setNewRole("PERSONNEL");
  };

  const submitCreate = async () => {
    if (!isAdmin) return;

    const email = newEmail.trim().toLowerCase();
    const password = newPass;

    if (!email || !password) return toast.error("Email ve şifre zorunlu", "Eksik Bilgi");
    if (!email.includes("@")) return toast.error("Email formatı hatalı", "Geçersiz Email");
    if (password.length < 4) return toast.error("Şifre en az 4 karakter olsun", "Geçersiz Şifre");

    try {
      setSaving(true);

      await createUser({
        email,
        password,
        role: newRole,
        enabledModules: [],
      });

      closeCreate();

      // ✅ İstenen: sadece refresh
      await refresh();

      toast.success("Kullanıcı oluşturuldu", "Başarılı");
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? "Kullanıcı eklenemedi", "Hata");
    } finally {
      setSaving(false);
    }
  };

  const requestRemoveActiveUser = () => {
    if (!active) return;

    if (!canManageUsers) {
      toast.error("Bu işlem için yetkin yok: Kullanıcı Yönetimi", "Erişim Engellendi");
      return;
    }
    if (saving) return;

    if (isSelf) {
      toast.error("Kendi hesabını silemezsin.", "İşlem Engellendi");
      return;
    }

    setConfirmOpen(true);
  };

  const confirmRemoveActiveUser = async () => {
    if (!active) return;

    try {
      setSaving(true);
      await deleteUser(active._id);

      setUsers((prev) => prev.filter((u) => u._id !== active._id));
      setActive(null);

      toast.success("Kullanıcı silindi", "Başarılı");
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? "Kullanıcı silinemedi", "Hata");
    } finally {
      setSaving(false);
      setConfirmOpen(false);
    }
  };

  return (
    <AppShell title="Kullanıcılar" active="users">
      <Page
        title="Kullanıcılar"
        subtitle="Panel kullanıcılarını ve yetkilerini buradan yönet."
        right={
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <input
              className="ctrl"
              placeholder="Ara: email"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />

            {isAdmin && (
              <button
                className="btn btnPrimary"
                onClick={() => setShowCreate((v) => !v)}
                disabled={Boolean(saving)}
              >
                + Kullanıcı Ekle
              </button>
            )}
          </div>
        }
      >
        {showCreate && isAdmin && (
          <Card title="Yeni Kullanıcı" subtitle="Sadece ADMIN kullanıcı oluşturabilir.">
            <div style={{ display: "grid", gap: 12, maxWidth: 520 }}>
              <div className="field">
                <div className="label">Email</div>
                <input
                  className="input"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="ornek@cns.com"
                />
              </div>

              <div className="field">
                <div className="label">Şifre</div>
                <input
                  className="input"
                  value={newPass}
                  onChange={(e) => setNewPass(e.target.value)}
                />
              </div>

              <div className="field">
                <div className="label">Rol</div>
                <select
                  className="ctrl"
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as any)}
                >
                  <option value="ADMIN">ADMIN</option>
                  <option value="MANAGER">MANAGER</option>
                  <option value="PERSONNEL">PERSONNEL</option>
                </select>
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button className="btn btnPrimary" disabled={Boolean(saving)} onClick={submitCreate}>
                  {saving ? "Oluşturuluyor..." : "Oluştur"}
                </button>
                <button className="btn" disabled={Boolean(saving)} onClick={closeCreate}>
                  İptal
                </button>
              </div>
            </div>
          </Card>
        )}

        <div className="splitGrid">
          <Card title="Kullanıcı Listesi" subtitle={`${filtered.length} kullanıcı`}>
            {loading ? (
              <div className="hint">Yükleniyor...</div>
            ) : filtered.length === 0 ? (
              <EmptyState title="Kullanıcı yok" description="Arama sonucu boş." />
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {filtered.map((u) => (
                  <div
                    key={u._id}
                    className="fieldRow"
                    style={{
                      cursor: "pointer",
                      border: active?._id === u._id ? "1px solid rgba(10,162,180,.45)" : undefined,
                    }}
                    onClick={() => setActive(u)}
                  >
                    <div className="fieldRowTop">
                      <div className="fieldRowTitle">{u.email}</div>
                      <div className="hint">{u.role}</div>
                    </div>
                    <div className="hint">
                      {u.enabledModules?.length ? `${u.enabledModules.length} yetki` : "yetki yok"}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card
            title="Detay & Yetkiler"
            subtitle={canManageUsers ? "Rol ve yetkileri düzenleyebilirsin" : "Sadece görüntüleyebilirsin"}
            right={
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button className="btn" onClick={refresh} disabled={Boolean(loading || saving)}>
                  Yenile
                </button>

                <button
                  className="btn btnPrimary"
                  onClick={saveModules}
                  disabled={Boolean(!active || saving || !canManageUsers)}
                >
                  {saving ? "Kaydediliyor..." : "Kaydet"}
                </button>

                {canManageUsers && (
                  <button
                    className="btn btnDanger"
                    onClick={requestRemoveActiveUser}
                    disabled={Boolean(!active || saving || isSelf)}
                    title={
                      !active
                        ? "Önce kullanıcı seç"
                        : isSelf
                        ? "Kendi hesabını silemezsin"
                        : "Kullanıcıyı sil"
                    }
                  >
                    Sil
                  </button>
                )}
              </div>
            }
          >
            {!active ? (
              <EmptyState title="Kullanıcı seç" description="Soldan bir kullanıcı seç." />
            ) : (
              <div style={{ display: "grid", gap: 12 }}>
                <div className="field">
                  <div className="label">Email</div>
                  <div className="hint">{active.email}</div>
                </div>

                <div className="field">
                  <div className="label">Rol</div>
                  {!canManageUsers ? (
                    <div className="hint">{active.role}</div>
                  ) : (
                    <select
                      className="ctrl"
                      value={active.role}
                      onChange={(e) => saveRole(e.target.value as UserDto["role"])}
                      disabled={Boolean(saving)}
                    >
                      <option value="ADMIN">ADMIN</option>
                      <option value="MANAGER">MANAGER</option>
                      <option value="PERSONNEL">PERSONNEL</option>
                    </select>
                  )}
                </div>

                <div className="field">
                  <div className="label">Yetkiler</div>

                  {GROUPS.map((group) => (
                    <div key={group} style={{ marginTop: 8 }}>
                      <div style={{ fontWeight: 600, marginBottom: 6 }}>{group}</div>

                      <div style={{ display: "grid", gap: 10 }}>
                        {Object.entries(PERMISSIONS)
                          .filter(([, meta]) => meta.group === group)
                          .map(([key, meta]) => {
                            const k = key as PermissionKey;
                            const checked = (active.enabledModules || []).includes(k);

                            return (
                              <label
                                key={k}
                                style={{
                                  display: "flex",
                                  gap: 10,
                                  alignItems: "flex-start",
                                  padding: "10px 12px",
                                  border: "1px solid rgba(148,163,184,.2)",
                                  borderRadius: 12,
                                }}
                              >
                                {canManageUsers ? (
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => toggleModule(k)}
                                    style={{ marginTop: 3 }}
                                    disabled={Boolean(saving)}
                                  />
                                ) : (
                                  <span className="hint" style={{ width: 20 }}>
                                    {checked ? "✅" : "—"}
                                  </span>
                                )}

                                <div>
                                  <div style={{ fontWeight: 500 }}>{meta.label}</div>
                                  <div className="hint">{meta.description}</div>
                                </div>
                              </label>
                            );
                          })}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="hint">Not: ADMIN rolü tüm yetkilere sahiptir.</div>
              </div>
            )}
          </Card>
        </div>

        <ConfirmDialog
          open={confirmOpen}
          title="Kullanıcıyı Sil"
          message={
            active
              ? `${active.email} kullanıcısı silinsin mi?\n\nBu işlem geri alınamaz.`
              : "Kullanıcı seçili değil."
          }
          confirmText="Sil"
          cancelText="Vazgeç"
          danger
          disabled={saving}
          onClose={() => setConfirmOpen(false)}
          onConfirm={confirmRemoveActiveUser}
        />
      </Page>
    </AppShell>
  );
}
