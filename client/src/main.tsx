import React from "react";
import ReactDOM from "react-dom/client";
import { AuthProvider } from "./auth/AuthContext";
import AppRouter from "./routes/AppRouter";

import { ToastProvider } from "./components/ToastProvider";
import "./styles/toast.css";

import "./styles/tokens.css";
import "./styles/globals.css";
import "./styles/components.css";
import "./styles/layout.css";
import "./styles/pages/site-create.css";
import "./styles/pages/sites.css";
import "./styles/modal.css";


ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ToastProvider>
      <AuthProvider>
        <AppRouter />
      </AuthProvider>
    </ToastProvider>
  </React.StrictMode>
);
