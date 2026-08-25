import type { DecisionSubmission, Plan } from "../schema.js";

export type StorageBackend = "sqlite" | "postgres";

export type SavePlanResult = {
  backend: StorageBackend;
  canonicalVersion: number;
  currentUpdated: boolean;
};

export type SaveDecisionResult = {
  backend: StorageBackend;
  created: boolean;
};

export type StoredPlan = {
  plan: Plan;
};

export interface PlanStorage {
  readonly backend: StorageBackend;
  loadPlan(ownerId: string, planId: string): Promise<StoredPlan>;
  savePlan(ownerId: string, plan: Plan): Promise<SavePlanResult>;
  saveDecision(ownerId: string, submission: DecisionSubmission): Promise<SaveDecisionResult>;
  close(): Promise<void>;
}

export function assertOwnerId(ownerId: string): string {
  const checked = ownerId.trim();
  if (!checked || checked.length > 256) throw new Error("Identidad de propietario inválida.");
  return checked;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === "object") {
    const input = value as Record<string, unknown>;
    const output: Record<string, unknown> = {};
    for (const key of Object.keys(input).sort()) output[key] = canonicalize(input[key]);
    return output;
  }
  return value;
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}
