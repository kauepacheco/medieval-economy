import { createPool } from "../src/server/database";
import { migrate } from "../src/server/migrate";
if (!process.env.DATABASE_URL) throw new Error("Set DATABASE_URL in .env first.");
const pool = createPool(process.env.DATABASE_URL);
try { await migrate(pool); console.log("Database migrations applied."); }
finally { await pool.end(); }
