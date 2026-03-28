const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const PORT = Number(process.env.PORT || 4000);
const NODE_ENV = process.env.NODE_ENV || "development";
const DATABASE_URL = process.env.DATABASE_URL || process.env.DATABASE_PUBLIC_URL || "";
const DB_SSL = process.env.DB_SSL;
const AUTH_SECRET = process.env.APP_AUTH_SECRET || "iqx-dev-secret-change-me";
const AUTH_TOKEN_TTL_SECONDS = Number(process.env.AUTH_TOKEN_TTL_SECONDS || 60 * 60 * 12);

function assertDatabaseUrl() {
  if (!DATABASE_URL) {
    throw new Error("Missing DATABASE_URL or DATABASE_PUBLIC_URL in .env");
  }
}

module.exports = {
  PORT,
  NODE_ENV,
  DATABASE_URL,
  DB_SSL,
  AUTH_SECRET,
  AUTH_TOKEN_TTL_SECONDS,
  assertDatabaseUrl,
};
