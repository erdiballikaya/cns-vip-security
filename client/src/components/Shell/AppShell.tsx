import React, { useState } from "react";
import SidebarNav from "./Sidebar";
import type { NavKey } from "./Sidebar";
import MobileDrawer from "./MobileDrawer";
import { useAuth } from "../../auth/AuthContext"; // gerekirse path'i düzelt

export default function AppShell({
  title,
  active,
  children,
}: {
  title: string;
  active?: NavKey;
  children: React.ReactNode;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  const { me, logout } = useAuth();

  const displayName = me?.email ? me.email : "Kullanıcı";

  const onLogout = () => {
    logout(); // token temizler
    window.location.href = "/login";
  };

  return (
    <div className="appShell">
      {/* Header */}
      <header className="appHeader">
        <div className="headerLeft">
          <button
            className="iconBtn menuBtn"
            onClick={() => setDrawerOpen(true)}
            aria-label="Menüyü aç"
          >
            ☰
          </button>

          <div className="brand">
            <div className="brandMark" />
            <div className="brandText">
              <div className="brandName">CNS VIP Güvenlik</div>
              <div className="brandSub">Operasyon Paneli</div>
            </div>
          </div>

          <div className="pageTitle">/ {title}</div>
        </div>

        <div className="headerRight">
          <div style={{ color: "var(--muted)", fontSize: 13 }}>
            Hoş geldin, <span style={{ color: "var(--text)", fontWeight: 600 }}>{displayName}</span>
          </div>
          <button className="btn" onClick={onLogout}>
            Çıkış
          </button>
        </div>
      </header>

      {/* Body */}
      <div className="appBody">
        <aside className="sidebar">
          <SidebarNav active={active} />
        </aside>

        <div className="appMain">
          <div className="container container--fluid">{children}</div>
        </div>

      </div>

      {/* Footer */}
      <footer className="appFooter">
        <div>© {new Date().getFullYear()} CNS VIP Güvenlik</div>
        <div>v0.1 · Panel</div>
      </footer>

      {/* Mobile Drawer */}
      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} active={active} />
    </div>
  );
}
