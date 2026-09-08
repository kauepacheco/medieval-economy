import { GameError } from "../domain/errors";

export function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}
export function errorResponse(error: unknown) {
  if (error instanceof GameError) return json({ error: error.message }, error.status);
  // Do not log database connection strings, raw inputs, or SQL details.
  console.error("Game request failed", error instanceof Error ? error.name : "UnknownError");
  return json({ error: "The village is temporarily unavailable. Check the database and try again." }, 503);
}
