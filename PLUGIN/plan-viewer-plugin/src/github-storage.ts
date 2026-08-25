import {
  DecisionSubmissionSchema,
  PlanSchema,
  assertSubmissionMatchesPlan,
  type DecisionSubmission,
  type Plan,
} from "./schema.js";

type GitHubContentFile = {
  content?: string;
  encoding?: string;
  sha: string;
};

type JsonFile<T> = {
  value: T;
  sha: string;
};

export type SavePlanResult = {
  canonicalSha: string;
  currentUpdated: boolean;
  currentSha?: string;
};

const DEFAULT_REPO = "ddadda69/GPT_DUDAS";
const DEFAULT_BRANCH = "main";
const DEFAULT_ROOT = "PLUGIN/plan-viewer-plugin";

function getConfig() {
  return {
    repo: process.env.PLAN_VIEWER_PLUGIN_REPO || DEFAULT_REPO,
    branch: process.env.PLAN_VIEWER_PLUGIN_BRANCH || DEFAULT_BRANCH,
    root: (process.env.PLAN_VIEWER_PLUGIN_ROOT || DEFAULT_ROOT).replace(/^\/+|\/+$/g, ""),
    token: process.env.GITHUB_TOKEN,
  };
}

function encodePath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}

function jsonText(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function contentUrl(path: string): string {
  const { repo, branch } = getConfig();
  return `https://api.github.com/repos/${repo}/contents/${encodePath(path)}?ref=${encodeURIComponent(branch)}`;
}

function headers(write = false): HeadersInit {
  const { token } = getConfig();
  const result: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (write) result["Content-Type"] = "application/json";
  if (token) result.Authorization = `Bearer ${token}`;
  return result;
}

let identityPromise: Promise<void> | undefined;

async function assertWriteIdentity(): Promise<void> {
  if (identityPromise) return identityPromise;
  identityPromise = (async () => {
    const { token } = getConfig();
    if (!token) {
      throw new Error("GITHUB_TOKEN es obligatorio para escribir planes o decisiones. No se guardan credenciales en el repositorio.");
    }
    const response = await fetch("https://api.github.com/user", { headers: headers() });
    if (!response.ok) throw new Error(`No se pudo verificar la identidad de GitHub: ${await errorMessage(response)}`);
    const profile = await response.json() as { login?: string };
    if (profile.login !== "ddadda69") {
      throw new Error(`La cuenta autenticada de GitHub debe ser ddadda69; se recibió ${profile.login || "desconocida"}.`);
    }
  })();
  return identityPromise;
}

async function errorMessage(response: Response): Promise<string> {
  try {
    const body = await response.json() as { message?: string };
    return body.message || `HTTP ${response.status}`;
  } catch {
    return `HTTP ${response.status}`;
  }
}

async function readJson<T>(path: string): Promise<JsonFile<T> | null> {
  const response = await fetch(contentUrl(path), { headers: headers(), cache: "no-store" });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`GitHub no pudo leer ${path}: ${await errorMessage(response)}`);

  const file = await response.json() as GitHubContentFile;
  if (!file.content || !file.sha) throw new Error(`GitHub devolvió un contenido incompleto para ${path}.`);
  const decoded = Buffer.from(file.content.replace(/\s/g, ""), "base64").toString("utf8");
  return { value: JSON.parse(decoded) as T, sha: file.sha };
}

