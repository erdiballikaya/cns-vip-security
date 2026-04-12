const router = require("express").Router();
const path = require("path");

const auth = require("../middlewares/auth");
const permit = require("../middlewares/permit");

const FormTemplate = require("../models/FormTemplate");
const FormSubmission = require("../models/FormSubmission");
const Site = require("../models/Site");

const { renderPdf } = require("../services/pdf.service");
const { sendFormPdf } = require("../services/mail.service");

function normalizeEmail(s) {
  return String(s || "").trim().toLowerCase();
}

function toDiskPath(webPath) {
  // webPath: /uploads/pdfs/xxx.pdf
  return path.join(process.cwd(), webPath.replace(/^\//, ""));
}

// create draft
router.post("/", auth, permit("forms.use"), async (req, res) => {
  const { templateId, siteId, values } = req.body || {};
  if (!templateId || !siteId) return res.status(400).json({ message: "templateId ve siteId zorunlu." });

  const tpl = await FormTemplate.findById(templateId).lean();
  if (!tpl) return res.status(404).json({ message: "Form bulunamadı." });

  const site = await Site.findById(siteId).lean();
  if (!site) return res.status(404).json({ message: "Site bulunamadı." });

  const sub = await FormSubmission.create({
    templateId,
    siteId,
    values: values && typeof values === "object" ? values : {},
    status: "DRAFT",
    createdBy: req.user.id,
  });

  res.json(sub);
});

router.get("/:id", auth, permit("forms.use"), async (req, res) => {
  const sub = await FormSubmission.findById(req.params.id).lean();
  if (!sub) return res.status(404).json({ message: "Kayıt bulunamadı." });
  res.json(sub);
});

router.patch("/:id", auth, permit("forms.use"), async (req, res) => {
  const sub = await FormSubmission.findById(req.params.id);
  if (!sub) return res.status(404).json({ message: "Kayıt bulunamadı." });

  const { values } = req.body || {};
  if (values && typeof values === "object") sub.values = values;

  await sub.save();
  res.json(sub);
});

// complete + send to template recipients
router.post("/:id/complete-and-send", auth, permit("forms.send"), async (req, res) => {
  try {
    const sub = await FormSubmission.findById(req.params.id);
    if (!sub) return res.status(404).json({ message: "Kayıt bulunamadı." });

    const tpl = await FormTemplate.findById(sub.templateId).lean();
    if (!tpl) return res.status(404).json({ message: "Form bulunamadı." });

    const site = await Site.findById(sub.siteId).lean();
    if (!site) return res.status(404).json({ message: "Site bulunamadı." });

    // ✅ 1) PDF üret + DB’ye kaydet (mailden bağımsız)
    let pdfPath;
    try {
      ({ pdfPath } = await renderPdf(req, { template: tpl, site, submission: sub }));
    } catch (e) {
      console.error("complete-and-send pdf render error", e);
      return res.status(500).json({ message: "PDF üretimi başarısız oldu." });
    }
    sub.pdfPath = pdfPath;
    sub.status = "COMPLETED";
    await sub.save(); // ✅ artık PDF kesin kaydolur

    const recipients = (site.notificationRecipients || [])
      .map((r) => normalizeEmail(r.email))
      .filter(Boolean);

    // ✅ 2) recipients boşsa 400 dönme, PDF hazır zaten
    if (!recipients.length) {
      return res.json({
        ok: true,
        pdfPath: sub.pdfPath,
        mailOk: false,
        message: "PDF üretildi ama seçili site için mail alıcısı tanımlı olmadığı için mail gönderilmedi.",
        mailLog: sub.mailLog,
      });
    }

    const pdfAbs = toDiskPath(sub.pdfPath);

    // ✅ 3) mail gönderim hatalarını logla ama PDF’yi bozma
    let anyFail = false;

    for (const to of recipients) {
      try {
        await sendFormPdf({
          to,
          subject: `${tpl.name} — ${site.name || "Site"}`,
          text: "Form PDF ektedir.",
          pdfAbsPath: pdfAbs,
        });
        sub.mailLog.push({ to, ok: true, at: new Date() });
      } catch (e) {
        anyFail = true;
        sub.mailLog.push({ to, ok: false, at: new Date(), error: String(e?.message || e) });
      }
    }

    await sub.save();

    return res.json({
      ok: true,
      pdfPath: sub.pdfPath,
      mailOk: !anyFail,
      mailLog: sub.mailLog,
      message: anyFail ? "PDF üretildi, bazı mailler gönderilemedi." : "PDF üretildi, mailler gönderildi.",
    });
  } catch (e) {
    console.error("POST /form-submissions/:id/complete-and-send error", e);
    return res.status(500).json({ message: "PDF veya mail işlemi sırasında sunucu hatası oluştu." });
  }
});


// send to one person
router.post("/:id/send", auth, permit("forms.send"), async (req, res) => {
  try {
    const sub = await FormSubmission.findById(req.params.id);
    if (!sub) return res.status(404).json({ message: "Kayıt bulunamadı." });

    const tpl = await FormTemplate.findById(sub.templateId).lean();
    const site = await Site.findById(sub.siteId).lean();
    if (!tpl || !site) return res.status(400).json({ message: "Form/Site bulunamadı." });

    const to = normalizeEmail(req.body?.to);
    if (!to || !to.includes("@")) return res.status(400).json({ message: "Email geçersiz." });

    // pdf yoksa üret
    if (!sub.pdfPath) {
      try {
        const { pdfPath } = await renderPdf(req, { template: tpl, site, submission: sub });
        sub.pdfPath = pdfPath;
      } catch (e) {
        console.error("single-send pdf render error", e);
        return res.status(500).json({ message: "PDF üretimi başarısız oldu." });
      }
    }

    const pdfAbs = toDiskPath(sub.pdfPath);

    await sendFormPdf({
      to,
      subject: `${tpl.name} — ${site.name || "Site"}`,
      text: "Form PDF ektedir.",
      pdfAbsPath: pdfAbs,
    });
    sub.mailLog.push({ to, ok: true, at: new Date() });
    await sub.save();
    res.json({ ok: true });
  } catch (e) {
    console.error("single-send mail error", e);
    const sub = await FormSubmission.findById(req.params.id).catch(() => null);
    const to = normalizeEmail(req.body?.to);
    if (sub && to) {
      sub.mailLog.push({ to, ok: false, at: new Date(), error: String(e?.message || e) });
      await sub.save().catch(() => null);
    }
    return res.status(500).json({ message: "Mail gönderilemedi" });
  }
});

// PUT /api/form-submissions/:id
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const { values } = req.body;

  const sub = await FormSubmission.findByIdAndUpdate(
    id,
    { $set: { values: values || {} } },
    { new: true }
  );

  res.json(sub);
});


