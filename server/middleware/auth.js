const { pool } = require("../db/pool");
const { verifyAuthToken } = require("../auth/token");

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

    req.auth = claims;
    req.user = sanitizeUser(row);
    return next();
  } catch (error) {
    return res.status(401).json({ status: "error", message: error.message || "Invalid auth token" });
  }
}

module.exports = {
  requireAuth,
  sanitizeUser,
};
