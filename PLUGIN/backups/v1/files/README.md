# Plan Viewer Plugin

Proyecto independiente para evolucionar Plan Viewer a un plugin MCP con UI MCP Apps embebida en ChatGPT/Codex.

**No sustituye ni modifica el Plan Viewer existente.** Todo lo que pertenece a este proyecto vive bajo `PLUGIN/`. La habilidad clásica y su backup continúan en sus rutas actuales.

## Estructura

```text
PLUGIN/
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
├── plans/
│   ├── plan-viewer-plugin-mcp-20260825-1129-k7m4.json
│   └── decisions/
├── data/
│   ├── current.json
│   ├── plans/
│   └── decisions/
├── tests/
└── backups/v1/
```

`plans/` conserva documentos de diseño/aprobación. `data/` es almacenamiento operativo del plugin. `backups/v1/files/` contiene un snapshot autocontenido de todos los archivos del plugin excepto el propio directorio `backups/`, para evitar una copia recursiva.

## Tools

### `present_plan`

Tool visible al modelo y a la app.

- valida el plan;
- crea o actualiza `PLUGIN/data/plans/<id>.json`;
- usa SHA optimista para actualizaciones;
- refleja el plan en `PLUGIN/data/current.json` si no existe una carrera;
- devuelve el plan mediante `structuredContent`;
- abre `ui://plan-viewer/v1.html`.

### `submit_plan_decisions`

Tool visible solo para la app.

- exige `planId` y `planVersion` exactos;
- exige una decisión por sección;
- valida `option`, `skip` y `other`;
- persiste una submission inmutable en `PLUGIN/data/decisions/<planId>/<submissionId>.json`;
- devuelve resumen textual y datos estructurados.

La UI llama este tool directamente y después usa `ui/update-model-context` y `ui/message` para que el modelo pueda continuar sin copiar/pegar.

## Almacenamiento y concurrencia

GitHub es el backend inicial. El servidor MCP es el único componente que escribe.

Variables:

```text
GITHUB_TOKEN                 obligatorio para escrituras
PLAN_VIEWER_PLUGIN_REPO      default: ddadda69/GPT_DUDAS
PLAN_VIEWER_PLUGIN_BRANCH    default: main
PLAN_VIEWER_PLUGIN_ROOT      default: PLUGIN
PORT                         default: 3001
```

Antes de cualquier escritura se consulta `/user` y se exige que el login autenticado sea `ddadda69`.

`current.json` es un espejo. El SHA se captura antes de publicar el archivo canónico; si otro proceso cambia el espejo entretanto, se conserva el plan canónico y no se fuerza `current`.

## Desarrollo local

Requisitos: Node.js 20.19+ (o Node 22.12+).

```bash
cd PLUGIN
npm install
npm run build
npm test
```

Para Codex/MCP por stdio, `.mcp.json` ejecuta:

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

1. Construye el proyecto.
2. Despliega el servidor MCP en HTTPS público.
3. Activa Developer Mode en ChatGPT.
4. Registra el endpoint `/mcp`.
5. Cuando ChatGPT asigne el identificador de app/plugin registrado, crea `.app.json` con ese ID si se quiere empaquetar la conexión dentro del plugin.

`.app.json` **no está inventado ni incluido todavía** porque su identificador lo entrega ChatGPT al registrar el servidor.

## Build de UI

La UI usa React y `@modelcontextprotocol/ext-apps/react`. Vite + `vite-plugin-singlefile` genera `web/dist/mcp-app.html`, un único recurso HTML apropiado para MCP Apps.

La UI:

- recibe el plan por el resultado inicial de `present_plan`;
- permite radios, **No implementar**, **Otra**, notas y edición Markdown;
- sanea Markdown con DOMPurify;
- llama `submit_plan_decisions`;
- actualiza el contexto del modelo con la submission;
- solicita el siguiente turno con `ui/message`.

## Estado de esta versión

`0.1.0` implementa el núcleo, persistencia, UI y empaquetado fuente. La conexión real con ChatGPT requiere el paso de despliegue/registro externo anterior; no se incluyen credenciales ni IDs inventados.
