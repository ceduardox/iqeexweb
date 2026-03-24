const express = require("express");
const { pool } = require("../db/pool");
const { hashPassword } = require("../auth/password");
const { requireAuth, requirePermission } = require("../middleware/auth");
const { normalizeRoleCode, normalizePermissionCode, setUserRoles, userHasPermission } = require("../services/rbac");

const router = express.Router();
const ALLOWED_PRIMARY_ROLES = new Set(["admin", "teacher", "student"]);

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeName(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function parseBoolean(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value === "boolean") {
    return value;
  }

  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }

  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }

  return null;
}

function parsePrimaryRole(value) {
  const role = normalizeRoleCode(value);
  return ALLOWED_PRIMARY_ROLES.has(role) ? role : null;
}

function parseRoles(values) {
  if (!Array.isArray(values)) {
    return null;
  }

  const normalized = Array.from(
    new Set(
      values
        .map(parsePrimaryRole)
        .filter(Boolean)
    )
  );

  if (normalized.length === 0) {
    return null;
  }

  return normalized;
}

async function fetchUserById(userId) {
  const result = await pool.query(
    `
      SELECT u.id,
             u.full_name,
             u.email,
             u.role,
             u.is_active,
             u.created_at,
             COALESCE(MAX(CASE WHEN ur.is_primary THEN r.code END), u.role) AS primary_role,
             COALESCE(array_remove(array_agg(r.code ORDER BY ur.is_primary DESC, r.code ASC), NULL), '{}') AS roles
      FROM users u
      LEFT JOIN user_roles ur ON ur.user_id = u.id
      LEFT JOIN roles r ON r.id = ur.role_id
      WHERE u.id = $1
      GROUP BY u.id
      LIMIT 1
    `,
    [userId]
  );

  if (result.rowCount === 0) {
    return null;
  }

  const row = result.rows[0];
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    role: row.role,
    primaryRole: row.primary_role || row.role,
    roles: Array.isArray(row.roles) ? row.roles : [],
    active: row.is_active,
    createdAt: row.created_at,
  };
}

