import { Pool, type PoolClient } from "pg";
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
  plan_json: unknown;
};

type DecisionRow = {
  submission_json: unknown;
};

export class PostgresPlanStorage implements PlanStorage {
  readonly backend = "postgres" as const;
  private readonly pool: Pool;
  private schemaPromise: Promise<void> | undefined;

  constructor(connectionString: string) {
    if (!connectionString.trim()) throw new Error("DATABASE_URL es obligatorio para PostgreSQL.");
    this.pool = new Pool({ connectionString });
  }

  private ensureSchema(): Promise<void> {
    if (this.schemaPromise) return this.schemaPromise;
    this.schemaPromise = (async () => {
      const client = await this.pool.connect();
      try {
        await client.query("BEGIN");
        await client.query("SELECT pg_advisory_xact_lock(738201642)");
        await client.query(`
          CREATE TABLE IF NOT EXISTS plans (
            owner_id TEXT NOT NULL,
            plan_id TEXT NOT NULL,
            version INTEGER NOT NULL,
            plan_json JSONB NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            PRIMARY KEY (owner_id, plan_id)
          );

          CREATE TABLE IF NOT EXISTS current_plans (
            owner_id TEXT PRIMARY KEY,
            plan_id TEXT NOT NULL,
            version INTEGER NOT NULL,
            plan_json JSONB NOT NULL,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
          );

          CREATE TABLE IF NOT EXISTS decisions (
            owner_id TEXT NOT NULL,
            plan_id TEXT NOT NULL,
            submission_id UUID NOT NULL,
            plan_version INTEGER NOT NULL,
            submission_json JSONB NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            PRIMARY KEY (owner_id, plan_id, submission_id),
            FOREIGN KEY (owner_id, plan_id) REFERENCES plans(owner_id, plan_id) ON DELETE CASCADE
          );

          CREATE INDEX IF NOT EXISTS idx_decisions_owner_plan
            ON decisions(owner_id, plan_id, created_at DESC);

          ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
          ALTER TABLE plans FORCE ROW LEVEL SECURITY;
          ALTER TABLE current_plans ENABLE ROW LEVEL SECURITY;
          ALTER TABLE current_plans FORCE ROW LEVEL SECURITY;
          ALTER TABLE decisions ENABLE ROW LEVEL SECURITY;
          ALTER TABLE decisions FORCE ROW LEVEL SECURITY;

          DO $$
          BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = current_schema() AND tablename = 'plans' AND policyname = 'plans_owner_isolation') THEN
              CREATE POLICY plans_owner_isolation ON plans
                USING (owner_id = current_setting('plan_viewer.owner_id', true))
                WITH CHECK (owner_id = current_setting('plan_viewer.owner_id', true));
            END IF;
            IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = current_schema() AND tablename = 'current_plans' AND policyname = 'current_plans_owner_isolation') THEN
              CREATE POLICY current_plans_owner_isolation ON current_plans
                USING (owner_id = current_setting('plan_viewer.owner_id', true))
                WITH CHECK (owner_id = current_setting('plan_viewer.owner_id', true));
            END IF;
            IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = current_schema() AND tablename = 'decisions' AND policyname = 'decisions_owner_isolation') THEN
              CREATE POLICY decisions_owner_isolation ON decisions
                USING (owner_id = current_setting('plan_viewer.owner_id', true))
                WITH CHECK (owner_id = current_setting('plan_viewer.owner_id', true));
            END IF;
          END $$;
        `);
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK").catch(() => {});
        this.schemaPromise = undefined;
        throw error;
      } finally {
        client.release();
      }
    })();
    return this.schemaPromise;
  }

  private async withOwner<T>(ownerId: string, work: (client: PoolClient, owner: string) => Promise<T>): Promise<T> {
    await this.ensureSchema();
    const owner = assertOwnerId(ownerId);
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT set_config('plan_viewer.owner_id', $1, true)", [owner]);
      const result = await work(client, owner);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }

