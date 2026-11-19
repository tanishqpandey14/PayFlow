export function authorizeRole(...allowedRoles) {
  return (req, res, next) => {
    // Authentication must happen first.
    if (!req.user) {
      return res.status(401).json({
        error: "Authentication is required",
      });
    }

    // Check whether the user's role is allowed.
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: "You do not have permission to access this resource",
      });
    }

    next();
  };
}