// server/src/app.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const path = require("path");

const authRoutes = require("./routes/auth.routes");
const usersRoutes = require("./routes/users.routes");
const sitesRoutes = require("./routes/sites.routes");
const formsRoutes = require("./routes/forms.routes");
const uploadRoutes = require("./routes/upload.routes");
const statsRoutes = require("./routes/stats.routes");
const formSubmissionsRoutes = require("./routes/formSubmissions.routes");
const mailLogsRoutes = require("./routes/mailLogs.routes");
const pageSchemasRoutes = require("./routes/pageSchemas.routes");
const pagesRoutes = require("./routes/pages.routes");

const app = express();
// server/src/app.js en üste yakın bir yere
app.use((req, _res, next) => {
  if (req.originalUrl.startsWith("/api/forms")) {
    console.log("[REQ]", req.method, req.originalUrl);
  }
  next();
});
app.use(cors());
app.use(express.json());

// Mongo
mongoose
  .connect(process.env.MONGO_URL)
  .then(() => console.log("Mongo connected"))
  .catch((e) => console.error("Mongo error", e));

app.get("/health", (_req, res) => res.json({ ok: true }));

// ✅ Static uploads (tek kez)
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

// ✅ API routes
app.use("/api/auth", authRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/sites", sitesRoutes);
app.use("/api/forms", formsRoutes);
app.use("/api/upload", uploadRoutes);
//app.use("/api/uploads", uploadRoutes);
app.use("/api/stats", statsRoutes);
app.use("/api/form-submissions", formSubmissionsRoutes);
app.use("/api/mail-logs", mailLogsRoutes);
app.use("/api/page-schemas", pageSchemasRoutes);
app.use("/api/pages", pagesRoutes);

app.use((err, req, res, next) => {
  console.error(`[API ERROR] ${req.method} ${req.originalUrl}`, err);
  if (res.headersSent) return next(err);

  if (req.originalUrl.startsWith("/api/")) {
    return res.status(500).json({ message: "Sunucu hatası oluştu." });
  }

  return res.status(500).send("Internal Server Error");
});

// Start
const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`API running on ${port}`));
