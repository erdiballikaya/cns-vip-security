import axios from "axios";

const rawBase = import.meta.env.VITE_API_URL;

// Eğer .env yoksa lokal fallback
const baseURL = rawBase ? `${rawBase}/api` : "http://localhost:4000/api";

export const http = axios.create({ baseURL });

http.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");

  // axios v1'de headers bazen undefined gelebilir
  config.headers = config.headers ?? {};

  if (token) {
    (config.headers as any).Authorization = `Bearer ${token}`;
  }

  return config;
});
