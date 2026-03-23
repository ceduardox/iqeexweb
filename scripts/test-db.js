const dotenv = require("dotenv");
const { Client } = require("pg");

dotenv.config();

const connectionString = process.env.DATABASE_URL || process.env.DATABASE_PUBLIC_URL;
const dbSsl = process.env.DB_SSL;

if (!connectionString) {
  console.error("Missing DATABASE_URL or DATABASE_PUBLIC_URL in .env");
  process.exit(1);
}

function buildAttempts() {
  const base = {
    connectionString,
    connectionTimeoutMillis: 10000,
  };

  if (dbSsl === "true") {
    return [{ label: "ssl:on", config: { ...base, ssl: { rejectUnauthorized: false } } }];
  }

  if (dbSsl === "false") {
    return [{ label: "ssl:off", config: { ...base, ssl: false } }];
  }

  return [
    { label: "ssl:on", config: { ...base, ssl: { rejectUnauthorized: false } } },
    { label: "ssl:off", config: { ...base, ssl: false } },
  ];
}

async function testConnection() {
  const attempts = buildAttempts();
  const errors = [];

  for (const attempt of attempts) {
    const client = new Client(attempt.config);

    try {
      await client.connect();
      const result = await client.query(
        "SELECT NOW() AS server_time, current_database() AS database_name, current_user AS database_user"
      );

      const row = result.rows[0];
      console.log("DB connection successful");
      console.log(`Mode: ${attempt.label}`);
      console.log(`Database: ${row.database_name}`);
      console.log(`User: ${row.database_user}`);
      console.log(`Server time: ${row.server_time.toISOString()}`);
      await client.end();
      return;
    } catch (error) {
      errors.push(`${attempt.label} -> ${error.message}`);
      try {
        await client.end();
      } catch (closeError) {
      }
    }
  }

  console.error("DB connection failed on all attempts:");
  errors.forEach((err) => console.error(`- ${err}`));
  process.exit(1);
}

testConnection();
