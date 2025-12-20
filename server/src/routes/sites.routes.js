const router = require("express").Router();
const auth = require("../middlewares/auth");
const permit = require("../middlewares/permit");
const Site = require("../models/Site");

// list
router.get("/", auth, permit("sites.view"), async (_req, res) => {
  const sites = await Site.find().sort({ createdAt: -1 }).lean();
  res.json(sites);
});

// detail
router.get("/:id", auth, permit("sites.view"), async (req, res) => {
  const s = await Site.findById(req.params.id).lean();
  if (!s) return res.status(404).json({ message: "Not found" });
  res.json(s);
});

// create
router.post("/", auth, permit("sites.create"), async (req, res) => {
  const { name, address, dynamic } = req.body || {};
  if (!String(name || "").trim()) {
    return res.status(400).json({ message: "Site adı zorunlu." });
  }

  const doc = await Site.create({
    name: String(name).trim(),
    address: String(address || "").trim(),
    dynamic: dynamic ?? {},
    createdBy: req.user?.id,
  });

  res.json(doc);
});

// update (PUT)
router.put("/:id", auth, permit("sites.edit"), async (req, res) => {
  const updated = await Site.findByIdAndUpdate(req.params.id, req.body, { new: true }).lean();
  if (!updated) return res.status(404).json({ message: "Not found" });
  res.json(updated);
});

// update (PATCH) - optional
router.patch("/:id", auth, permit("sites.edit"), async (req, res) => {
  const updated = await Site.findByIdAndUpdate(req.params.id, req.body, { new: true }).lean();
  if (!updated) return res.status(404).json({ message: "Site bulunamadı." });
  res.json(updated);
});

// delete
router.delete("/:id", auth, permit("sites.delete"), async (req, res) => {
  const deleted = await Site.findByIdAndDelete(req.params.id).lean();
  if (!deleted) return res.status(404).json({ message: "Not found" });
  res.json({ ok: true });
});

module.exports = router;
