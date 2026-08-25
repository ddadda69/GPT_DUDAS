# Plan Viewer Plugin

Raíz instalable del plugin `plan-viewer-plugin`. Es independiente del Plan Viewer clásico y no usa `skill-backups/plan-viewer/`, el Viewer web raíz ni `data/` del repositorio como almacenamiento de usuarios.

## Arquitectura 0.2.0

Un único plugin, dos modos de ejecución:

```text
Codex / desarrollo                ChatGPT / producción
-----------------                 --------------------
MCP stdio local                   MCP Streamable HTTP HTTPS
identidad local opaca             OAuth/OIDC bearer token
SQLite .local/plan-viewer.db      PostgreSQL
sin servidor manual               servidor desplegado 24/7
```

Los planes y decisiones de usuarios **no se escriben en GitHub**. `PLUGIN/plans/` contiene únicamente planes de diseño del propio proyecto.

## Seguridad multiusuario

El cliente nunca envía `ownerId`. El servidor lo obtiene de la capa de identidad:

- `stdio`: `PLAN_VIEWER_LOCAL_USER` se transforma en un identificador opaco SHA-256;
- HTTP: se valida el JWT OAuth contra `OIDC_ISSUER`, `OIDC_AUDIENCE` y `OIDC_JWKS_URI`; el `sub` se combina con el issuer y se transforma en un identificador opaco.

PostgreSQL aplica dos barreras simultáneas:

1. todas las consultas filtran explícitamente por `owner_id`;
2. las tablas usan PostgreSQL Row Level Security (`ENABLE` + `FORCE ROW LEVEL SECURITY`) con `plan_viewer.owner_id` establecido mediante `set_config` dentro de cada transacción.

Aunque un usuario conociera el `planId` de otro, las consultas se ejecutan en su propio `owner_id` y no devuelven el plan ajeno.

## Persistencia

### Local / Codex

SQLite integrado en Node 22 mediante `node:sqlite`:

```text
.local/plan-viewer.db
```

La carpeta `.local/` está ignorada por Git. Se usa `BEGIN IMMEDIATE`, `WAL`, claves compuestas por propietario y plan, versionado optimista e idempotencia de submissions.

### Producción / ChatGPT

PostgreSQL mediante `DATABASE_URL`. Las tablas se crean de forma idempotente al arrancar y son:

- `plans`
- `current_plans`
- `decisions`

Las escrituras del mismo plan/submission se serializan con advisory locks de PostgreSQL para evitar carreras incluso en inserciones nuevas.

## OAuth para el MCP HTTPS

El servidor HTTP actúa únicamente como **OAuth Resource Server**: valida access tokens; no emite contraseñas ni tokens.

Variables obligatorias:

```text
DATABASE_URL
PUBLIC_BASE_URL=https://planviewer.example.com
OIDC_ISSUER=https://auth.example.com/
OIDC_AUDIENCE=https://planviewer.example.com
OIDC_JWKS_URI=https://auth.example.com/.well-known/jwks.json
```

Opcionales:

```text
OIDC_AUTHORIZATION_SERVER   # por defecto OIDC_ISSUER
OIDC_REQUIRED_SCOPES        # separados por espacios o comas
PORT                        # default 3001
PLAN_VIEWER_STORAGE         # inferido: sqlite en stdio, postgres en HTTP
```

El servidor publica Protected Resource Metadata (RFC 9728) en:

```text
/.well-known/oauth-protected-resource
/.well-known/oauth-protected-resource/mcp
```

Una llamada a `/mcp` sin token válido recibe `401` y un `WWW-Authenticate` que apunta al documento de metadata. Esto permite al cliente MCP descubrir el proveedor OAuth.

## Tools

### `present_plan`

- valida el plan;
- obtiene el propietario de la identidad ya autenticada;
- guarda/actualiza el plan solo dentro de ese propietario;
- exige incremento exacto de versión cuando cambia el contenido;
- presenta `ui://plan-viewer/v1.html`.

### `submit_plan_decisions`

- no acepta ningún owner/user id;
- carga el plan dentro del propietario autenticado;
- exige `planId` y `planVersion` exactos;
- persiste cada `submissionId` de forma inmutable e idempotente;
- devuelve el resumen a la UI/modelo.

## Desarrollo local con Codex

Requisitos: Node.js 22.13+ (`node:sqlite` está habilitado sin flag desde 22.13).

```bash
cd PLUGIN/plan-viewer-plugin
npm install
npm run build
npm test
```

`.mcp.json` configura Codex para lanzar automáticamente:

```bash
node server-dist/main.js --stdio
```

con SQLite local. No hace falta arrancar un servidor HTTP para probar el plugin en Codex.

## Servidor HTTP

En producción:

```bash
NODE_ENV=production \
DATABASE_URL='postgresql://...' \
PUBLIC_BASE_URL='https://planviewer.example.com' \
OIDC_ISSUER='https://...' \
OIDC_AUDIENCE='https://planviewer.example.com' \
OIDC_JWKS_URI='https://.../jwks.json' \
node server-dist/main.js
```

Endpoints:

```text
GET  /healthz
ALL  /mcp
GET  /.well-known/oauth-protected-resource
GET  /.well-known/oauth-protected-resource/mcp
```

## Hosting barato compartido

Un hosting de dominio económico puede servir **solo si** permite simultáneamente:

- Node.js 22.13+ con procesos persistentes (no solo PHP/CGI);
- variables de entorno/secrets;
- HTTPS público;
- conexiones salientes al proveedor OAuth;
- PostgreSQL accesible desde el proceso (local o remoto);
- que el proceso no sea suspendido al terminar una petición.

Los hostings compartidos muy baratos suelen incluir PHP + MySQL/MariaDB pero no procesos Node persistentes. En ese caso el dominio puede seguir usándose como DNS (`planviewer.tudominio.es`) y apuntar el subdominio al servicio donde se despliegue el MCP. La base de datos puede estar en otro proveedor PostgreSQL.

## GitHub

GitHub queda exclusivamente para:

- código fuente;
- backups del plugin;
- planes/decisiones de desarrollo del propio plugin.

No se utiliza como base de datos de usuarios y el runtime 0.2.0 no necesita `GITHUB_TOKEN`.

## Estado

La arquitectura de aislamiento está implementada, pero antes de publicar hay que ejecutar el build/tests reales con dependencias instaladas y elegir/configurar un proveedor OAuth y un PostgreSQL reales. No se guardan secretos ni identificadores OAuth inventados en el repositorio.
