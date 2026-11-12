const { Pool } = require("pg");

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    host: process.env.DB_HOST || process.env.PGHOST || "localhost",
    port: Number(process.env.DB_PORT || process.env.PGPORT || 5433),
    database: process.env.DB_NAME || process.env.PGDATABASE || "eatclean_db",
    user: process.env.DB_USER || process.env.PGUSER || "admin",
    password: process.env.DB_PASSWORD || process.env.PGPASSWORD || "admin123"
});

module.exports = pool;