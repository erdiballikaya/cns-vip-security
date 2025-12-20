// server/src/middlewares/requireModule.js
module.exports = function requireModule(moduleKey) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    // Admin her zaman geçsin
    if (req.user.role === "ADMIN") return next();

    const ok = req.user.enabledModules?.includes(moduleKey);
    if (!ok) return res.status(403).json({ message: "Forbidden", module: moduleKey });

    next();
  };
};