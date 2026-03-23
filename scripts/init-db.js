const { initDatabase } = require("../server/db/bootstrap");
const { pool } = require("../server/db/pool");

async function run() {
  try {
    await initDatabase();
    console.log("Database bootstrap completed.");
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error("Database bootstrap failed:", error.message);
    try {
      await pool.end();
    } catch (_) {}
    process.exit(1);
  }
}

run();