async function writeJson(path: string, value: unknown, sha?: string): Promise<string> {
  const { repo, branch } = getConfig();
  await assertWriteIdentity();

  const [owner, name] = repo.split("/");
  if (!owner || !name) throw new Error(`Repositorio inválido: ${repo}`);

  const body: Record<string, unknown> = {
    message: `Plan Viewer Plugin: actualizar ${path}`,
    content: Buffer.from(jsonText(value), "utf8").toString("base64"),
    branch,
  };
  if (sha) body.sha = sha;

  const response = await fetch(`https://api.github.com/repos/${owner}/${name}/contents/${encodePath(path)}`, {
    method: "PUT",
    headers: headers(true),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const message = await errorMessage(response);
    if (response.status === 409 || response.status === 422) {
      throw new Error(`Conflicto al escribir ${path}: ${message}`);
    }
    throw new Error(`GitHub no pudo escribir ${path}: ${message}`);
  }

  const result = await response.json() as { content?: { sha?: string } };
  const resultingSha = result.content?.sha;
  if (!resultingSha) throw new Error(`GitHub no devolvió el SHA final de ${path}.`);
  return resultingSha;
}

function pluginPath(relative: string): string {
  const { root } = getConfig();
  return `${root}/${relative}`.replace(/\/+/g, "/");
}

function planPath(id: string): string {
  return pluginPath(`data/plans/${id}.json`);
}

function currentPath(): string {
  return pluginPath("data/current.json");
}

export async function loadPlan(id: string): Promise<{ plan: Plan; sha: string }> {
  const file = await readJson<unknown>(planPath(id));
  if (!file) throw new Error(`No existe el plan ${id}.`);
  const plan = PlanSchema.parse(file.value);
  if (plan.id !== id) throw new Error(`El id interno ${plan.id} no coincide con ${id}.`);
  return { plan, sha: file.sha };
}

export async function savePlan(input: unknown): Promise<SavePlanResult> {
  const plan = PlanSchema.parse(input);
  const canonicalPath = planPath(plan.id);
  const mirrorPath = currentPath();

  const currentBaseline = await readJson<unknown>(mirrorPath);
  const remote = await readJson<unknown>(canonicalPath);

  let canonicalSha: string;
  if (remote) {
    const remotePlan = PlanSchema.parse(remote.value);
    if (remotePlan.id !== plan.id) throw new Error(`El archivo remoto contiene un id distinto: ${remotePlan.id}.`);

    const identical = jsonText(remotePlan) === jsonText(plan);
    if (!identical && plan.version !== remotePlan.version + 1) {
      throw new Error(`Versión inválida para ${plan.id}: remoto v${remotePlan.version}, recibido v${plan.version}.`);
    }
    canonicalSha = identical ? remote.sha : await writeJson(canonicalPath, plan, remote.sha);
  } else {
    if (plan.version !== 1) {
      throw new Error(`Un plan nuevo debe empezar en version 1; se recibió v${plan.version}.`);
    }
    canonicalSha = await writeJson(canonicalPath, plan);
  }

  const verified = await readJson<unknown>(canonicalPath);
  if (!verified || verified.sha !== canonicalSha) throw new Error("No se pudo verificar el plan canónico después de escribirlo.");
  const verifiedPlan = PlanSchema.parse(verified.value);
  if (jsonText(verifiedPlan) !== jsonText(plan)) throw new Error("El plan verificado no coincide con el publicado.");

  if (currentBaseline && jsonText(currentBaseline.value) === jsonText(plan)) {
    return { canonicalSha, currentUpdated: true, currentSha: currentBaseline.sha };
  }

  let currentUpdated = false;
  let currentSha: string | undefined;
  try {
    currentSha = await writeJson(mirrorPath, plan, currentBaseline?.sha);
    const mirrored = await readJson<unknown>(mirrorPath);
    if (!mirrored || mirrored.sha !== currentSha || jsonText(PlanSchema.parse(mirrored.value)) !== jsonText(plan)) {
      throw new Error("current.json no coincide con el plan tras actualizarlo.");
    }
    currentUpdated = true;
  } catch (error) {
    const text = error instanceof Error ? error.message : String(error);
    if (!text.startsWith("Conflicto al escribir")) throw error;
  }

  return { canonicalSha, currentUpdated, currentSha };
}

export async function saveDecision(submission: DecisionSubmission): Promise<{ sha: string; created: boolean }> {
  const checked = DecisionSubmissionSchema.parse(submission);
  const { plan } = await loadPlan(checked.planId);
  assertSubmissionMatchesPlan(checked, plan);

  const path = pluginPath(`data/decisions/${checked.planId}/${checked.submissionId}.json`);
  const existing = await readJson<DecisionSubmission>(path);
  if (existing) {
    if (jsonText(existing.value) !== jsonText(checked)) {
      throw new Error(`submissionId ${checked.submissionId} ya existe con otro contenido.`);
    }
    return { sha: existing.sha, created: false };
  }

  const sha = await writeJson(path, checked);
  const verified = await readJson<DecisionSubmission>(path);
  if (!verified || verified.sha !== sha || jsonText(verified.value) !== jsonText(checked)) {
    throw new Error("No se pudo verificar la decisión guardada.");
  }
  return { sha, created: true };
}
