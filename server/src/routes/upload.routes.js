const express = require("express");
const path = require("path");
const fs = require("fs");
const fsPromises = require("fs/promises");
const multer = require("multer");

// Middleware'ler
const auth = require("../middlewares/auth");
const permit = require("../middlewares/permit");

const router = express.Router();

// --- DİZİN YAPILANDIRMASI ---
const UPLOADS_DIR = path.join(process.cwd(), "uploads");
const IMAGES_DIR = path.join(UPLOADS_DIR, "images");
const COMPANY_LOGO_DIR = path.join(UPLOADS_DIR, "company-logos");
const PDF_DIR = path.join(UPLOADS_DIR, "pdfs");

// Gerekli klasörlerin varlığından emin olalım
[IMAGES_DIR, COMPANY_LOGO_DIR, PDF_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// --- MULTER YAPILANDIRMASI (Resimler İçin) ---
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, IMAGES_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "");
    const name = `${Date.now()}-${Math.random().toString(16).slice(2)}${ext}`;
    cb(null, name);
  },
});

const upload = multer({ storage });

const logoStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, COMPANY_LOGO_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "");
    const name = `${Date.now()}-${Math.random().toString(16).slice(2)}${ext}`;
    cb(null, name);
  },
});

const uploadLogo = multer({ storage: logoStorage });

// --- YARDIMCI FONKSİYONLAR ---
async function safeCountFiles(dir, exts) {
  try {
    const items = await fsPromises.readdir(dir, { withFileTypes: true });
    return items.filter(
      (x) => x.isFile() && exts.includes(path.extname(x.name).toLowerCase())
    ).length;
  } catch {
    return 0;
  }
}

async function safeDeleteFiles(dir, exts) {
  try {
    const items = await fsPromises.readdir(dir, { withFileTypes: true });
    const filesToDelete = items.filter(
      (x) => x.isFile() && exts.includes(path.extname(x.name).toLowerCase())
    );

    let deleted = 0;
    for (const file of filesToDelete) {
      try {
        await fsPromises.unlink(path.join(dir, file.name));
        deleted++;
      } catch (err) {
        console.error(`Dosya silinemedi: ${file.name}`, err);
      }
    }
    return deleted;
  } catch {
    return 0;
  }
}

// --- ROUTER / ENDPOINTS ---

/**
 * 1) Resim Yükleme
 * POST /api/uploads/image  (mount'a göre değişir)
 */
router.post("/image", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: "Dosya bulunamadı." });
  return res.json({ url: `/uploads/images/${req.file.filename}` });
});

/**
 * 1b) Logo Yükleme
 * POST /api/upload/logo
 */
router.post("/logo", uploadLogo.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: "Dosya bulunamadı." });
  return res.json({ url: `/uploads/company-logos/${req.file.filename}` });
});

/**
 * 2) İstatistikler
 * GET /api/uploads/stats
 */
router.get("/stats", async (_req, res) => {
  const imageExts = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp", ".heic"];
  const pdfExts = [".pdf"];

  const imageCount = await safeCountFiles(IMAGES_DIR, imageExts);
  const pdfCount = await safeCountFiles(PDF_DIR, pdfExts);

  res.json({
    imageCount,
    pdfCount,
    total: imageCount + pdfCount,
  });
});

/**
 * 3) Temizleme
 * DELETE /api/uploads/purge
 */
router.delete("/purge", auth, permit("forms.builder"), async (_req, res) => {
  const imageExts = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".heic"];
  const pdfExts = [".pdf"];

  const deletedImages = await safeDeleteFiles(IMAGES_DIR, imageExts);
  const deletedPdfs = await safeDeleteFiles(PDF_DIR, pdfExts);

  res.json({
    ok: true,
    deletedImages,
    deletedPdfs,
    totalDeleted: deletedImages + deletedPdfs,
  });
});

module.exports = router;
