# Plan Viewer Plugin

Este directorio es la **raíz instalable** del plugin `plan-viewer-plugin`. Su nombre coincide deliberadamente con `plugin.json.name`, como exige el formato de plugins de Codex.

El proyecto es independiente del Plan Viewer clásico: no modifica ni depende en ejecución de `skill-backups/plan-viewer/`, del Viewer web raíz ni de `data/` en la raíz del repositorio. Los planes de diseño y backups de este proyecto viven un nivel por encima, en `PLUGIN/plans/` y `PLUGIN/backups/`.

## Estructura

```text
plan-viewer-plugin/
├── .codex-plugin/plugin.json
├── .mcp.json
├── contracts/
│   ├── plan.schema.json
│   └── decision.schema.json
├── src/
│   ├── schema.ts
│   ├── github-storage.ts
│   ├── server.ts
│   └── main.ts
├── web/
│   ├── mcp-app.html
│   ├── vite.config.ts
│   └── src/
│       ├── component.tsx
│       └── styles.css
├── skills/plan-viewer-plugin/SKILL.md
├── data/
│   ├── current.json
│   ├── plans/
│   └── decisions/
└── tests/
```

## Tools

### `present_plan`

Tool visible al modelo y a la app.

- valida el plan;
- crea o actualiza `PLUGIN/plan-viewer-plugin/data/plans/<id>.json`;
- usa SHA optimista para actualizaciones;
- refleja el plan en `PLUGIN/plan-viewer-plugin/data/current.json` si no existe una carrera;
- devuelve el plan mediante `structuredContent`;
- abre `ui://plan-viewer/v1.html`.

### `submit_plan_decisions`

Tool visible solo para la app.

- exige `planId` y `planVersion` exactos;
- exige una decisión por sección;
- valida `option`, `skip` y `other`;
- persiste una submission inmutable en `PLUGIN/plan-viewer-plugin/data/decisions/<planId>/<submissionId>.json`;
- devuelve resumen textual y datos estructurados.

La UI llama este tool directamente y después usa el contexto de MCP Apps y `ui/message` para que el modelo pueda continuar sin copiar/pegar.

## Almacenamiento y concurrencia

GitHub es el backend inicial. El servidor MCP es el único componente que escribe.

Variables:

```text
GITHUB_TOKEN                 obligatorio para escrituras
PLAN_VIEWER_PLUGIN_REPO      default: ddadda69/GPT_DUDAS
PLAN_VIEWER_PLUGIN_BRANCH    default: main
PLAN_VIEWER_PLUGIN_ROOT      default: PLUGIN/plan-viewer-plugin
PORT                         default: 3001
```

Antes de cualquier escritura se consulta `/user` y se exige que el login autenticado sea `ddadda69`.

`current.json` es un espejo. El SHA se captura antes de publicar el archivo canónico; si otro proceso cambia el espejo entretanto, se conserva el plan canónico y no se fuerza `current`.

## Desarrollo local

Requisitos: Node.js 20.19+ (o Node 22.12+).

```bash
cd PLUGIN/plan-viewer-plugin
npm install
npm run build
npm test
```

Después del build, `.mcp.json` ejecuta el servidor por stdio desde la propia raíz del plugin gracias a `cwd: "."`:

```bash
node server-dist/main.js --stdio
```

Para servidor HTTP:

```bash
GITHUB_TOKEN=... npm start
```

Endpoint MCP: `http://localhost:3001/mcp`  
Health: `http://localhost:3001/healthz`

No guardes el token en el repo ni en `.mcp.json`.

## Probar en ChatGPT

1. Instala dependencias, compila y ejecuta los tests.
2. Despliega el servidor MCP en HTTPS público.
3. Registra ese servidor en ChatGPT/Developer Mode.
4. Cuando ChatGPT asigne el identificador del servidor/app registrado, crea `.app.json` si quieres empaquetar esa conexión remota dentro del plugin.

`.app.json` no se incluye todavía porque no debe inventarse un identificador antes del registro real.

## Build de UI

La UI usa React y `@modelcontextprotocol/ext-apps/react`. Vite + `vite-plugin-singlefile` genera `web/dist/mcp-app.html`, un único recurso HTML para MCP Apps.

La UI:

- recibe el plan por el resultado inicial de `present_plan`;
- aplica estilos/tema proporcionados por el host;
- permite radios, **No implementar**, **Otra**, notas y edición Markdown;
- sanea Markdown con DOMPurify;
- llama `submit_plan_decisions`;
- actualiza el contexto del modelo con la submission;
- solicita el siguiente turno con `ui/message`.

## Estado de esta versión

`0.1.0` implementa el núcleo, persistencia, UI y empaquetado fuente. La conexión real con ChatGPT requiere despliegue/registro externo y el build completo requiere descargar dependencias npm; no se incluyen credenciales ni IDs inventados.
