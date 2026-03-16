const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

async function run() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required to run migrations.");
  }

  const schemaPath = path.join(__dirname, "..", "db", "schema.sql");
  const schemaSql = fs.readFileSync(schemaPath, "utf8");

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await pool.query(schemaSql);
    console.log("Schema migration complete.");
  } finally {
    await pool.end();
  }
}

run().catch((error) => {
  console.error("Schema migration failed:", error);
  process.exitCode = 1;
});
