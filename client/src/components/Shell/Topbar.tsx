import React from "react";
import Button from "../Button";

export default function Topbar({ title }: { title: string }) {
  const logout = () => {
    localStorage.removeItem("token");
    window.location.href = "/login";
  };

  return (
    <header className="topbar">
      <div style={{ fontWeight: 900 }}>{title}</div>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <div style={{ color: "var(--muted)", fontSize: 13 }}>Hoş geldin</div>
        <Button onClick={logout}>Çıkış</Button>
      </div>
    </header>
  );
}
