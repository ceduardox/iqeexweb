const express = require("express");
const { pool } = require("../db/pool");
const { hashPassword, verifyPassword } = require("../auth/password");
const { createAuthToken } = require("../auth/token");
const { requireAuth, sanitizeUser } = require("../middleware/auth");
const { createRateLimiter } = require("../middleware/rate-limit");
const { ensureUserPrimaryRole, getUserAccess } = require("../services/rbac");

const router = express.Router();
const ALLOWED_ROLES = new Set(["student", "teacher", "admin"]);
const authMutationLimiter = createRateLimiter({
  windowMs: Number(process.env.RATE_LIMIT_AUTH_WINDOW_MS) || 10 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_AUTH_MAX) || 40,
  message: "Too many authentication attempts. Try again in a few minutes.",
});

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeName(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function normalizeRole(value) {
  const normalized = String(value || "student").trim().toLowerCase();
  return ALLOWED_ROLES.has(normalized) ? normalized : null;
}

function defaultCourseCodesForRole(role) {
  if (role === "teacher") {
    return ["BIO-101", "LMS-110", "ART-220"];
  }

  if (role === "student") {
    return ["BIO-101", "PHO-160", "WAT-120"];
  }

  return [];
}

function defaultMemberRole(role) {
  return role === "teacher" ? "teacher" : "student";
}

function deterministicProgress(userId, courseId, role) {
  if (role === "teacher") {
    return 100;
  }

  return ((Number(userId) * 17 + Number(courseId) * 11) % 81) + 10;
}

async function enrollDefaultCourses(userId, role) {
  const courseCodes = defaultCourseCodesForRole(role);
  if (courseCodes.length === 0) {
    return;
  }

  const courses = await pool.query("SELECT id FROM courses WHERE code = ANY($1::text[])", [courseCodes]);
  for (const course of courses.rows) {
    await pool.query(
      `
        INSERT INTO course_members (user_id, course_id, role, progress_percent)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (user_id, course_id) DO NOTHING
      `,
      [userId, course.id, defaultMemberRole(role), deterministicProgress(userId, course.id, role)]
    );
  }
}

async function buildUserWithAccess(userRow) {
  const access = await getUserAccess(userRow.id, userRow.role);
  return {
    ...sanitizeUser(userRow),
    role: access.primaryRole,
    primaryRole: access.primaryRole,
    roles: access.roles,
    permissions: access.permissions,
  };
}

router.post("/auth/register", authMutationLimiter, async (req, res, next) => {
  try {
    const fullName = normalizeName(req.body.fullName);
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || "");
    const role = normalizeRole(req.body.role);

    if (fullName.length < 3) {
      return res.status(400).json({ status: "error", message: "Name must contain at least 3 characters" });
    }

    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return res.status(400).json({ status: "error", message: "Invalid email" });
    }

    if (password.length < 8) {
      return res.status(400).json({ status: "error", message: "Password must contain at least 8 characters" });
    }

    if (!role) {
      return res.status(400).json({ status: "error", message: "Invalid role" });
    }

    const existing = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
    if (existing.rowCount > 0) {
      return res.status(409).json({ status: "error", message: "Email already registered" });
    }

    const passwordHash = await hashPassword(password);
    const insert = await pool.query(
      `
        INSERT INTO users (full_name, email, password_hash, role)
        VALUES ($1, $2, $3, $4)
        RETURNING id, full_name, email, role, is_active, created_at
      `,
      [fullName, email, passwordHash, role]
    );

    await ensureUserPrimaryRole(insert.rows[0].id, role);
    await enrollDefaultCourses(insert.rows[0].id, role);

    const user = await buildUserWithAccess(insert.rows[0]);
    const token = createAuthToken(user);

    return res.status(201).json({
      status: "ok",
      message: "Account created",
      token,
      user,
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/auth/login", authMutationLimiter, async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || "");

    if (!email || !password) {
      return res.status(400).json({ status: "error", message: "Email and password are required" });
    }

    const result = await pool.query(
      `
        SELECT id, full_name, email, role, is_active, created_at, password_hash
        FROM users
        WHERE email = $1
        LIMIT 1
      `,
      [email]
    );

    if (result.rowCount === 0) {
      return res.status(401).json({ status: "error", message: "Invalid credentials" });
    }

    const row = result.rows[0];
    if (!row.is_active) {
      return res.status(403).json({ status: "error", message: "Account is inactive" });
    }

    const validPassword = await verifyPassword(password, row.password_hash);
    if (!validPassword) {
      return res.status(401).json({ status: "error", message: "Invalid credentials" });
    }

    await ensureUserPrimaryRole(row.id, row.role);

    const user = await buildUserWithAccess(row);
    const token = createAuthToken(user);

    return res.json({
      status: "ok",
      message: "Login successful",
      token,
      user,
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/auth/me", requireAuth, (req, res) => {
  return res.json({
    status: "ok",
    user: req.user,
  });
});

router.post("/auth/logout", requireAuth, (req, res) => {
  return res.json({
    status: "ok",
    message: "Logout successful",
  });
});

module.exports = router;


