// server/src/routes/forms.routes.js
const router = require("express").Router();
const auth = require("../middlewares/auth");
const permit = require("../middlewares/permit");
const FormTemplate = require("../models/FormTemplate");

// küçük yardımcılar
function normalizeFieldsOrder(fields) {
  return (fields || []).map((f, idx) => ({ ...f, order: idx + 1 }));
}
function maxOrder(fields) {
  return Math.max(0, ...(fields || []).map((x) => (typeof x.order === "number" ? x.order : 0)));
}

// ✅ Form oluştur
router.post("/", auth, permit("forms.builder"), async (req, res) => {
  try {
    const name = String(req.body?.name || "").trim();
    const description = String(req.body?.description || "").trim();

    if (!name) return res.status(400).json({ message: "Form adı zorunlu." });

    const doc = await FormTemplate.create({
      name,
      description: description || "",
      fields: [],        // başlangıç boş
      recipients: [],    // başlangıç boş
    });

    res.json(doc);
  } catch (e) {
    console.error("POST /forms error", e);
    res.status(500).json({ message: "Form oluşturulamadı." });
  }
});


// ✅ Alan ekle (order artık UI’dan gelmez)
router.post("/:id/fields", auth, permit("forms.builder"), async (req, res) => {
  const { id } = req.params;
  const { key, label, type, required, min, max, options, defaultValue } = req.body || {};

  const k = String(key || "").trim();
  if (!k) return res.status(400).json({ message: "Alan key zorunlu." });
  if (k.includes(".")) return res.status(400).json({ message: "Alan key '.' içeremez." });

  const tpl = await FormTemplate.findById(id).lean();
  if (!tpl) return res.status(404).json({ message: "Form bulunamadı." });

  const exists = (tpl.fields || []).some((f) => f.key === k);
  if (exists) return res.status(409).json({ message: "Bu key zaten var." });

  const nextOrder = maxOrder(tpl.fields) + 1;

  const newField = {
    key: k,
    label: String(label || "").trim() || k,
    type,
    required: Boolean(required),
    order: nextOrder,
    min: min ?? undefined,
    max: max ?? undefined,
    options: Array.isArray(options) ? options : [],
    defaultValue: defaultValue ?? undefined,
  };

  // atomic update → version çakışması daha az
  const updated = await FormTemplate.findByIdAndUpdate(
    id,
    { $push: { fields: newField } },
    { new: true, runValidators: true }
  ).lean();

  res.json(updated);
});


router.get("/", auth, permit("forms.view"), async (req, res) => {
  const rows = await FormTemplate.find().sort({ createdAt: -1 }).lean();
  res.json(rows);
});

// detail
router.get("/:id", auth, permit("forms.view"), async (req, res) => {
  const doc = await FormTemplate.findById(req.params.id).lean();
  if (!doc) return res.status(404).json({ message: "Not found" });
  res.json(doc);
});

router.patch("/:id",  auth, permit("forms.builder"), async (req, res) => {
  const doc = await FormTemplate.findById(req.params.id);
  if (!doc) return res.status(404).json({ message: "Form not found" });

  if (req.body.name !== undefined) doc.name = req.body.name;
  if (req.body.description !== undefined) doc.description = req.body.description;

  await doc.save();
  res.json(doc);
});


// ✅ Drag&drop reorder: keys sırası gelir → fields yeniden dizilir → order 1..N
router.patch("/:id/fields/reorder", auth, permit("forms.builder"), async (req, res) => {
  const { id } = req.params;
  const { keys } = req.body || {};

  if (!Array.isArray(keys) || keys.length === 0) {
    return res.status(400).json({ message: "keys listesi zorunlu." });
  }

  const tpl = await FormTemplate.findById(id).lean();
  if (!tpl) return res.status(404).json({ message: "Form bulunamadı." });

  const byKey = new Map((tpl.fields || []).map((f) => [f.key, f]));
  const reordered = [];

  // sadece mevcut alanlar
  for (const k of keys) {
    const f = byKey.get(String(k));
    if (f) reordered.push(f);
  }

  // keys içinde olmayan ama DB’de olan alanlar → sona ekle (kaybolmasın)
  for (const f of tpl.fields || []) {
    if (!keys.includes(f.key)) reordered.push(f);
  }

  const normalized = normalizeFieldsOrder(reordered);

  const updated = await FormTemplate.findByIdAndUpdate(
    id,
    { $set: { fields: normalized } },
    { new: true, runValidators: true }
  ).lean();

  res.json(updated);
});

