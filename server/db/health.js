const { pool } = require("./pool");

async function checkDatabaseConnection() {
  const result = await pool.query(
    "SELECT NOW() AS server_time, current_database() AS database_name, current_user AS database_user"
  );

  return result.rows[0];
}

module.exports = { checkDatabaseConnection };
