const router = require("express").Router();
const auth = require("../middlewares/auth");
const fs = require("fs");
const path = require("path");

const UPLOAD_DIR = path.join(process.cwd(), "uploads", "images");

// Opsiyonel: permit middleware’in varsa ekle
// const permit = require("../middlewares/permit");

// Model isimlerini projene göre ayarla:
const User = require("../models/User");
const Site = require("../models/Site");
// const Audit = require("../models/Audit");
// const Notification = require("../models/Notification");

// GET /api/stats/overview
router.get("/overview", auth, async (req, res) => {
  try {
    // USERS
    const [usersTotal, usersPersonnel] = await Promise.all([
      User.countDocuments({}),
      User.countDocuments({ role: "PERSONNEL" }),
    ]);

    // SITES
    // Not: Sende "aktif/pasif" alanı yoksa total’ı active gibi döndürelim.
    const sitesTotal = await Site.countDocuments({});
    // Eğer Site şemasında isActive gibi bir alan varsa aç:
    // const sitesActive = await Site.countDocuments({ isActive: true });
    const sitesActive = sitesTotal;

    // AUDITS (yoksa 0)
    const todayAudits = 0;
    // Eğer Audit modelin varsa:
    // const start = new Date(); start.setHours(0,0,0,0);
    // const end = new Date(); end.setHours(23,59,59,999);
    // const todayAudits = await Audit.countDocuments({ createdAt: { $gte: start, $lte: end } });

    // NOTIFICATIONS (yoksa 0)
    const openNotifications = 0;
    // Eğer Notification modelin varsa:
    // const openNotifications = await Notification.countDocuments({ status: "OPEN" });

    return res.json({
      sites: { total: sitesTotal, active: sitesActive },
      users: { total: usersTotal, personnel: usersPersonnel },
      audits: { today: todayAudits },
      notifications: { open: openNotifications },
    });
  } catch (err) {
    console.error("stats/overview error:", err);
    return res.status(500).json({ message: "İstatistikler alınamadı." });
  }
});

function countImages() {
  try {
    const files = fs.readdirSync(UPLOAD_DIR).filter((f) => !f.startsWith("."));
    return files.length;
  } catch {
    return 0;
  }
}

// overview endpoint içinde:
uploads: { images: { count: countImages() } }


module.exports = router;
