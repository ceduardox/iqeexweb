const app = require("./app");
const { PORT } = require("./config/env");
const { pool } = require("./db/pool");
const { initDatabase } = require("./db/bootstrap");

let server;

async function start() {
  await initDatabase();
  server = app.listen(PORT, () => {
    console.log(`API running on http://localhost:${PORT}`);
  });
}

async function shutdown(signal) {
  console.log(`\n${signal} received. Closing server...`);

  if (server) {
    server.close(async () => {
      try {
        await pool.end();
        console.log("PostgreSQL pool closed.");
        process.exit(0);
      } catch (error) {
        console.error("Error closing PostgreSQL pool:", error);
        process.exit(1);
      }
    });
    return;
  }

  try {
    await pool.end();
  } catch (error) {
    console.error("Error closing PostgreSQL pool:", error);
  }
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

start().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
