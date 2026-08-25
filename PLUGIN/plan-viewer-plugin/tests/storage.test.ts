import assert from "node:assert/strict";
import test from "node:test";
import type { DecisionSubmission, Plan } from "../src/schema.js";
import { SqlitePlanStorage } from "../src/storage/sqlite-storage.js";

function plan(version = 1, text = "Recomendada"): Plan {
  return {
    id: "storage-isolation-test",
    version,
    title: "Storage isolation test",
    sections: [
      {
        id: "section-1",
        title: "Primera decisión",
        options: [
          { id: 1, text, recommended: true },
          { id: 2, text: "Alternativa" },
        ],
        defaultOption: 1,
        allowOther: true,
        allowNote: true,
      },
    ],
  };
}

function submission(note = "ok"): DecisionSubmission {
  return {
    submissionId: "02d02e9e-12bf-4587-bf05-3f5baf9d85fe",
    planId: "storage-isolation-test",
    planVersion: 1,
    decisions: [
      {
        sectionId: "section-1",
        kind: "option",
        optionId: 1,
        note,
      },
    ],
  };
}

test("SQLite aísla planes por propietario", async () => {
  const storage = new SqlitePlanStorage(":memory:");
  try {
    await storage.savePlan("owner:a", plan());
    const loaded = await storage.loadPlan("owner:a", "storage-isolation-test");
    assert.equal(loaded.plan.title, "Storage isolation test");
    await assert.rejects(
      storage.loadPlan("owner:b", "storage-isolation-test"),
      /No existe el plan/,
    );
  } finally {
    await storage.close();
  }
});

test("SQLite mantiene versionado optimista por propietario", async () => {
  const storage = new SqlitePlanStorage(":memory:");
  try {
    await storage.savePlan("owner:a", plan());
    await storage.savePlan("owner:a", plan());
    await assert.rejects(
      storage.savePlan("owner:a", plan(1, "Cambio sin subir versión")),
      /Versión inválida/,
    );
    const updated = await storage.savePlan("owner:a", plan(2, "Cambio v2"));
    assert.equal(updated.canonicalVersion, 2);
  } finally {
    await storage.close();
  }
});

test("SQLite hace las submissions inmutables e idempotentes", async () => {
  const storage = new SqlitePlanStorage(":memory:");
  try {
    await storage.savePlan("owner:a", plan());
    const first = await storage.saveDecision("owner:a", submission());
    assert.equal(first.created, true);
    const second = await storage.saveDecision("owner:a", submission());
    assert.equal(second.created, false);
    await assert.rejects(
      storage.saveDecision("owner:a", submission("contenido distinto")),
      /ya existe con otro contenido/,
    );
    await assert.rejects(
      storage.saveDecision("owner:b", submission()),
      /No existe el plan/,
    );
  } finally {
    await storage.close();
  }
});

test("dos actualizaciones v2 distintas no pueden ganar a la vez", async () => {
  const storage = new SqlitePlanStorage(":memory:");
  try {
    await storage.savePlan("owner:a", plan());
    const results = await Promise.allSettled([
      storage.savePlan("owner:a", plan(2, "v2 A")),
      storage.savePlan("owner:a", plan(2, "v2 B")),
    ]);
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    assert.equal(results.filter((result) => result.status === "rejected").length, 1);
  } finally {
    await storage.close();
  }
});
