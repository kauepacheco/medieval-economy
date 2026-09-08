import { requireLocalOwner } from "@/server/auth";
import { errorResponse, json } from "@/server/http";
import { getGame } from "@/server/runtime";
import { startJobSchema } from "@/domain/validation";
import { GameError } from "@/domain/errors";

export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const ownerId = requireLocalOwner(request);
    if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") throw new GameError(415, "Send application/json.");
    // Read with a byte limit, including requests without Content-Length.
    const reader = request.body?.getReader();
    if (!reader) throw new GameError(400, "A job assignment is required.");
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 1024) { await reader.cancel(); throw new GameError(413, "Request is too large."); }
      chunks.push(value);
    }
    let body: unknown;
    try { body = JSON.parse(Buffer.concat(chunks).toString("utf8")); }
    catch { throw new GameError(400, "Send a valid JSON assignment."); }
    const parsed = startJobSchema.safeParse(body);
    if (!parsed.success) throw new GameError(400, "Choose an activity and 1–6 workers. Only recipeId, workers, and idempotencyKey are accepted.");
    return json({ job: await getGame().startJob(ownerId, parsed.data) }, 201);
  } catch (error) { return errorResponse(error); }
}
