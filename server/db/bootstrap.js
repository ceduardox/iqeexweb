const { pool } = require("./pool");

async function initDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id BIGSERIAL PRIMARY KEY,
      full_name VARCHAR(120) NOT NULL,
      email VARCHAR(190) NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role VARCHAR(30) NOT NULL DEFAULT 'student',
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT users_role_check CHECK (role IN ('student', 'teacher', 'admin'))
    );

    CREATE INDEX IF NOT EXISTS idx_users_role ON users (role);
  `);
}

module.exports = { initDatabase };
