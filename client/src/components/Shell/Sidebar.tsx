export type NavKey = "dashboard" | "sites" | "users" | "forms" | "reports";

function Item({ href, label, active }: { href: string; label: string; active?: boolean }) {
  const cls = `navItem ${active ? "navItemActive" : ""}`.trim();
  return (
    <a className={cls} href={href}>
      <span style={{ width: 10, height: 10, borderRadius: 6, background: active ? "var(--brand)" : "rgba(255,255,255,.25)" }} />
      {label}
    </a>
  );
}

export default function SidebarNav({ active }: { active?: NavKey }) {
  return (
    <nav className="nav">
      <Item href="/" label="Genel Bakış" active={active === "dashboard"} />
      <Item href="/sites" label="Siteler" active={active === "sites"} />
      <Item href="/users" label="Kullanıcılar" active={active === "users"} />
      <Item href="/forms" label="Form Yönetimi" active={active === "forms"} />
      {/* <Item href="/reports" label="Raporlar" active={active === "reports"} /> */}
    </nav>
  );
}
