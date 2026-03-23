const express = require("express");
const { pool } = require("../db/pool");
const { hashPassword, verifyPassword } = require("../auth/password");

const router = express.Router();
const ALLOWED_ROLES = new Set(["student", "teacher", "admin"]);

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeName(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

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

router.post("/auth/register", async (req, res, next) => {
  try {
    const fullName = normalizeName(req.body.fullName);
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || "");
    const role = String(req.body.role || "student").toLowerCase();

    if (fullName.length < 3) {
      return res.status(400).json({ status: "error", message: "Name must contain at least 3 characters" });
    }

    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return res.status(400).json({ status: "error", message: "Invalid email" });
    }

    if (password.length < 8) {
      return res.status(400).json({ status: "error", message: "Password must contain at least 8 characters" });
    }

    if (!ALLOWED_ROLES.has(role)) {
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

    return res.status(201).json({
      status: "ok",
      message: "Account created",
      user: sanitizeUser(insert.rows[0]),
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/auth/login", async (req, res, next) => {
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

    const user = result.rows[0];
    if (!user.is_active) {
      return res.status(403).json({ status: "error", message: "Account is inactive" });
    }

    const validPassword = await verifyPassword(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ status: "error", message: "Invalid credentials" });
    }

    return res.json({
      status: "ok",
      message: "Login successful",
      user: sanitizeUser(user),
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
