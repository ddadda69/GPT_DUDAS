import { z } from "zod";

export const PLAN_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

export const PlanOptionSchema = z.object({
  id: z.number().int().min(1).max(2),
  text: z.string().min(1),
  recommended: z.boolean().optional(),
}).strict();

export const PlanSectionSchema = z.object({
  id: z.string().regex(PLAN_ID_RE),
  title: z.string().min(1),
  description: z.string().optional(),
  options: z.array(PlanOptionSchema).min(1).max(2),
  defaultOption: z.number().int().min(1).max(2),
  allowOther: z.boolean().optional().default(false),
  allowNote: z.boolean().optional().default(true),
  noteLabel: z.string().optional(),
  notePlaceholder: z.string().optional(),
}).strict().superRefine((section, ctx) => {
  const expectedIds = section.options.map((_, index) => index + 1);
  const ids = section.options.map((option) => option.id);
  if (ids.some((id, index) => id !== expectedIds[index])) {
    ctx.addIssue({ code: "custom", message: "Las opciones deben usar ids consecutivos empezando en 1.", path: ["options"] });
  }
  if (!ids.includes(section.defaultOption)) {
    ctx.addIssue({ code: "custom", message: "defaultOption debe apuntar a una opción existente.", path: ["defaultOption"] });
  }
  const recommended = section.options.filter((option) => option.recommended === true);
  if (recommended.length !== 1) {
    ctx.addIssue({ code: "custom", message: "Debe existir exactamente una opción recomendada.", path: ["options"] });
  } else if (recommended[0].id !== section.defaultOption) {
    ctx.addIssue({ code: "custom", message: "La opción recomendada debe coincidir con defaultOption.", path: ["defaultOption"] });
  }
});

export const PlanSchema = z.object({
  $schema: z.string().min(1).optional(),
  id: z.string().regex(PLAN_ID_RE),
  version: z.number().int().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  sections: z.array(PlanSectionSchema).min(1),
}).strict().superRefine((plan, ctx) => {
  const seen = new Set<string>();
  for (const [index, section] of plan.sections.entries()) {
    if (seen.has(section.id)) {
      ctx.addIssue({ code: "custom", message: `Section id duplicado: ${section.id}`, path: ["sections", index, "id"] });
    }
    seen.add(section.id);
  }
});

export type Plan = z.infer<typeof PlanSchema>;
export type PlanSection = z.infer<typeof PlanSectionSchema>;

export const DecisionSchema = z.object({
  sectionId: z.string().regex(PLAN_ID_RE),
  kind: z.enum(["option", "skip", "other"]),
  optionId: z.number().int().min(1).max(2).optional(),
  editedText: z.string().min(1).optional(),
  otherText: z.string().min(1).optional(),
  note: z.string().optional(),
}).strict().superRefine((decision, ctx) => {
  if (decision.kind === "option" && decision.optionId === undefined) {
    ctx.addIssue({ code: "custom", message: "optionId es obligatorio para kind=option.", path: ["optionId"] });
  }
  if (decision.kind !== "option" && decision.optionId !== undefined) {
    ctx.addIssue({ code: "custom", message: "optionId solo se admite para kind=option.", path: ["optionId"] });
  }
  if (decision.kind === "other" && !decision.otherText?.trim()) {
    ctx.addIssue({ code: "custom", message: "otherText es obligatorio para kind=other.", path: ["otherText"] });
  }
});

export const DecisionSubmissionSchema = z.object({
  submissionId: z.string().uuid(),
  planId: z.string().regex(PLAN_ID_RE),
  planVersion: z.number().int().min(1),
  decisions: z.array(DecisionSchema).min(1),
}).strict();

export type DecisionSubmission = z.infer<typeof DecisionSubmissionSchema>;

export function assertSubmissionMatchesPlan(submission: DecisionSubmission, plan: Plan): void {
  if (submission.planId !== plan.id || submission.planVersion !== plan.version) {
    throw new Error(`La respuesta pertenece a ${submission.planId} v${submission.planVersion}, pero el plan vigente es ${plan.id} v${plan.version}.`);
  }
  if (submission.decisions.length !== plan.sections.length) {
    throw new Error("Debe enviarse exactamente una decisión por sección.");
  }

  const bySection = new Map(submission.decisions.map((decision) => [decision.sectionId, decision]));
  if (bySection.size !== submission.decisions.length) {
    throw new Error("No se permiten decisiones duplicadas para una misma sección.");
  }

  for (const section of plan.sections) {
    const decision = bySection.get(section.id);
    if (!decision) throw new Error(`Falta la decisión de la sección ${section.id}.`);
    if (decision.kind === "option" && !section.options.some((option) => option.id === decision.optionId)) {
      throw new Error(`La opción ${decision.optionId} no existe en la sección ${section.id}.`);
    }
    if (decision.kind === "other" && !section.allowOther) {
      throw new Error(`La sección ${section.id} no permite la opción Otra.`);
    }
    if (decision.note && section.allowNote === false) {
      throw new Error(`La sección ${section.id} no admite notas.`);
    }
  }
}
