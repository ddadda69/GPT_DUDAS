import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  DecisionSubmissionSchema,
  PlanSchema,
  assertSubmissionMatchesPlan,
  type DecisionSubmission,
  type Plan,
} from "../schema.js";
import {
  assertOwnerId,
  canonicalJson,
  type PlanStorage,
  type SaveDecisionResult,
  type SavePlanResult,
  type StoredPlan,
} from "./types.js";

type PlanRow = {
  version: number;
  plan_json: string;
};

type DecisionRow = {
  submission_json: string;
};

export class SqlitePlanStorage implements PlanStorage {
  readonly backend = "sqlite" as const;
  private readonly db: DatabaseSync;

  constructor(filePath: string) {
    if (filePath !== ":memory:") {
      const absolute = path.resolve(filePath);
      mkdirSync(path.dirname(absolute), { recursive: true });
      filePath = absolute;
    }

    this.db = new DatabaseSync(filePath);
    this.db.exec("PRAGMA foreign_keys = ON;");
    this.db.exec("PRAGMA busy_timeout = 5000;");
    if (filePath !== ":memory:") this.db.exec("PRAGMA journal_mode = WAL;");
    this.ensureSchema();
  }

  private ensureSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS plans (
        owner_id TEXT NOT NULL,
        plan_id TEXT NOT NULL,
        version INTEGER NOT NULL,
        plan_json TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (owner_id, plan_id)
      );

      CREATE TABLE IF NOT EXISTS current_plans (
        owner_id TEXT PRIMARY KEY,
        plan_id TEXT NOT NULL,
        version INTEGER NOT NULL,
        plan_json TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS decisions (
        owner_id TEXT NOT NULL,
        plan_id TEXT NOT NULL,
        submission_id TEXT NOT NULL,
        plan_version INTEGER NOT NULL,
        submission_json TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (owner_id, plan_id, submission_id),
        FOREIGN KEY (owner_id, plan_id) REFERENCES plans(owner_id, plan_id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_decisions_owner_plan
        ON decisions(owner_id, plan_id, created_at);
    `);
  }

  private transaction<T>(work: () => T): T {
    this.db.exec("BEGIN IMMEDIATE;");
    try {
      const result = work();
      this.db.exec("COMMIT;");
      return result;
    } catch (error) {
      try {
        this.db.exec("ROLLBACK;");
      } catch {
        // Preserve the original error.
      }
      throw error;
    }
  }

  async loadPlan(ownerId: string, planId: string): Promise<StoredPlan> {
    const owner = assertOwnerId(ownerId);
    const row = this.db.prepare(
      "SELECT version, plan_json FROM plans WHERE owner_id = ? AND plan_id = ?",
    ).get(owner, planId) as PlanRow | undefined;

    if (!row) throw new Error(`No existe el plan ${planId}.`);
    const plan = PlanSchema.parse(JSON.parse(row.plan_json));
    if (plan.id !== planId || plan.version !== row.version) throw new Error("Plan almacenado inconsistente.");
    return { plan };
  }

  async savePlan(ownerId: string, input: Plan): Promise<SavePlanResult> {
    const owner = assertOwnerId(ownerId);
    const plan = PlanSchema.parse(input);
    const json = canonicalJson(plan);

    return this.transaction(() => {
      const existing = this.db.prepare(
        "SELECT version, plan_json FROM plans WHERE owner_id = ? AND plan_id = ?",
      ).get(owner, plan.id) as PlanRow | undefined;

      if (existing) {
        const identical = existing.plan_json === json;
        if (!identical && plan.version !== existing.version + 1) {
          throw new Error(`Versión inválida para ${plan.id}: almacenado v${existing.version}, recibido v${plan.version}.`);
        }
        if (!identical) {
          this.db.prepare(`
            UPDATE plans
               SET version = ?, plan_json = ?, updated_at = CURRENT_TIMESTAMP
             WHERE owner_id = ? AND plan_id = ?
          `).run(plan.version, json, owner, plan.id);
        }
      } else {
        if (plan.version !== 1) throw new Error(`Un plan nuevo debe empezar en version 1; se recibió v${plan.version}.`);
        this.db.prepare(`
          INSERT INTO plans(owner_id, plan_id, version, plan_json)
          VALUES (?, ?, ?, ?)
        `).run(owner, plan.id, plan.version, json);
      }

      this.db.prepare(`
        INSERT INTO current_plans(owner_id, plan_id, version, plan_json, updated_at)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(owner_id) DO UPDATE SET
          plan_id = excluded.plan_id,
          version = excluded.version,
          plan_json = excluded.plan_json,
          updated_at = CURRENT_TIMESTAMP
      `).run(owner, plan.id, plan.version, json);

      return { backend: this.backend, canonicalVersion: plan.version, currentUpdated: true };
    });
  }

  async saveDecision(ownerId: string, input: DecisionSubmission): Promise<SaveDecisionResult> {
    const owner = assertOwnerId(ownerId);
    const submission = DecisionSubmissionSchema.parse(input);
    const json = canonicalJson(submission);

    return this.transaction(() => {
      const planRow = this.db.prepare(
        "SELECT version, plan_json FROM plans WHERE owner_id = ? AND plan_id = ?",
      ).get(owner, submission.planId) as PlanRow | undefined;
      if (!planRow) throw new Error(`No existe el plan ${submission.planId}.`);

      const plan = PlanSchema.parse(JSON.parse(planRow.plan_json));
      assertSubmissionMatchesPlan(submission, plan);

      const existing = this.db.prepare(`
        SELECT submission_json
          FROM decisions
         WHERE owner_id = ? AND plan_id = ? AND submission_id = ?
      `).get(owner, submission.planId, submission.submissionId) as DecisionRow | undefined;

      if (existing) {
        if (existing.submission_json !== json) {
          throw new Error(`submissionId ${submission.submissionId} ya existe con otro contenido.`);
        }
        return { backend: this.backend, created: false };
      }

      this.db.prepare(`
        INSERT INTO decisions(owner_id, plan_id, submission_id, plan_version, submission_json)
        VALUES (?, ?, ?, ?, ?)
      `).run(owner, submission.planId, submission.submissionId, submission.planVersion, json);

      return { backend: this.backend, created: true };
    });
  }

  async close(): Promise<void> {
    this.db.close();
  }
}
