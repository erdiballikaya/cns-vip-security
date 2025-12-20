const router = require("express").Router();
const auth = require("../middlewares/auth");
const permit = require("../middlewares/permit");
const PageSchema = require("../models/PageSchema");

router.use((req, _res, next) => {
  console.log("[PAGES]", req.method, req.originalUrl);
  next();
});

function normalizeKey(key) {
  return String(key || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

function normalizePageKey(k) {
  return String(k || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-_]/g, "");
}

// GET /api/pages/:pageKey  -> şema getir (yoksa otomatik oluşturur)
router.get("/:pageKey", auth, permit("forms.view"), async (req, res) => {
  const pageKey = normalizePageKey(req.params.pageKey);

  let doc = await PageSchema.findOne({ pageKey }).lean();
  if (!doc) {
    doc = await PageSchema.create({
      pageKey,
      title: pageKey,
      fields: [],
      createdBy: req.user?.id,
    });
    doc = doc.toObject();
  }

  // frontend beklediği format:
  res.json({
    pageKey: doc.pageKey,
    title: doc.title || doc.pageKey,
    fields: (doc.fields || []).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
  });
});

// PATCH /api/pages/:pageKey  -> title değiştir (opsiyonel)
router.patch("/:pageKey", auth, permit("forms.builder"), async (req, res) => {
  const pageKey = normalizePageKey(req.params.pageKey);
  const { title } = req.body || {};

  const doc = await PageSchema.findOne({ pageKey });
  if (!doc) return res.status(404).json({ message: "Page schema bulunamadı." });

  if (title !== undefined) doc.title = String(title || "").trim();
  await doc.save();

  res.json({
    pageKey: doc.pageKey,
    title: doc.title || doc.pageKey,
    fields: (doc.fields || []).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
  });
});

// POST /api/pages/:pageKey/fields  -> alan ekle
router.post("/:pageKey/fields", auth, permit("forms.builder"), async (req, res) => {
  const pageKey = normalizePageKey(req.params.pageKey);
  const body = req.body || {};

  const key = normalizeKey(body.key);
  const label = String(body.label || "").trim();
  const type = body.type;

  if (!key) return res.status(400).json({ message: "Key zorunlu." });
  if (!label) return res.status(400).json({ message: "Label zorunlu." });
  if (!["text", "number", "boolean", "select", "image"].includes(type))
    return res.status(400).json({ message: "Tip geçersiz." });

  const doc = await PageSchema.findOne({ pageKey });
  if (!doc) return res.status(404).json({ message: "Page schema bulunamadı." });

  if ((doc.fields || []).some((f) => f.key === key))
    return res.status(409).json({ message: "Bu key zaten var." });

  const field = {
    key,
    label,
    type,
    required: Boolean(body.required),
    order: Number(body.order ?? 0),
    min: body.min,
    max: body.max,
    options: body.options || [],
    defaultValue: body.defaultValue,
  };

  doc.fields.push(field);
  doc.fields.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  await doc.save();

  res.json({
    pageKey: doc.pageKey,
    title: doc.title || doc.pageKey,
    fields: (doc.fields || []).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
  });
});

// PUT /api/pages/:pageKey/fields/:fieldKey  -> alan güncelle
router.put("/:pageKey/fields/:fieldKey", auth, permit("forms.builder"), async (req, res) => {
  const pageKey = normalizePageKey(req.params.pageKey);
  const fieldKey = normalizeKey(req.params.fieldKey);
  const patch = req.body || {};

  const doc = await PageSchema.findOne({ pageKey });
  if (!doc) return res.status(404).json({ message: "Page schema bulunamadı." });

  const idx = (doc.fields || []).findIndex((f) => f.key === fieldKey);
  if (idx < 0) return res.status(404).json({ message: "Alan bulunamadı." });

  // key değişimini engelle
  if (patch.key && normalizeKey(patch.key) !== fieldKey) {
    return res.status(400).json({ message: "Key değişimi desteklenmiyor." });
  }

  const current = doc.fields[idx].toObject?.() ?? doc.fields[idx];
  doc.fields[idx] = { ...current, ...patch, key: fieldKey };

  doc.fields.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  await doc.save();

  res.json({
    pageKey: doc.pageKey,
    title: doc.title || doc.pageKey,
    fields: (doc.fields || []).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
  });
});

// DELETE /api/pages/:pageKey/fields/:fieldKey  -> alan sil
router.delete("/:pageKey/fields/:fieldKey", auth, permit("forms.builder"), async (req, res) => {
  const pageKey = normalizePageKey(req.params.pageKey);
  const fieldKey = normalizeKey(req.params.fieldKey);

  const doc = await PageSchema.findOne({ pageKey });
  if (!doc) return res.status(404).json({ message: "Page schema bulunamadı." });

  doc.fields = (doc.fields || []).filter((f) => f.key !== fieldKey);
  await doc.save();

  res.json({
    pageKey: doc.pageKey,
    title: doc.title || doc.pageKey,
    fields: (doc.fields || []).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
  });
});

module.exports = router;