// ✅ Alan güncelle (label, type, required, vs)
router.patch("/:id/fields/:key", auth, permit("forms.builder"), async (req, res) => {
  const { id, key } = req.params;
  const payload = req.body || {};

  const tpl = await FormTemplate.findById(id);
  if (!tpl) return res.status(404).json({ message: "Form bulunamadı." });

  const field = tpl.fields.find((f) => f.key === key);
  if (!field) return res.status(404).json({ message: "Alan bulunamadı." });

  // izin verilen alanlar
  const allowed = [
    "label",
    "type",
    "required",
    "min",
    "max",
    "options",
    "defaultValue",
  ];

  for (const k of allowed) {
    if (payload[k] !== undefined) {
      field[k] = payload[k];
    }
  }

  await tpl.save();
  res.json(tpl);
});

// ✅ Recipient ekle
router.post("/:id/recipients", auth, permit("forms.builder"), async (req, res) => {
  const { id } = req.params;
  const emailRaw = req.body?.email;

  const email = String(emailRaw || "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return res.status(400).json({ message: "Geçerli bir email gir." });
  }

  const tpl = await FormTemplate.findById(id);
  if (!tpl) return res.status(404).json({ message: "Form bulunamadı." });

  const exists = (tpl.recipients || []).some((r) => String(r.email).toLowerCase() === email);
  if (exists) return res.status(409).json({ message: "Bu email zaten ekli." });

  tpl.recipients = tpl.recipients || [];
  tpl.recipients.push({ email });

  await tpl.save();
  res.json(tpl);
});

// ✅ Recipient sil
router.delete("/:id/recipients/:email", auth, permit("forms.builder"), async (req, res) => {
  const { id } = req.params;
  const email = decodeURIComponent(String(req.params.email || "")).trim().toLowerCase();

  const tpl = await FormTemplate.findById(id);
  if (!tpl) return res.status(404).json({ message: "Form bulunamadı." });

  const before = (tpl.recipients || []).length;
  tpl.recipients = (tpl.recipients || []).filter((r) => String(r.email).toLowerCase() !== email);

  if ((tpl.recipients || []).length === before) {
    return res.status(404).json({ message: "Email bulunamadı." });
  }

  await tpl.save();
  res.json(tpl);
});

// ✅ Alan sil
router.delete("/:id/fields/:key", auth, permit("forms.builder"), async (req, res) => {
  const { id } = req.params;
  const key = decodeURIComponent(req.params.key || "").trim();

  if (!key) return res.status(400).json({ message: "Field key zorunlu." });

  // atomic delete
  const updated = await FormTemplate.findByIdAndUpdate(
    id,
    { $pull: { fields: { key } } },
    { new: true }
  ).lean();

  if (!updated) return res.status(404).json({ message: "Form bulunamadı." });

  // orderları 1..N normalize etmek istersen:
  const normalized = normalizeFieldsOrder(updated.fields || []);

  // sadece normalize gerekiyorsa tekrar set et:
  const finalDoc = await FormTemplate.findByIdAndUpdate(
    id,
    { $set: { fields: normalized } },
    { new: true, runValidators: true }
  ).lean();

  res.json(finalDoc);
});

// ✅ Form sil
router.delete("/:id", auth, permit("forms.builder"), async (req, res) => {
  const { id } = req.params;

  const deleted = await FormTemplate.findByIdAndDelete(id).lean();
  if (!deleted) return res.status(404).json({ message: "Form bulunamadı." });

  res.json({ ok: true });
});



module.exports = router;