router.get("/admin/users", requireAuth, requirePermission("users.read"), async (req, res, next) => {
  try {
    const search = String(req.query.search || "").trim();
    const roleFilter = parsePrimaryRole(req.query.role);
    const activeFilter = parseBoolean(req.query.active);

    const usersResult = await pool.query(
      `
        SELECT u.id,
               u.full_name,
               u.email,
               u.role,
               u.is_active,
               u.created_at,
               COALESCE(MAX(CASE WHEN ur.is_primary THEN r.code END), u.role) AS primary_role,
               COALESCE(array_remove(array_agg(r.code ORDER BY ur.is_primary DESC, r.code ASC), NULL), '{}') AS roles
        FROM users u
        LEFT JOIN user_roles ur ON ur.user_id = u.id
        LEFT JOIN roles r ON r.id = ur.role_id
        WHERE ($1::text = '' OR u.full_name ILIKE ('%' || $1 || '%') OR u.email ILIKE ('%' || $1 || '%'))
          AND (
            $2::text IS NULL
            OR u.role = $2
            OR EXISTS (
              SELECT 1
              FROM user_roles ur2
              INNER JOIN roles r2 ON r2.id = ur2.role_id
              WHERE ur2.user_id = u.id
                AND r2.code = $2
            )
          )
          AND ($3::boolean IS NULL OR u.is_active = $3)
        GROUP BY u.id
        ORDER BY u.created_at DESC
        LIMIT 300
      `,
      [search, roleFilter, activeFilter]
    );

    return res.json({
      status: "ok",
      users: usersResult.rows.map((row) => ({
        id: row.id,
        fullName: row.full_name,
        email: row.email,
        role: row.role,
        primaryRole: row.primary_role || row.role,
        roles: Array.isArray(row.roles) ? row.roles : [],
        active: row.is_active,
        createdAt: row.created_at,
      })),
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/admin/users", requireAuth, requirePermission("users.create"), async (req, res, next) => {
  try {
    const fullName = normalizeName(req.body.fullName);
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || "");
    const primaryRole = parsePrimaryRole(req.body.primaryRole || req.body.role);
    const roleList = parseRoles(req.body.roles);
    const active = parseBoolean(req.body.active ?? req.body.isActive);

    if (fullName.length < 3) {
      return res.status(400).json({ status: "error", message: "Name must contain at least 3 characters" });
    }

    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return res.status(400).json({ status: "error", message: "Invalid email" });
    }

    if (password.length < 8) {
      return res.status(400).json({ status: "error", message: "Password must contain at least 8 characters" });
    }

    if (!primaryRole) {
      return res.status(400).json({ status: "error", message: "Invalid primary role" });
    }

    const existing = await pool.query("SELECT id FROM users WHERE email = $1 LIMIT 1", [email]);
    if (existing.rowCount > 0) {
      return res.status(409).json({ status: "error", message: "Email already registered" });
    }

    const passwordHash = await hashPassword(password);
    const insert = await pool.query(
      `
        INSERT INTO users (full_name, email, password_hash, role, is_active)
        VALUES ($1, $2, $3, $4, COALESCE($5, TRUE))
        RETURNING id
      `,
      [fullName, email, passwordHash, primaryRole, active]
    );

    const userId = Number(insert.rows[0].id);
    const nextRoles = roleList ? Array.from(new Set([primaryRole, ...roleList])) : [primaryRole];
    await setUserRoles(userId, nextRoles, primaryRole);

    const createdUser = await fetchUserById(userId);

    return res.status(201).json({
      status: "ok",
      message: "User created",
      user: createdUser,
    });
  } catch (error) {
    return next(error);
  }
});

router.patch("/admin/users/:userId", requireAuth, requirePermission("users.update"), async (req, res, next) => {
  try {
    const userId = Number(req.params.userId);
    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ status: "error", message: "Invalid user id" });
    }

    const existing = await fetchUserById(userId);
    if (!existing) {
      return res.status(404).json({ status: "error", message: "User not found" });
    }

    const fullName = req.body.fullName !== undefined ? normalizeName(req.body.fullName) : null;
    const primaryRole = req.body.primaryRole !== undefined ? parsePrimaryRole(req.body.primaryRole) : null;
    const roles = req.body.roles !== undefined ? parseRoles(req.body.roles) : null;
    const active = req.body.active !== undefined || req.body.isActive !== undefined ? parseBoolean(req.body.active ?? req.body.isActive) : null;

    if (fullName !== null && fullName.length < 3) {
      return res.status(400).json({ status: "error", message: "Name must contain at least 3 characters" });
    }

    if (req.body.primaryRole !== undefined && !primaryRole) {
      return res.status(400).json({ status: "error", message: "Invalid primary role" });
    }

    if (req.body.roles !== undefined && !roles) {
      return res.status(400).json({ status: "error", message: "Invalid roles list" });
    }

    if (active === false && !userHasPermission(req.user, "users.disable")) {
      return res.status(403).json({ status: "error", message: "Missing permission: users.disable" });
    }

    if (Number(req.user.id) === userId) {
      if (active === false) {
        return res.status(400).json({ status: "error", message: "You cannot deactivate your own account" });
      }

      if (primaryRole && primaryRole !== "admin") {
        return res.status(400).json({ status: "error", message: "You cannot remove your own admin role" });
      }
    }

    const updates = [];
    const values = [];

    if (fullName !== null) {
      values.push(fullName);
      updates.push(`full_name = $${values.length}`);
    }

    if (active !== null) {
      values.push(active);
      updates.push(`is_active = $${values.length}`);
    }

    if (primaryRole !== null) {
      values.push(primaryRole);
      updates.push(`role = $${values.length}`);
    }

    if (updates.length > 0) {
      updates.push("updated_at = NOW()");
      values.push(userId);

      await pool.query(
        `
          UPDATE users
          SET ${updates.join(", ")}
          WHERE id = $${values.length}
        `,
        values
      );
    }

    if (roles || primaryRole) {
      const nextPrimary = primaryRole || existing.primaryRole || existing.role;
      const nextRoles = roles ? Array.from(new Set([nextPrimary, ...roles])) : [nextPrimary];
      await setUserRoles(userId, nextRoles, nextPrimary);
    }

    const updatedUser = await fetchUserById(userId);

    return res.json({
      status: "ok",
      message: "User updated",
      user: updatedUser,
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/admin/permissions", requireAuth, requirePermission("roles.read"), async (req, res, next) => {
  try {
    const rolesResult = await pool.query(
      `
        SELECT id, code, name, description, is_system
        FROM roles
        ORDER BY code ASC
      `
    );

    const permissionsResult = await pool.query(
      `
        SELECT id, code, name, description, is_system
        FROM permissions
        ORDER BY code ASC
      `
    );

    const linksResult = await pool.query(
      `
        SELECT r.code AS role_code, p.code AS permission_code
        FROM role_permissions rp
        INNER JOIN roles r ON r.id = rp.role_id
        INNER JOIN permissions p ON p.id = rp.permission_id
      `
    );

    const rolePermissions = {};
    for (const role of rolesResult.rows) {
      rolePermissions[role.code] = [];
    }

    for (const row of linksResult.rows) {
      if (!rolePermissions[row.role_code]) {
        rolePermissions[row.role_code] = [];
      }

      rolePermissions[row.role_code].push(row.permission_code);
    }

    return res.json({
      status: "ok",
      roles: rolesResult.rows.map((row) => ({
        code: row.code,
        name: row.name,
        description: row.description,
        isSystem: row.is_system,
      })),
      permissions: permissionsResult.rows.map((row) => ({
        code: row.code,
        name: row.name,
        description: row.description,
        isSystem: row.is_system,
      })),
      rolePermissions,
    });
  } catch (error) {
    return next(error);
  }
});

router.patch("/admin/roles/:roleCode/permissions", requireAuth, requirePermission("roles.manage"), async (req, res, next) => {
  const roleCode = normalizeRoleCode(req.params.roleCode);
  const rawPermissions = Array.isArray(req.body.permissions) ? req.body.permissions : null;

  if (!roleCode) {
    return res.status(400).json({ status: "error", message: "Invalid role code" });
  }

  if (!rawPermissions) {
    return res.status(400).json({ status: "error", message: "Permissions list is required" });
  }

  const permissionCodes = Array.from(
    new Set(
      rawPermissions
        .map(normalizePermissionCode)
        .filter(Boolean)
    )
  );

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const roleResult = await client.query("SELECT id FROM roles WHERE code = $1 LIMIT 1", [roleCode]);
    if (roleResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ status: "error", message: "Role not found" });
    }

    const roleId = roleResult.rows[0].id;
    let permissionIds = [];

    if (permissionCodes.length > 0) {
      const permissionsResult = await client.query(
        `
          SELECT id, code
          FROM permissions
          WHERE code = ANY($1::text[])
        `,
        [permissionCodes]
      );

      if (permissionsResult.rowCount !== permissionCodes.length) {
        const found = new Set(permissionsResult.rows.map((row) => row.code));
        const missing = permissionCodes.filter((code) => !found.has(code));
        await client.query("ROLLBACK");
        return res.status(400).json({ status: "error", message: `Invalid permission(s): ${missing.join(", ")}` });
      }

      permissionIds = permissionsResult.rows.map((row) => row.id);
    }

    await client.query("DELETE FROM role_permissions WHERE role_id = $1", [roleId]);

    for (const permissionId of permissionIds) {
      await client.query(
        `
          INSERT INTO role_permissions (role_id, permission_id)
          VALUES ($1, $2)
          ON CONFLICT (role_id, permission_id) DO NOTHING
        `,
        [roleId, permissionId]
      );
    }

    await client.query("COMMIT");

    return res.json({
      status: "ok",
      message: "Role permissions updated",
      roleCode,
      permissions: permissionCodes,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    return next(error);
  } finally {
    client.release();
  }
});

module.exports = router;
