const router = require("express").Router();
const auth = require("../middlewares/auth");
const permit = require("../middlewares/permit");
const PageSchema = require("../models/PageSchema");

function normalizeKey(key) {
  return String(key || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

// GET /api/page-schemas/:pageKey
router.get("/:pageKey", auth, permit("forms.view"), async (req, res) => {
  const pageKey = String(req.params.pageKey || "").trim();
  if (!pageKey) return res.status(400).json({ message: "pageKey zorunlu" });

  let doc = await PageSchema.findOne({ pageKey }).lean();

  // yoksa otomatik oluştur (site-create ilk açılışta boş gelsin)
  if (!doc) {
    const created = await PageSchema.create({
      pageKey,
      title: pageKey,
      fields: [],
      updatedBy: req.user.id,
    });
    doc = created.toObject();
  }

  res.json(doc);
});

// POST /api/page-schemas/:pageKey/fields
router.post("/:pageKey/fields", auth, permit("forms.builder"), async (req, res) => {
  const pageKey = String(req.params.pageKey || "").trim();
  if (!pageKey) return res.status(400).json({ message: "pageKey zorunlu" });

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

  doc.fields.push({
    key,
    label,
    type,
    required: Boolean(body.required),
    order: Number(body.order ?? 0),
    min: body.min,
    max: body.max,
    options: body.options || [],
    defaultValue: body.defaultValue,
  });

  doc.fields.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  doc.updatedBy = req.user.id;

  await doc.save();
  res.json(doc);
});

// PUT /api/page-schemas/:pageKey/fields/:fieldKey
router.put("/:pageKey/fields/:fieldKey", auth, permit("forms.builder"), async (req, res) => {
  const pageKey = String(req.params.pageKey || "").trim();
  const fieldKey = normalizeKey(req.params.fieldKey);
  const patch = req.body || {};

  const doc = await PageSchema.findOne({ pageKey });
  if (!doc) return res.status(404).json({ message: "Page schema bulunamadı." });

  const idx = (doc.fields || []).findIndex((f) => f.key === fieldKey);
  if (idx < 0) return res.status(404).json({ message: "Alan bulunamadı." });

  if (patch.key && normalizeKey(patch.key) !== fieldKey) {
    return res.status(400).json({ message: "Key değişimi desteklenmiyor." });
  }

  const cur = doc.fields[idx].toObject?.() ?? doc.fields[idx];
  doc.fields[idx] = { ...cur, ...patch, key: fieldKey };

  doc.fields.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  doc.updatedBy = req.user.id;

  await doc.save();
  res.json(doc);
});

// DELETE /api/page-schemas/:pageKey/fields/:fieldKey
router.delete("/:pageKey/fields/:fieldKey", auth, permit("forms.builder"), async (req, res) => {
  const pageKey = String(req.params.pageKey || "").trim();
  const fieldKey = normalizeKey(req.params.fieldKey);

  const doc = await PageSchema.findOne({ pageKey });
  if (!doc) return res.status(404).json({ message: "Page schema bulunamadı." });

  doc.fields = (doc.fields || []).filter((f) => f.key !== fieldKey);
  doc.updatedBy = req.user.id;

  await doc.save();
  res.json(doc);
});

module.exports = router;
