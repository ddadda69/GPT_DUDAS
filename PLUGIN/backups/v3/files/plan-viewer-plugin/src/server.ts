import {
  registerAppResource,
  registerAppTool,
  RESOURCE_MIME_TYPE,
  type McpUiReadResourceResult,
} from "@modelcontextprotocol/ext-apps/server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { DecisionSubmissionSchema, PlanSchema, type DecisionSubmission, type Plan } from "./schema.js";
import type { UserIdentity } from "./identity.js";
import type { PlanStorage } from "./storage/index.js";

export const RESOURCE_URI = "ui://plan-viewer/v1.html";

const StorageResultSchema = z.object({
  backend: z.enum(["sqlite", "postgres"]),
  canonicalVersion: z.number().int().min(1),
  currentUpdated: z.boolean(),
});

export type ServerContext = {
  storage: PlanStorage;
  identity: UserIdentity;
};

function uiFilePath(): string {
  return path.resolve(import.meta.dirname, "../web/dist/mcp-app.html");
}

function decisionLabel(plan: Plan, submission: DecisionSubmission): string {
  const byId = new Map(submission.decisions.map((decision) => [decision.sectionId, decision]));
  const lines = [`Plan: ${plan.id} · v${plan.version}`, ""];

  for (const [index, section] of plan.sections.entries()) {
    const decision = byId.get(section.id)!;
    lines.push(`${index + 1}. ${section.title}`);
    if (decision.kind === "skip") {
      lines.push("   Decisión: No implementar");
    } else if (decision.kind === "other") {
      lines.push(`   Decisión: Otra — ${decision.otherText}`);
    } else {
      const option = section.options.find((candidate) => candidate.id === decision.optionId);
      lines.push(`   Decisión: Opción ${decision.optionId}${decision.editedText ? " (editada)" : ""}`);
      if (!option) throw new Error(`Opción ${decision.optionId} inexistente en ${section.id}.`);
      if (decision.editedText) lines.push(`   Texto editado: ${decision.editedText}`);
    }
    if (decision.note?.trim()) lines.push(`   Nota: ${decision.note.trim()}`);
    lines.push("");
  }

  return lines.join("\n").trim();
}

export function createServer(context: ServerContext): McpServer {
  const server = new McpServer({
    name: "Plan Viewer Plugin",
    version: "0.2.0",
  });

  registerAppTool(
    server,
    "present_plan",
    {
      title: "Presentar plan",
      description: "Valida y guarda un plan privado del usuario autenticado y lo presenta en Plan Viewer para decidir dentro de la conversación.",
      inputSchema: { plan: PlanSchema },
      outputSchema: {
        plan: PlanSchema,
        storage: StorageResultSchema,
      },
      _meta: {
        ui: {
          resourceUri: RESOURCE_URI,
          visibility: ["model", "app"],
        },
      },
    },
    async ({ plan }): Promise<CallToolResult> => {
      const checked = PlanSchema.parse(plan);
      const storage = await context.storage.savePlan(context.identity.ownerId, checked);
      return {
        content: [
          {
            type: "text",
            text: `Plan ${checked.id} v${checked.version} listo para decidir. Guardado de forma privada en ${storage.backend}.`,
          },
        ],
        structuredContent: {
          plan: checked,
          storage,
        },
      };
    },
  );

  registerAppTool(
    server,
    "submit_plan_decisions",
    {
      title: "Guardar decisiones del plan",
      description: "Valida y persiste las decisiones del usuario autenticado sin aceptar ningún identificador de propietario desde la UI.",
      inputSchema: { submission: DecisionSubmissionSchema },
      outputSchema: {
        accepted: z.boolean(),
        submission: DecisionSubmissionSchema,
        backend: z.enum(["sqlite", "postgres"]),
        created: z.boolean(),
        summary: z.string(),
      },
      _meta: {
        ui: {
          visibility: ["app"],
        },
      },
    },
    async ({ submission }): Promise<CallToolResult> => {
      const checked = DecisionSubmissionSchema.parse(submission);
      const { plan } = await context.storage.loadPlan(context.identity.ownerId, checked.planId);
      const summary = decisionLabel(plan, checked);
      const stored = await context.storage.saveDecision(context.identity.ownerId, checked);

      return {
        content: [{ type: "text", text: summary }],
        structuredContent: {
          accepted: true,
          submission: checked,
          backend: stored.backend,
          created: stored.created,
          summary,
        },
      };
    },
  );

  registerAppResource(
    server,
    "Plan Viewer",
    RESOURCE_URI,
    {
      mimeType: RESOURCE_MIME_TYPE,
      description: "Interfaz embebida para elegir, editar y confirmar un plan.",
    },
    async (): Promise<McpUiReadResourceResult> => {
      const html = await fs.readFile(uiFilePath(), "utf8");
      return {
        contents: [
          {
            uri: RESOURCE_URI,
            mimeType: RESOURCE_MIME_TYPE,
            text: html,
            _meta: {
              ui: {
                prefersBorder: true,
                csp: {
                  connectDomains: [],
                  resourceDomains: [],
                  frameDomains: [],
                },
              },
            },
          },
        ],
      };
    },
  );

  return server;
}
