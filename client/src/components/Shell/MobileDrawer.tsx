import SidebarNav from "./Sidebar";
import type { NavKey } from "./Sidebar";


export default function MobileDrawer({
  open,
  onClose,
  active,   
}: {
  open: boolean;
  onClose: () => void;
  active?: NavKey;
}) {
  if (!open) return null;

  return (
    <div className="drawerOverlay" onClick={onClose}>
      <div className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawerTop">
          <div style={{ fontWeight: 900 }}>Menü</div>
          <button className="iconBtn" onClick={onClose} aria-label="Menüyü kapat">
            ✕
          </button>
        </div>

        {/* Sidebar içeriği */}
        <SidebarNav active={active} />
      </div>
    </div>
  );
}
