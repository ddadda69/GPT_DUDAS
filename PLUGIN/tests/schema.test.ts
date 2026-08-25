import assert from "node:assert/strict";
import test from "node:test";
import {
  DecisionSubmissionSchema,
  PlanSchema,
  assertSubmissionMatchesPlan,
  type Plan,
} from "../src/schema.js";

const plan: Plan = PlanSchema.parse({
  id: "plan-test-1",
  version: 1,
  title: "Plan de prueba",
  sections: [
    {
      id: "arquitectura",
      title: "Arquitectura",
      defaultOption: 1,
      options: [
        { id: 1, recommended: true, text: "Opción recomendada" },
        { id: 2, text: "Alternativa" },
      ],
      allowOther: true,
      allowNote: true,
    },
  ],
});

test("acepta un plan coherente", () => {
  assert.equal(plan.sections[0].defaultOption, 1);
});

test("rechaza opciones no consecutivas", () => {
  const result = PlanSchema.safeParse({
    ...plan,
    sections: [{
      ...plan.sections[0],
      options: [
        { id: 2, recommended: true, text: "Incorrecta" },
      ],
      defaultOption: 2,
    }],
  });
  assert.equal(result.success, false);
});

test("rechaza dos opciones recomendadas", () => {
  const result = PlanSchema.safeParse({
    ...plan,
    sections: [{
      ...plan.sections[0],
      options: [
        { id: 1, recommended: true, text: "A" },
        { id: 2, recommended: true, text: "B" },
      ],
    }],
  });
  assert.equal(result.success, false);
});

test("valida una submission completa contra el plan", () => {
  const submission = DecisionSubmissionSchema.parse({
    submissionId: "02d02e9e-12bf-4587-bf05-3f5baf9d85fe",
    planId: plan.id,
    planVersion: plan.version,
    decisions: [{ sectionId: "arquitectura", kind: "option", optionId: 1 }],
  });
  assert.doesNotThrow(() => assertSubmissionMatchesPlan(submission, plan));
});

test("rechaza una submission de otra versión", () => {
  const submission = DecisionSubmissionSchema.parse({
    submissionId: "02d02e9e-12bf-4587-bf05-3f5baf9d85fe",
    planId: plan.id,
    planVersion: 2,
    decisions: [{ sectionId: "arquitectura", kind: "option", optionId: 1 }],
  });
  assert.throws(() => assertSubmissionMatchesPlan(submission, plan), /plan vigente/);
});

test("rechaza Otra cuando la sección no lo permite", () => {
  const noOtherPlan = PlanSchema.parse({
    ...plan,
    sections: [{ ...plan.sections[0], allowOther: false }],
  });
  const submission = DecisionSubmissionSchema.parse({
    submissionId: "02d02e9e-12bf-4587-bf05-3f5baf9d85fe",
    planId: plan.id,
    planVersion: 1,
    decisions: [{ sectionId: "arquitectura", kind: "other", otherText: "Mi alternativa" }],
  });
  assert.throws(() => assertSubmissionMatchesPlan(submission, noOtherPlan), /no permite/);
});
