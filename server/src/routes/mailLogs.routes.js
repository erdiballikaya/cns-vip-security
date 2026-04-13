const router = require("express").Router();

const auth = require("../middlewares/auth");
const permit = require("../middlewares/permit");
const MailLog = require("../models/MailLog");
const { MAIL_LOG_RETENTION_DAYS, cleanupExpiredMailLogs } = require("../services/mailLog.service");

router.get("/", auth, permit("forms.send"), async (req, res) => {
  try {
    await cleanupExpiredMailLogs();

    const limit = Math.min(Math.max(Number(req.query.limit || 200), 1), 500);

    const rows = await MailLog.find({})
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return res.json({
      retentionDays: MAIL_LOG_RETENTION_DAYS,
      items: rows,
    });
  } catch (e) {
    console.error("GET /mail-logs error", e);
    return res.status(500).json({ message: "Mail logları alınamadı." });
  }
});

module.exports = router;
