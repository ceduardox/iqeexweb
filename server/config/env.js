const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const PORT = Number(process.env.PORT || 4000);
const NODE_ENV = process.env.NODE_ENV || "development";
const DATABASE_URL = process.env.DATABASE_URL || process.env.DATABASE_PUBLIC_URL || "";
const DB_SSL = process.env.DB_SSL;

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
  assertDatabaseUrl,
};
