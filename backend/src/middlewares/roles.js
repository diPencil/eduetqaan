// src/middlewares/roles.js
export function requireRole(...allowed) {
  return (req, res, next) => {
    const role = req.user?.role;
    
    // 🛡️ Staff Super-Access: Any administrative role bypasses role checks
    const isStaff = ['admin', 'supervisor', 'center_manager', 'support'].includes(role);
    if (isStaff) {
      return next();
    }

    if (!role || !allowed.includes(role)) {
      return res.status(403).json({ success: false, message: 'غير مصرح' });
    }
    next();
  };
}
