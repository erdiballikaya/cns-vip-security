import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { hasModule } from "../permissions/hasModule";

export function ProtectedRoute({
  children,
  moduleKey,
}: {
  children: React.ReactNode;
  moduleKey?: string;
}) {
  const { token, me, loading } = useAuth();

  if (loading) return <div style={{ padding: 24 }}>Yükleniyor...</div>;
  if (!token) return <Navigate to="/login" replace />;
  if (moduleKey && !hasModule(me, moduleKey)) return <Navigate to="/403" replace />;

  return <>{children}</>;
}
