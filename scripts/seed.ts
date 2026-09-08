import { assertLocalDevelopment } from "../src/server/auth";
import { createPool } from "../src/server/database";
import { seed } from "../src/server/seed";
assertLocalDevelopment();
if (!process.env.DATABASE_URL) throw new Error("Set DATABASE_URL in .env first.");
const pool = createPool(process.env.DATABASE_URL);
try { await seed(pool); console.log("Oakstead is ready. Existing progress was preserved."); }
finally { await pool.end(); }
