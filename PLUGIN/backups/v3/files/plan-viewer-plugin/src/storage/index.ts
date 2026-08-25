import path from "node:path";
import { PostgresPlanStorage } from "./postgres-storage.js";
import { SqlitePlanStorage } from "./sqlite-storage.js";
import type { PlanStorage } from "./types.js";

export type RuntimeMode = "stdio" | "http";

export function createStorage(mode: RuntimeMode): PlanStorage {
  const requested = (process.env.PLAN_VIEWER_STORAGE || (mode === "stdio" ? "sqlite" : "postgres")).toLowerCase();

  if (requested === "sqlite") {
    if (mode === "http" && process.env.NODE_ENV === "production") {
      throw new Error("SQLite no está permitido para el servidor HTTP de producción. Usa PostgreSQL.");
    }
    const filePath = process.env.PLAN_VIEWER_SQLITE_PATH || path.resolve(".local/plan-viewer.db");
    return new SqlitePlanStorage(filePath);
  }

  if (requested === "postgres") {
    const connectionString = process.env.DATABASE_URL || "";
    return new PostgresPlanStorage(connectionString);
  }

  throw new Error(`PLAN_VIEWER_STORAGE desconocido: ${requested}. Usa sqlite o postgres.`);
}

export type { PlanStorage, SaveDecisionResult, SavePlanResult, StoredPlan } from "./types.js";
export { PostgresPlanStorage } from "./postgres-storage.js";
export { SqlitePlanStorage } from "./sqlite-storage.js";
