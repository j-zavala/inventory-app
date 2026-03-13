require("dotenv").config({ quiet: true });

const { Pool } = require("pg");

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required. Add it to your .env file.");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.on("error", (error) => {
  console.error("Unexpected PostgreSQL client error:", error);
});

module.exports = {
  pool,
};
