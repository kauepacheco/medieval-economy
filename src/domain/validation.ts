import { z } from "zod";
export const startJobSchema = z.object({
  recipeId: z.enum(["gather_wood", "gather_stone"]),
  workers: z.number().int().min(1).max(6),
  idempotencyKey: z.uuid(),
}).strict();
export type StartJobInput = z.infer<typeof startJobSchema>;
