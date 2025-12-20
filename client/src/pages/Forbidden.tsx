import AppShell from "../components/Shell/AppShell";
import Page from "../ui/Page";
import Card from "../ui/Card";

export default function Forbidden() {
  return (
    <AppShell title="Erişim Yok" active="dashboard">
      <Page title="403 - Erişim Yok" subtitle="Bu sayfayı görüntüleme yetkin yok.">
        <Card title="Ne yapabilirsin?" subtitle="Admin veya Manager yetkisi gerekli olabilir.">
          <div style={{ color: "var(--muted)", lineHeight: 1.7 }}>
            - Rol/Modül yetkilerini kontrol et<br />
            - Admin’den erişim iste<br />
            - Yanlış kullanıcıyla giriş yaptıysan çıkış yap
          </div>
        </Card>
      </Page>
    </AppShell>
  );
}
