import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { http } from "../api/http";
import type { Me } from "../types/auth";

type LoginResponse = {
  token: string;
  user?: any; // login response user dönüyorsa sonra kullanırız
};

type MeDto = {
  _id?: string;
  id?: string;
  email: string;
  role: string;
  enabledModules?: string[];
};

type AuthState = {
  token: string | null;
  me: Me | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshMe: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

function mapMe(dto: MeDto): Me {
  return {
    id: dto._id ?? dto.id ?? "",
    email: dto.email,
    role: dto.role as Me["role"], // backend ADMIN/MANAGER/PERSONNEL dönüyor varsayımı
    enabledModules: dto.enabledModules ?? [],
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(localStorage.getItem("token"));
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  const logout = () => {
    localStorage.removeItem("token");
    setToken(null);
    setMe(null);
  };

  const refreshMe = async () => {
    const t = localStorage.getItem("token");
    if (!t) {
      setMe(null);
      return;
    }

    // http interceptor zaten token ekliyor
    const res = await http.get<MeDto>("/auth/me");
    setMe(mapMe(res.data));
  };

  const login = async (email: string, password: string) => {
    const res = await http.post<LoginResponse>("/auth/login", { email, password });
    localStorage.setItem("token", res.data.token);
    setToken(res.data.token);
    await refreshMe();
  };

  useEffect(() => {
    (async () => {
      try {
        await refreshMe();
      } catch {
        logout();
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo<AuthState>(
    () => ({ token, me, loading, login, logout, refreshMe }),
    [token, me, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
