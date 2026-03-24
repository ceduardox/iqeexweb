const { pool } = require("../db/pool");
const { verifyAuthToken } = require("../auth/token");
const { getUserAccess, userHasPermission, userHasAnyPermission } = require("../services/rbac");

function sanitizeUser(row) {
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    role: row.role,
    active: row.is_active,
    createdAt: row.created_at,
  };
}

function readAuthHeader(req) {
  const header = req.get("authorization") || "";
  if (!header.toLowerCase().startsWith("bearer ")) {
    return "";
  }

  return header.slice(7).trim();
}

async function requireAuth(req, res, next) {
  try {
    const token = readAuthHeader(req);
    if (!token) {
      return res.status(401).json({ status: "error", message: "Missing auth token" });
    }

    const claims = verifyAuthToken(token);
    const result = await pool.query(
      `
        SELECT id, full_name, email, role, is_active, created_at
        FROM users
        WHERE id = $1
        LIMIT 1
      `,
      [claims.sub]
    );

    if (result.rowCount === 0) {
      return res.status(401).json({ status: "error", message: "Session user not found" });
    }

    const row = result.rows[0];
    if (!row.is_active) {
      return res.status(403).json({ status: "error", message: "Account is inactive" });
    }

    const roleContext = await getUserAccess(row.id, row.role);

    req.auth = claims;
    req.user = {
      ...sanitizeUser(row),
      role: roleContext.primaryRole || row.role,
      primaryRole: roleContext.primaryRole || row.role,
      roles: roleContext.roles,
      permissions: roleContext.permissions,
    };

    return next();
  } catch (error) {
    return res.status(401).json({ status: "error", message: error.message || "Invalid auth token" });
  }
}

function requirePermission(permissionCode) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ status: "error", message: "Missing authenticated user" });
    }

    if (userHasPermission(req.user, permissionCode)) {
      return next();
    }

    return res.status(403).json({
      status: "error",
      message: `Missing permission: ${permissionCode}`,
    });
  };
}

function requireAnyPermission(permissionCodes) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ status: "error", message: "Missing authenticated user" });
    }

    if (userHasAnyPermission(req.user, permissionCodes)) {
      return next();
    }

    return res.status(403).json({
      status: "error",
      message: "Missing required permission",
    });
  };
}

module.exports = {
  requireAuth,
  requirePermission,
  requireAnyPermission,
  sanitizeUser,
};
