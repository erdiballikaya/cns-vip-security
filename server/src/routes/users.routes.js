// server/src/routes/users.routes.js
const router = require("express").Router();
const auth = require("../middlewares/auth");
const User = require("../models/User");
const permit = require("../middlewares/permit");
console.log("AUTH TYPE:", typeof auth);

function requireAdmin(req, res, next) {
  if (req.user?.role !== "ADMIN") {
    return res.status(403).json({ message: "Forbidden" });
  }
  return next();
}

// GET /api/users  -> users.view
router.get("/", auth, permit("users.view"), async (req, res) => {
  try {
    const users = await User.find()
      .select("email role enabledModules createdAt")
      .sort({ createdAt: -1 });

    return res.json(users);
  } catch (e) {
    return res.status(500).json({ message: "Users alınamadı" });
  }
});

// PATCH /api/users/:id/modules  -> users.manage
router.patch("/:id/modules", auth, permit("users.manage"), async (req, res) => {
  try {
    const { enable = [], disable = [] } = req.body || {};

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const set = new Set(user.enabledModules || []);
    for (const m of enable) set.add(m);
    for (const m of disable) set.delete(m);

    user.enabledModules = Array.from(set);
    await user.save();

    return res.json({ id: user._id, enabledModules: user.enabledModules });
  } catch (e) {
    return res.status(500).json({ message: "Update failed" });
  }
});

// PATCH /api/users/:id/role  -> users.manage
router.patch("/:id/role", auth, permit("users.manage"), async (req, res) => {
  try {
    const { role } = req.body || {};
    if (!role) return res.status(400).json({ message: "role zorunlu" });

    if (!["ADMIN", "MANAGER", "PERSONNEL"].includes(role)) {
      return res.status(400).json({ message: "Geçersiz role" });
    }

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.role = role;
    await user.save();

    return res.json({
      _id: user._id,
      email: user.email,
      role: user.role,
      enabledModules: user.enabledModules ?? [],
      createdAt: user.createdAt,
    });
  } catch (e) {
    return res.status(500).json({ message: "Role update failed" });
  }
});

// PATCH /api/users/:id/modules  (admin)
router.patch("/:id/modules", auth, requireAdmin, async (req, res) => {
  try {
    const { enable = [], disable = [] } = req.body || {};

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const set = new Set(user.enabledModules || []);
    for (const m of enable) set.add(m);
    for (const m of disable) set.delete(m);

    user.enabledModules = Array.from(set);
    await user.save();

    return res.json({ id: user._id, enabledModules: user.enabledModules });
  } catch (e) {
    return res.status(500).json({ message: "Update failed" });
  }
});

router.get("/", auth, requireAdmin, async (req, res) => {
  const users = await User.find().select("email role enabledModules createdAt").sort({ createdAt: -1 });
  return res.json(users);
});

router.patch("/:id/role", auth, requireAdmin, async (req, res) => {
  const { role } = req.body || {};
  const allowed = ["ADMIN", "MANAGER", "PERSONNEL"];
  if (!allowed.includes(role)) return res.status(400).json({ message: "Invalid role" });

  const user = await User.findByIdAndUpdate(
    req.params.id,
    { role },
    { new: true }
  ).select("email role enabledModules createdAt");

  if (!user) return res.status(404).json({ message: "User not found" });
  return res.json(user);
});

// ADMIN: yeni kullanıcı oluştur
router.post("/", auth, requireAdmin, async (req, res) => {
  try {
    const { email, password, role = "PERSONNEL", enabledModules = [] } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ message: "email ve password zorunlu" });
    }

    const normalizedEmail = String(email).toLowerCase().trim();

    const exists = await User.findOne({ email: normalizedEmail }).lean();
    if (exists) return res.status(409).json({ message: "Bu email zaten var" });

    const allowedRoles = ["ADMIN", "MANAGER", "PERSONNEL"];
    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }

    const user = await User.create({
      email: normalizedEmail,
      password: String(password),
      role,
      enabledModules: Array.isArray(enabledModules) ? enabledModules : [],
    });

    return res.status(201).json({
      _id: user._id,
      email: user.email,
      role: user.role,
      enabledModules: user.enabledModules || [],
      createdAt: user.createdAt,
    });
  } catch (e) {
    return res.status(500).json({ message: "User oluşturulamadı" });
  }
});

// DELETE /api/users/:id  -> users.manage
router.delete("/:id", auth, permit("users.manage"), async (req, res) => {
  try {
    // ADMIN de buradan geçer
    if (req.user.id === req.params.id) {
      return res.status(400).json({ message: "Kendi hesabını silemezsin" });
    }

    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ message: "User delete failed" });
  }
});



module.exports = router;
