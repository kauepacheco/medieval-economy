import "server-only";
import { createPool } from "./database";
import { Game } from "./game";
import type pg from "pg";

const globalDatabase = globalThis as unknown as { medievalPool?: pg.Pool };
export function getGame() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not configured. Follow README setup.");
  globalDatabase.medievalPool ??= createPool(url);
  return new Game(globalDatabase.medievalPool);
}
