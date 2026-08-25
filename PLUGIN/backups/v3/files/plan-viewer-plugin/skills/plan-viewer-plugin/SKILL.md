---
name: plan-viewer-plugin
description: "Usa el Plan Viewer Plugin MCP con UI embebida para presentar un plan y recoger decisiones estructuradas. Activar solo cuando el usuario pida explícitamente Plan Viewer Plugin, el viewer embebido o la experiencia MCP; no sustituye ni modifica la habilidad personal plan-viewer existente."
---

# Plan Viewer Plugin

Esta skill pertenece únicamente a `PLUGIN/plan-viewer-plugin/`.

## Regla de coexistencia

- No modifiques, reemplaces ni sincronices automáticamente la habilidad personal `plan-viewer`.
- No escribas en `skill-backups/plan-viewer/`.
- No uses el Viewer web clásico ni `data/` de la raíz como almacenamiento del plugin.
- Los planes de usuarios del plugin no se guardan en GitHub.
- `PLUGIN/plans/` contiene únicamente planes de diseño/desarrollo de este proyecto.

## Flujo

1. Redacta el plan completo también en la conversación; la UI es complementaria.
2. Genera un `id` estable y una `version` monotónica.
3. Construye una o dos opciones reales por sección, con recomendación cuando proceda.
4. Llama `present_plan` con el objeto completo.
5. El servidor obtiene el propietario de la identidad ya autenticada; nunca lo toma de argumentos del modelo o de la UI.
6. El usuario decide dentro de la UI.
7. La UI llama `submit_plan_decisions`; el servidor vuelve a resolver el mismo propietario y valida plan, versión, secciones y opciones.
8. Continúa desde las decisiones devueltas sin volver a pedirlas.

## Modos de ejecución

### Codex / desarrollo

- MCP local por `stdio`.
- Identidad local opaca derivada de `PLAN_VIEWER_LOCAL_USER`.
- SQLite en `.local/plan-viewer.db`.
- Codex arranca el servidor mediante `.mcp.json`.

### ChatGPT / producción

- MCP Streamable HTTP por HTTPS.
- OAuth/OIDC bearer token validado por issuer, audience y JWKS.
- PostgreSQL.
- El `sub` OAuth nunca se usa como argumento de tool: el servidor genera un `ownerId` opaco.

## Concurrencia

- Cada propietario tiene su propio espacio lógico de planes.
- Una modificación solo se acepta si la versión es exactamente la siguiente; contenido idéntico es idempotente.
- SQLite usa transacciones `BEGIN IMMEDIATE`.
- PostgreSQL usa transacciones + advisory locks para serializar plan/submission.
- Las submissions usan UUID y son inmutables: reutilizar el mismo UUID con contenido distinto es error.

## Seguridad multiusuario

- Nunca aceptes `ownerId`, `userId` o equivalente en los schemas públicos de tools.
- Todas las consultas filtran por `owner_id`.
- PostgreSQL además fuerza Row Level Security usando `plan_viewer.owner_id` por transacción.
- Una búsqueda de un plan ajeno debe comportarse como si no existiera.
- No incluyas tokens, subjects OAuth, secretos ni URLs con credenciales en planes, decisiones, logs o backups.

## Degradación

Si el host no soporta MCP Apps UI, `present_plan` sigue devolviendo texto y `structuredContent`. Si el host no admite `ui/message`, una submission ya guardada sigue siendo válida y el usuario puede continuar manualmente en la conversación.