router.get("/", async (req, res) => {
  try {
    const { templateId, status, siteId, limit } = req.query;

    const filter = {};
    if (templateId) filter.templateId = templateId;
    if (status) filter.status = status;      // örn: DRAFT / COMPLETED
    if (siteId) filter.siteId = siteId;

    const lim = Math.min(Number(limit || 50), 200);

    const rows = await FormSubmission.find(filter)
      .sort({ updatedAt: -1 })
      .limit(lim)
      .populate("siteId", "name address")          // Site model ref doğruysa
      .populate("templateId", "name")              // Template model ref doğruysa
      .lean();

    // lite dto
    const data = rows.map((x) => ({
      _id: x._id,
      status: x.status,
      site: x.siteId ? { _id: x.siteId._id, name: x.siteId.name, address: x.siteId.address } : null,
      template: x.templateId ? { _id: x.templateId._id, name: x.templateId.name } : null,
      pdfPath: x.pdfPath || null,
      mailLogCount: (x.mailLog || []).length,
      createdAt: x.createdAt,
      updatedAt: x.updatedAt,
    }));

    res.json(data);
  } catch (e) {
    console.error("GET /form-submissions error", e);
    res.status(500).json({ message: "Submissions listelenemedi." });
  }
});

// DELETE /api/form-submissions/:id  (draft sil)
router.delete("/:id", async (req, res) => {
  try {
    const id = req.params.id;

    const sub = await FormSubmission.findById(id);
    if (!sub) return res.status(404).json({ message: "Kayıt bulunamadı" });

    // İstersen: sadece DRAFT silinebilir kuralı
    // if (String(sub.status).toUpperCase() !== "DRAFT") {
    //   return res.status(400).json({ message: "Sadece taslak silinebilir" });
    // }

    await FormSubmission.deleteOne({ _id: id });
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ message: "Silme başarısız" });
  }
});

// ✅ PDF üret (mail yok)
// POST /api/form-submissions/:id/pdf
router.post("/:id/pdf", auth, permit("forms.send"), async (req, res) => {
  try {
    const id = req.params.id;

    // 1) submission'ı bul
    const sub = await FormSubmission.findById(id);
    if (!sub) return res.status(404).json({ message: "Kayıt bulunamadı." });

    // 2) PDF üret (sende hazır olan fonksiyonu çağır)
    // Örn: const pdfPath = await generatePdfForSubmission(sub._id);
    const pdfPath = await renderPdf(sub._id); // ✅ bunu sende hazır olana göre değiştir

    // 3) sub.pdfPath yaz, status değiştirmek istemiyorsan sadece pdfPath set et
    sub.pdfPath = pdfPath; // örn "/uploads/pdfs/xxx.pdf"
    await sub.save();

    return res.json({ ok: true, pdfPath: sub.pdfPath });
  } catch (e) {
    console.error("PDF GENERATE ERROR:", e);
    return res.status(500).json({ message: "PDF üretilemedi." });
  }
});



module.exports = router;
