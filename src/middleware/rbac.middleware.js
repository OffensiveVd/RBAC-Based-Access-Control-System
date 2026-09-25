/**
 * RBAC enforcement middleware.
 * req.user.permissions is a flat array of permission names (e.g. "users:delete")
 * computed at login time via the roles -> role_permissions -> permissions chain.
 */

/**
 * requirePermission('users:delete') -> 403 unless the caller's roles grant it.
 */
function requirePermission(...requiredPermissions) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated.' });
    }

    const userPermissions = new Set(req.user.permissions || []);
    const hasAll = requiredPermissions.every((p) => userPermissions.has(p));

    if (!hasAll) {
      return res.status(403).json({
        error: 'Forbidden: insufficient permissions.',
        required: requiredPermissions,
      });
    }

    next();
  };
}

/**
 * requireRole('admin', 'manager') -> allows if the caller has ANY of the listed roles.
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated.' });
    }

    const userRoles = new Set(req.user.roles || []);
    const allowed = allowedRoles.some((r) => userRoles.has(r));

    if (!allowed) {
      return res.status(403).json({
        error: 'Forbidden: role not permitted for this resource.',
        allowedRoles,
      });
    }

    next();
  };
}

module.exports = { requirePermission, requireRole };
