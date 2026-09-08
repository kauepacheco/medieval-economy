import { requireLocalOwner } from "@/server/auth";
import { errorResponse, json } from "@/server/http";
import { getGame } from "@/server/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const ownerId = requireLocalOwner(request);
    return json(await getGame().getVillage(ownerId));
  } catch (error) { return errorResponse(error); }
}
