import type { App, McpUiHostContext } from "@modelcontextprotocol/ext-apps";
import { useApp } from "@modelcontextprotocol/ext-apps/react";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import DOMPurify from "dompurify";
import { marked } from "marked";
import { StrictMode, useCallback, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

type PlanOption = { id: 1 | 2; text: string; recommended?: boolean };
type PlanSection = {
  id: string;
  title: string;
  description?: string;
  options: PlanOption[];
  defaultOption: 1 | 2;
  allowOther?: boolean;
  allowNote?: boolean;
  noteLabel?: string;
  notePlaceholder?: string;
};
type Plan = {
  id: string;
  version: number;
  title: string;
  description?: string;
  sections: PlanSection[];
};

type Choice =
  | { kind: "option"; optionId: 1 | 2 }
  | { kind: "skip" }
  | { kind: "other" };

type Draft = {
  choice: Choice;
  edits: Partial<Record<1 | 2, string>>;
  otherText: string;
  note: string;
};

const APP_INFO = { name: "Plan Viewer Plugin UI", version: "0.1.0" };

function isPlan(value: unknown): value is Plan {
  if (!value || typeof value !== "object") return false;
  const plan = value as Partial<Plan>;
  if (typeof plan.id !== "string" || !Number.isInteger(plan.version) || typeof plan.title !== "string" || !Array.isArray(plan.sections)) return false;
  return plan.sections.length > 0 && plan.sections.every((section) =>
    section &&
    typeof section.id === "string" &&
    typeof section.title === "string" &&
    Array.isArray(section.options) &&
    section.options.length >= 1 &&
    section.options.length <= 2 &&
    section.options.every((option) => (option.id === 1 || option.id === 2) && typeof option.text === "string") &&
    (section.defaultOption === 1 || section.defaultOption === 2),
  );
}

function extractPlan(result: CallToolResult | null): Plan | null {
  const structured = result?.structuredContent as { plan?: unknown } | undefined;
  return isPlan(structured?.plan) ? structured.plan : null;
}

function Markdown({ children, inline = false }: { children?: string; inline?: boolean }) {
  const html = useMemo(() => {
    const source = children ?? "";
    const parsed = inline ? marked.parseInline(source) : marked.parse(source);
    return DOMPurify.sanitize(String(parsed));
  }, [children, inline]);
  const Tag = inline ? "span" : "div";
  return <Tag className="markdown" dangerouslySetInnerHTML={{ __html: html }} />;
}

function initialDrafts(plan: Plan): Record<string, Draft> {
  return Object.fromEntries(plan.sections.map((section) => [
    section.id,
    {
      choice: { kind: "option", optionId: section.defaultOption },
      edits: {},
      otherText: "",
      note: "",
    },
  ]));
}

function PlanViewer({ app, plan, hostContext }: { app: App; plan: Plan; hostContext?: McpUiHostContext }) {
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() => initialDrafts(plan));
  const [editing, setEditing] = useState<{ sectionId: string; optionId: 1 | 2 } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<string>("");
  const [error, setError] = useState<string>("");

  useEffect(() => {
    setDrafts(initialDrafts(plan));
    setEditing(null);
    setStatus("");
    setError("");
  }, [plan.id, plan.version]);

  const mutate = useCallback((sectionId: string, fn: (draft: Draft) => Draft) => {
    setDrafts((current) => ({ ...current, [sectionId]: fn(current[sectionId]) }));
  }, []);

  const startEdit = (section: PlanSection, option: PlanOption) => {
    const current = drafts[section.id].edits[option.id] ?? option.text;
    mutate(section.id, (draft) => ({ ...draft, choice: { kind: "option", optionId: option.id } }));
    setEditing({ sectionId: section.id, optionId: option.id });
    setEditValue(current);
  };

  const saveEdit = () => {
    if (!editing || !editValue.trim()) return;
    mutate(editing.sectionId, (draft) => ({
      ...draft,
      edits: { ...draft.edits, [editing.optionId]: editValue },
      choice: { kind: "option", optionId: editing.optionId },
    }));
    setEditing(null);
  };

  const submit = async () => {
    setSubmitting(true);
    setError("");
    setStatus("Guardando decisiones…");
    try {
      const decisions = plan.sections.map((section) => {
        const draft = drafts[section.id];
        if (draft.choice.kind === "other" && !draft.otherText.trim()) {
          throw new Error(`Escribe la alternativa de “Otra” en «${section.title}».`);
        }
        if (draft.choice.kind === "option") {
          const original = section.options.find((option) => option.id === draft.choice.optionId)!;
          const edited = draft.edits[draft.choice.optionId]?.trim();
          return {
            sectionId: section.id,
            kind: "option" as const,
            optionId: draft.choice.optionId,
            ...(edited && edited !== original.text ? { editedText: edited } : {}),
            ...(draft.note.trim() ? { note: draft.note.trim() } : {}),
          };
        }
        if (draft.choice.kind === "other") {
          return {
            sectionId: section.id,
            kind: "other" as const,
            otherText: draft.otherText.trim(),
            ...(draft.note.trim() ? { note: draft.note.trim() } : {}),
          };
        }
        return {
          sectionId: section.id,
          kind: "skip" as const,
          ...(draft.note.trim() ? { note: draft.note.trim() } : {}),
        };
      });

      const submission = {
        submissionId: crypto.randomUUID(),
        planId: plan.id,
        planVersion: plan.version,
        decisions,
      };

      const result = await app.callServerTool({
        name: "submit_plan_decisions",
        arguments: { submission },
      });
      const structured = result.structuredContent as { accepted?: boolean; summary?: string; submission?: unknown } | undefined;
      if (!structured?.accepted || typeof structured.summary !== "string") {
        throw new Error(result.content?.find((item) => item.type === "text")?.text ?? "El servidor no confirmó las decisiones.");
      }

      setStatus("Decisiones guardadas. Devolviéndolas a ChatGPT…");
      try {
        await app.updateModelContext({
          content: [{ type: "text", text: structured.summary }],
          structuredContent: {
            planViewerDecision: {
              planId: plan.id,
              planVersion: plan.version,
              submissionId: submission.submissionId,
              decisions,
            },
          },
        });

        const messageResult = await app.sendMessage({
          role: "user",
          content: [{
            type: "text",
            text: `Aplica las decisiones ya confirmadas del Plan Viewer para ${plan.id} v${plan.version}. Usa el contexto estructurado del componente; no vuelvas a pedirme las elecciones.`,
          }],
        });
        setStatus(messageResult.isError
          ? "Decisiones guardadas. El host no inició el turno automáticamente; puedes continuar escribiendo en el chat."
          : "Decisiones guardadas y enviadas a ChatGPT.");
      } catch {
        setStatus("Decisiones guardadas. Este host no pudo iniciar el siguiente turno automáticamente.");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      setStatus("");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main
      className="shell"
      style={{
        paddingTop: hostContext?.safeAreaInsets?.top,
        paddingRight: hostContext?.safeAreaInsets?.right,
        paddingBottom: hostContext?.safeAreaInsets?.bottom,
        paddingLeft: hostContext?.safeAreaInsets?.left,
      }}
    >
      <header className="plan-header">
        <h1><Markdown inline>{plan.title}</Markdown></h1>
        {plan.description && <Markdown>{plan.description}</Markdown>}
        <div className="meta">{plan.id} · v{plan.version}</div>
      </header>

      {plan.sections.map((section, sectionIndex) => {
        const draft = drafts[section.id];
        return (
          <section className="card" key={section.id}>
            <h2><Markdown inline>{section.title}</Markdown></h2>
            {section.description && <div className="description"><Markdown>{section.description}</Markdown></div>}

            {section.options.map((option) => {
              const selected = draft.choice.kind === "option" && draft.choice.optionId === option.id;
              const custom = draft.edits[option.id];
              const isEditing = editing?.sectionId === section.id && editing.optionId === option.id;
              return (
                <div className={`option-row${selected ? " selected" : ""}`} key={option.id}>
                  <input
                    aria-label={`Opción ${option.id}`}
                    type="radio"
                    name={`section-${sectionIndex}`}
                    checked={selected}
                    onChange={() => mutate(section.id, (value) => ({ ...value, choice: { kind: "option", optionId: option.id } }))}
                  />
                  <div className="option-content">
                    {section.options.length > 1 && <div className="option-label">Opción {option.id}{option.recommended ? " · Recomendada" : ""}</div>}
                    {isEditing ? (
                      <>
                        <textarea className="editor" value={editValue} onChange={(event) => setEditValue(event.target.value)} rows={10} />
                        <div className="editor-actions">
                          <button type="button" onClick={saveEdit}>Guardar</button>
                          <button type="button" className="secondary" onClick={() => setEditing(null)}>Cancelar</button>
                        </div>
                      </>
                    ) : (
                      <div className="option-text" onClick={() => mutate(section.id, (value) => ({ ...value, choice: { kind: "option", optionId: option.id } }))}>
                        <Markdown>{custom ?? option.text}</Markdown>
                        {custom && custom !== option.text && <span className="badge">Editada</span>}
                      </div>
                    )}
                  </div>
                  {!isEditing && <button className="edit" type="button" onClick={() => startEdit(section, option)}>Editar</button>}
                </div>
              );
            })}

            <label className={`option-row compact${draft.choice.kind === "skip" ? " selected" : ""}`}>
              <input
                type="radio"
                name={`section-${sectionIndex}`}
                checked={draft.choice.kind === "skip"}
                onChange={() => mutate(section.id, (value) => ({ ...value, choice: { kind: "skip" } }))}
              />
              <span>No implementar</span>
            </label>

            {section.allowOther && (
              <div className={`option-row compact${draft.choice.kind === "other" ? " selected" : ""}`}>
                <input
                  aria-label="Otra"
                  type="radio"
                  name={`section-${sectionIndex}`}
                  checked={draft.choice.kind === "other"}
                  onChange={() => mutate(section.id, (value) => ({ ...value, choice: { kind: "other" } }))}
                />
                <div className="other">
                  <label>Otra</label>
                  {draft.choice.kind === "other" && (
                    <textarea
                      value={draft.otherText}
                      placeholder="Escribe tu alternativa completa…"
                      onChange={(event) => mutate(section.id, (value) => ({ ...value, otherText: event.target.value }))}
                      rows={4}
                    />
                  )}
                </div>
              </div>
            )}

            {section.allowNote !== false && (
              <label className="note">
                {section.noteLabel || "Nota"}
                <textarea
                  value={draft.note}
                  placeholder={section.notePlaceholder || "Añade un matiz opcional…"}
                  onChange={(event) => mutate(section.id, (value) => ({ ...value, note: event.target.value }))}
                  rows={3}
                />
              </label>
            )}
          </section>
        );
      })}

      <div className="sticky-actions">
        {error && <div role="alert" className="error">{error}</div>}
        {status && <div role="status" className="status">{status}</div>}
        <button type="button" className="primary" disabled={submitting} onClick={submit}>
          {submitting ? "Aplicando…" : "Aplicar decisiones y continuar"}
        </button>
      </div>
    </main>
  );
}

function AppRoot() {
  const [toolResult, setToolResult] = useState<CallToolResult | null>(null);
  const [hostContext, setHostContext] = useState<McpUiHostContext | undefined>();

  const { app, error } = useApp({
    appInfo: APP_INFO,
    capabilities: {},
    onAppCreated: (instance) => {
      instance.ontoolresult = (result) => setToolResult(result);
      instance.onhostcontextchanged = (params) => setHostContext((previous) => ({ ...previous, ...params }));
    },
  });

  useEffect(() => {
    if (app) setHostContext(app.getHostContext());
  }, [app]);

  if (error) return <div className="fatal">No se pudo iniciar Plan Viewer: {error.message}</div>;
  if (!app) return <div className="loading">Conectando Plan Viewer…</div>;

  const plan = extractPlan(toolResult);
  if (!plan) return <div className="loading">Esperando el plan…</div>;
  return <PlanViewer app={app} plan={plan} hostContext={hostContext} />;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppRoot />
  </StrictMode>,
);
