export type PermissionKey =
  | "users.view"
  | "users.manage"
  | "sites.view"
  | "sites.create"
  | "sites.edit"
  | "sites.delete"
  | "forms.builder"
  | "forms.view"
  | "forms.use"
  | "forms.send"
  | "uploads.manage";

export const PERMISSIONS: Record<
  PermissionKey,
  {
    label: string;
    description: string;
    group: "Kullanıcılar" | "Siteler" | "Formlar";
  }
> = {
  "users.view": {
    label: "Kullanıcıları Görüntüleme",
    description: "Panel kullanıcılarını listeleyebilir ve detaylarını görebilir.",
    group: "Kullanıcılar",
  },
  "users.manage": {
    label: "Kullanıcı Yönetimi",
    description: "Kullanıcı ekleme, rol değiştirme, yetki düzenleme ve kullanıcı silme işlemlerini yapabilir.",
    group: "Kullanıcılar",
  },
  "sites.view": {
    label: "Siteleri Görüntüleme",
    description: "Site listesini ve detaylarını görüntüleyebilir.",
    group: "Siteler",
  },
  "sites.create": {
    label: "Site Ekleme",
    description: "Yeni site oluşturabilir.",
    group: "Siteler",
  },
  "sites.edit": {
    label: "Site Düzenleme",
    description: "Mevcut siteleri düzenleyebilir.",
    group: "Siteler",
  },
  "sites.delete": {
    group: "Siteler",
    label: "Site Silme",
    description: "Siteyi kalıcı olarak silebilir.",
  },
  "forms.view": {
    group: "Formlar",
    label: "Formları Görüntüleme",
    description: "Form şablonlarını listeleyip detayını görebilir.",
  },
  "forms.builder": {
    group: "Formlar",
    label: "Form Oluşturma / Düzenleme",
    description: "Form şablonu oluşturur, alan ekler/siler, mail alıcılarını yönetir.",
  },
  "forms.use": {
    group: "Formlar",
    label: "Form Doldurma",
    description: "Formu site ile eşleştirip doldurabilir (taslak kaydeder).",
  },
  "forms.send": {
    group: "Formlar",
    label: "Form Mail Gönderme",
    description: "PDF üretip mail gönderebilir.",
  },
  "uploads.manage": {
    group: "Formlar",
    label: "Yüklenen Fotoğrafları Temizleme",
    description: "Sunucudaki yüklenen form fotoğraflarını temizleyebilir.",
  },
};
