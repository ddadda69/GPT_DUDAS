---
name: plan-viewer-plugin
description: "Usa el Plan Viewer Plugin MCP con UI embebida para presentar un plan y recoger decisiones estructuradas. Activar solo cuando el usuario pida explícitamente Plan Viewer Plugin, el viewer embebido o la experiencia MCP; no sustituye ni modifica la habilidad personal plan-viewer existente."
---

# Plan Viewer Plugin

Esta skill pertenece únicamente al proyecto independiente `PLUGIN/plan-viewer-plugin/`.

## Regla de coexistencia

- No modifiques, reemplaces ni sincronices automáticamente la habilidad personal `plan-viewer`.
- No escribas en `skill-backups/plan-viewer/`.
- No uses `data/plans/` ni `data/current.json` de la raíz como almacenamiento del plugin.
- El almacenamiento del plugin vive exclusivamente en `PLUGIN/plan-viewer-plugin/data/`.
- Si el usuario pide el Plan Viewer clásico, usa la habilidad clásica. Si pide el plugin o el Viewer embebido, usa esta skill.

## Flujo

1. Redacta el plan completo en la conversación. La UI es complementaria, no sustituye el contenido textual.
2. Genera un `id` estable y una `version` monotónica.
3. Construye el plan con una o dos opciones reales por sección. No inventes alternativas.
4. Llama a `present_plan` con el objeto completo.
5. El servidor valida y publica primero `PLUGIN/plan-viewer-plugin/data/plans/<id>.json` y usa `PLUGIN/plan-viewer-plugin/data/current.json` solo como espejo.
6. El usuario decide dentro de la UI.
7. La UI llama a `submit_plan_decisions`; el servidor valida plan, versión, secciones y opciones antes de persistir.
8. Cuando la UI devuelve el contexto de decisiones, continúa desde esas decisiones sin volver a preguntarlas.

## Concurrencia

- Cada plan tiene su propio archivo canónico.
- Una actualización solo se acepta si la versión es exactamente la siguiente y el SHA remoto sigue vigente.
- Un conflicto nunca se resuelve con overwrite forzado.
- `PLUGIN/plan-viewer-plugin/data/current.json` es no canónico: un conflicto en el espejo no invalida el archivo del plan.
- Las submissions usan UUID y son inmutables; reutilizar el mismo UUID con contenido distinto es un error.

## Seguridad

- Las credenciales de GitHub existen únicamente como variable `GITHUB_TOKEN` del proceso MCP.
- La UI nunca recibe tokens.
- Antes de escribir, el servidor verifica mediante GitHub que el token pertenece exactamente a `ddadda69`.
- No incluyas secretos en planes, decisiones, logs ni backups.

## Degradación

Si el host no soporta MCP Apps UI, `present_plan` sigue devolviendo texto y `structuredContent`. El plan no debe perderse. Si el host no admite `ui/message`, una submission ya guardada sigue siendo válida y el usuario puede continuar manualmente en la conversación.
