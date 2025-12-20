const router = require("express").Router();
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const auth = require("../middlewares/auth");
  const mongoose = require("mongoose");
const signToken = (user) => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is missing");
  return jwt.sign(
    { id: user._id.toString(), role: user.role, enabledModules: user.enabledModules ?? [] },
    secret,
    { expiresIn: "7d" }
  );
};



router.post("/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ message: "Email ve şifre zorunlu." });

  const user = await User.findOne({ email: String(email).toLowerCase().trim() });
  console.log("[REQ]", req.method, req.originalUrl);
  console.log("[USER]", user);
  console.log("[ALL]", email, password);

    mongoose.connection.on('error', (err) => {
    console.log('Mongoose bağlantı hatası: ' + err);
  });
  // Alternatif olarak anlık durum takibi:
  mongoose.connection.on('connected', () => {
    console.log('Mongoose bağlandı.');
  });


  if (!user || user.password !== password) return res.status(401).json({ message: "Email veya şifre hatalı." });

  const token = signToken(user);
  return res.json({
    token,
    user: { id: user._id, email: user.email, role: user.role, enabledModules: user.enabledModules || [] },
  });
});

router.get("/me", auth, async (req, res) => {
  const user = await User.findById(req.user.id).select("email role enabledModules").lean();
  if (!user) return res.status(401).json({ message: "Unauthorized" });

  return res.json({
    _id: user._id,
    email: user.email,
    role: user.role,
    enabledModules: user.enabledModules ?? [],
  });
});



module.exports = router;
