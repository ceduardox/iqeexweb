const { Pool } = require("pg");
const { DATABASE_URL, DB_SSL, assertDatabaseUrl } = require("../config/env");

assertDatabaseUrl();

function resolveSslOption() {
  if (DB_SSL === "false") {
    return false;
  }

  return { rejectUnauthorized: false };
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: resolveSslOption(),
  max: 10,
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
});

module.exports = { pool };
