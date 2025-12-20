const jwt = require("jsonwebtoken");

module.exports = function auth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;

    if (!token) return res.status(401).json({ message: "Unauthorized" });

    const secret = process.env.JWT_SECRET;
    if (!secret) return res.status(500).json({ message: "JWT_SECRET is missing" });

    const payload = jwt.verify(token, secret);

    req.user = {
      id: payload.id,
      role: payload.role,
      enabledModules: payload.enabledModules ?? [],
    };

    return next();
  } catch (err) {
    return res.status(401).json({ message: "Unauthorized" });
  }
};