  async loadPlan(ownerId: string, planId: string): Promise<StoredPlan> {
    return this.withOwner(ownerId, async (client, owner) => {
      const result = await client.query<PlanRow>(`
        SELECT version, plan_json
          FROM plans
         WHERE owner_id = $1 AND plan_id = $2
      `, [owner, planId]);
      const row = result.rows[0];
      if (!row) throw new Error(`No existe el plan ${planId}.`);
      const plan = PlanSchema.parse(row.plan_json);
      if (plan.id !== planId || plan.version !== row.version) throw new Error("Plan almacenado inconsistente.");
      return { plan };
    });
  }

  async savePlan(ownerId: string, input: Plan): Promise<SavePlanResult> {
    const plan = PlanSchema.parse(input);
    const json = canonicalJson(plan);

    return this.withOwner(ownerId, async (client, owner) => {
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [`plan:${owner}:${plan.id}`]);
      const result = await client.query<PlanRow>(`
        SELECT version, plan_json
          FROM plans
         WHERE owner_id = $1 AND plan_id = $2
         FOR UPDATE
      `, [owner, plan.id]);
      const existing = result.rows[0];

      if (existing) {
        const identical = canonicalJson(existing.plan_json) === json;
        if (!identical && plan.version !== existing.version + 1) {
          throw new Error(`Versión inválida para ${plan.id}: almacenado v${existing.version}, recibido v${plan.version}.`);
        }
        if (!identical) {
          await client.query(`
            UPDATE plans
               SET version = $3, plan_json = $4::jsonb, updated_at = now()
             WHERE owner_id = $1 AND plan_id = $2
          `, [owner, plan.id, plan.version, json]);
        }
      } else {
        if (plan.version !== 1) throw new Error(`Un plan nuevo debe empezar en version 1; se recibió v${plan.version}.`);
        await client.query(`
          INSERT INTO plans(owner_id, plan_id, version, plan_json)
          VALUES ($1, $2, $3, $4::jsonb)
        `, [owner, plan.id, plan.version, json]);
      }

      await client.query(`
        INSERT INTO current_plans(owner_id, plan_id, version, plan_json, updated_at)
        VALUES ($1, $2, $3, $4::jsonb, now())
        ON CONFLICT(owner_id) DO UPDATE SET
          plan_id = EXCLUDED.plan_id,
          version = EXCLUDED.version,
          plan_json = EXCLUDED.plan_json,
          updated_at = now()
      `, [owner, plan.id, plan.version, json]);

      return { backend: this.backend, canonicalVersion: plan.version, currentUpdated: true };
    });
  }

  async saveDecision(ownerId: string, input: DecisionSubmission): Promise<SaveDecisionResult> {
    const submission = DecisionSubmissionSchema.parse(input);
    const json = canonicalJson(submission);

    return this.withOwner(ownerId, async (client, owner) => {
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [
        `decision:${owner}:${submission.planId}:${submission.submissionId}`,
      ]);

      const planResult = await client.query<PlanRow>(`
        SELECT version, plan_json
          FROM plans
         WHERE owner_id = $1 AND plan_id = $2
         FOR SHARE
      `, [owner, submission.planId]);
      const planRow = planResult.rows[0];
      if (!planRow) throw new Error(`No existe el plan ${submission.planId}.`);
      const plan = PlanSchema.parse(planRow.plan_json);
      assertSubmissionMatchesPlan(submission, plan);

      const decisionResult = await client.query<DecisionRow>(`
        SELECT submission_json
          FROM decisions
         WHERE owner_id = $1 AND plan_id = $2 AND submission_id = $3::uuid
      `, [owner, submission.planId, submission.submissionId]);
      const existing = decisionResult.rows[0];
      if (existing) {
        if (canonicalJson(existing.submission_json) !== json) {
          throw new Error(`submissionId ${submission.submissionId} ya existe con otro contenido.`);
        }
        return { backend: this.backend, created: false };
      }

      await client.query(`
        INSERT INTO decisions(owner_id, plan_id, submission_id, plan_version, submission_json)
        VALUES ($1, $2, $3::uuid, $4, $5::jsonb)
      `, [owner, submission.planId, submission.submissionId, submission.planVersion, json]);

      return { backend: this.backend, created: true };
    });
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
