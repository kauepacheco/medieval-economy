export const recipes = [
  { id: "gather_wood", version: 1, name: "Gather wood", resource: "wood", durationSeconds: 30, outputPerWorker: 5 },
  { id: "gather_stone", version: 1, name: "Quarry stone", resource: "stone", durationSeconds: 45, outputPerWorker: 3 },
] as const;

export const INITIAL_WORKERS = 6;
export const LOCAL_OWNER_ID = "00000000-0000-4000-8000-000000000001";
export const LOCAL_VILLAGE_ID = "00000000-0000-4000-8000-000000000002";
