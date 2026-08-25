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
import { loadPlan, saveDecision, savePlan } from "./github-storage.js";

export const RESOURCE_URI = "ui://plan-viewer/v1.html";

const StorageResultSchema = z.object({
  canonicalSha: z.string(),
  currentUpdated: z.boolean(),
  currentSha: z.string().optional(),
});

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

export function createServer(): McpServer {
  const server = new McpServer({
    name: "Plan Viewer Plugin",
    version: "0.1.0",
  });

  registerAppTool(
    server,
    "present_plan",
    {
      title: "Presentar plan",
      description: "Valida y guarda un plan, y lo presenta en Plan Viewer para que el usuario decida dentro de la conversación.",
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
      const storage = await savePlan(checked);
      return {
        content: [
          {
            type: "text",
            text: `Plan ${checked.id} v${checked.version} listo para decidir. Archivo canónico verificado: ${storage.canonicalSha.slice(0, 8)}.${storage.currentUpdated ? " current.json actualizado." : " current.json no se actualizó por concurrencia o ya estaba en otro estado."}`,
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
      description: "Valida y persiste las decisiones realizadas en el Plan Viewer.",
      inputSchema: { submission: DecisionSubmissionSchema },
      outputSchema: {
        accepted: z.boolean(),
        submission: DecisionSubmissionSchema,
        decisionSha: z.string(),
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
      const { plan } = await loadPlan(checked.planId);
      const summary = decisionLabel(plan, checked);
      const stored = await saveDecision(checked);

      return {
        content: [{ type: "text", text: summary }],
        structuredContent: {
          accepted: true,
          submission: checked,
          decisionSha: stored.sha,
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
