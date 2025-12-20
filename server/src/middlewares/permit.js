module.exports = function permit(permissionKey) {
  return function (req, res, next) {
    // auth middleware req.user dolduruyor varsayımıyla
    const user = req.user;

    if (!user) return res.status(401).json({ message: "Unauthorized" });
    if (user.role === "ADMIN") return next();

    const enabled = user.enabledModules || [];
    if (!enabled.includes(permissionKey)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    return next();
  };
};
