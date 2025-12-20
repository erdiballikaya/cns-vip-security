import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import Login from "../pages/Login";
import Forbidden from "../pages/Forbidden";
import Dashboard from "../pages/Dashboard";

import Sites from "../pages/Sites";
import SiteCreate from "../pages/SiteCreate";
import SiteDetail from "../pages/SiteDetail";

import Users from "../pages/Users";

import Forms from "../pages/Forms";
import FormDetail from "../pages/FormDetail";
import FormFill from "../pages/FormFill";

import { ProtectedRoute } from "../routes/ProtectedRoute";

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/403" element={<Forbidden />} />

        {/* Ana dashboard */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />

        {/* Siteler */}
        <Route
          path="/sites"
          element={
            <ProtectedRoute moduleKey="sites.view">
              <Sites />
            </ProtectedRoute>
          }
        />

        {/* ✅ Statik route önce */}
        <Route
          path="/sites/create"
          element={
            <ProtectedRoute moduleKey="sites.create">
              <SiteCreate />
            </ProtectedRoute>
          }
        />

        {/* ✅ Param route sonra */}
        <Route
          path="/sites/:id"
          element={
            <ProtectedRoute moduleKey="sites.view">
              <SiteDetail />
            </ProtectedRoute>
          }
        />

        {/* Forms */}
        <Route
          path="/forms"
          element={
            <ProtectedRoute moduleKey="forms.view">
              <Forms />
            </ProtectedRoute>
          }
        />

        {/* ✅ fill route, /forms/:id'den önce olmalı */}
        <Route
          path="/forms/fill/:submissionId"
          element={
            <ProtectedRoute moduleKey="forms.use">
              <FormFill />
            </ProtectedRoute>
          }
        />

        {/* ✅ Param route en sona */}
        <Route
          path="/forms/:id"
          element={
            <ProtectedRoute moduleKey="forms.view">
              <FormDetail />
            </ProtectedRoute>
          }
        />

        <Route
          path="/users"
          element={
            <ProtectedRoute moduleKey="users.view">
              <Users />
            </ProtectedRoute>
          }
        />

        {/* fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
