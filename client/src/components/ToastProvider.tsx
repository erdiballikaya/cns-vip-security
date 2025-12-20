import React, { createContext, useContext, useState } from "react";
import Toast, { type ToastType } from "./Toast";

type ToastItem = {
  id: string;
  title?: string;
  message: string;
  type: ToastType;
};

type ToastCtx = {
  success: (message: string, title?: string) => void;
  error: (message: string, title?: string) => void;
  info: (message: string, title?: string) => void;
};

const ToastContext = createContext<ToastCtx | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const remove = (id: string) =>
    setItems((prev) => prev.filter((t) => t.id !== id));

  const push = (type: ToastType, message: string, title?: string) => {
    const id = crypto.randomUUID();
    setItems((prev) => [...prev, { id, type, message, title }]);

    setTimeout(() => remove(id), 3000);
  };

  return (
    <ToastContext.Provider
      value={{
        success: (m, t) => push("success", m, t),
        error: (m, t) => push("error", m, t),
        info: (m, t) => push("info", m, t),
      }}
    >
      {children}

      {/* Toast Layer */}
      <div className="toastViewport">
        {items.map((t) => (
          <Toast
            key={t.id}
            title={t.title}
            message={t.message}
            type={t.type}
            onClose={() => remove(t.id)}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}
