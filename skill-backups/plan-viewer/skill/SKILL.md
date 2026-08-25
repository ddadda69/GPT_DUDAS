---
name: plan-viewer
description: "Crea planes, propuestas de implementación y refactors complejos, entrega siempre el contenido completo en el chat y publica una copia interactiva segura en GPT_DUDAS Plan Viewer. Usar cuando el usuario pida un plan, una propuesta de implementación, un refactor importante o varios cambios complejos; no usar para tareas simples, listas breves ni informes de estado."
---

# Plan Viewer

Redacta primero la respuesta que sería más útil en la conversación. Después adapta ese mismo contenido al Viewer. El Viewer se adapta al plan normal; nunca recortes ni deformes el plan para hacerlo interactivo.

## Fuentes canónicas

- Repositorio: `ddadda69/GPT_DUDAS`.
- Rama: `main`.
- Esquema autoritativo: `data/schema.json`.
- Ejemplo: `data/example.json`.
- Plan canónico: `data/plans/<id>.json`.
- URL estable: `https://ddadda69.github.io/GPT_DUDAS/?plan=<id>`.
- Último plan: `data/current.json`; la URL raíz lo muestra sin parámetros.

Antes de generar JSON, lee por completo `references/schema.json`. Usa `references/example.json` como ejemplo local. Cuando GitHub esté disponible, lee siempre el esquema remoto de `main` antes de publicar; el remoto es la autoridad.

## Contrato actual

No mantengas formatos antiguos ni discriminadores de tipo. Cada sección representa directamente una decisión.

Cada sección:

- tiene `id`, `title`, `options` y `defaultOption`;
- contiene **una o dos opciones como máximo**;
- numera las opciones exactamente como `1` y, si existe, `2`;
- tiene exactamente una opción `recommended: true`, que debe coincidir con `defaultOption`;
- usa una segunda opción únicamente si existe una alternativa real que cambie de forma relevante la implementación;
- puede usar `allowOther: true` si tiene sentido que el usuario redacte una alternativa completa;
- muestra Nota salvo que `allowNote` sea `false`.

El Viewer añade por interfaz **No implementar**, **Editar** y **Nota**; no los representes como opciones JSON.

## Identidad y versiones

El `id` del plan:

- es estable durante toda la vida del plan;
- coincide exactamente con `data/plans/<id>.json`;
- cumple `^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$`;
- para un plan nuevo debe ser suficientemente único, preferiblemente `<slug-tema>-YYYYMMDD-HHMMSS-<sufijo-corto>`;
- nunca se deduce mirando `data/current.json` ni buscando títulos parecidos.

Un plan nuevo empieza en `version: 1`. Para actualizar uno existente, lee su archivo canónico, verifica el `id` y usa exactamente `version remota + 1`.

## Flujo de publicación

1. Si GitHub está disponible, lee `data/current.json` **antes de preparar el plan** y conserva su SHA como `currentBaselineSha`.
2. Investiga lo necesario y redacta el plan completo para la conversación.
3. Convierte exactamente ese contenido al esquema actual, sin inventar alternativas.
4. Decide si es nuevo o continuación de un plan identificado con certeza.
5. Usa exactamente `$schema: "https://ddadda69.github.io/GPT_DUDAS/data/schema.json"`.
6. Valida el JSON con `scripts/validate_plan.py --expected-id <id>` cuando haya Python disponible.
7. Si no hay Python, valida manualmente todos los requisitos del esquema remoto y además:
   - una o dos opciones por sección;
   - IDs de opción consecutivos desde 1;
   - IDs de sección únicos;
   - `recommended: true` único y coincidente con `defaultOption`;
   - nombre `<id>.json` idéntico al `id` interno.
8. Antes de cualquier escritura verifica que la cuenta autenticada sea exactamente `ddadda69`.
9. Publica primero el archivo canónico:
   - plan nuevo: confirma inmediatamente antes que `data/plans/<id>.json` no existe y créalo; si ya existe, genera otro `id`;
   - plan existente: vuelve a leer exactamente `data/plans/<id>.json` y actualízalo usando el SHA recibido;
   - nunca fuerces un conflicto ni hagas overwrite ciego.
10. Vuelve a leer el archivo canónico y verifica `id`, `version`, título, número de secciones, contenido y SHA.
11. Solo después intenta copiar exactamente el mismo JSON a `data/current.json` usando `currentBaselineSha`:
    - no sustituyas el baseline por un SHA más nuevo justo antes de escribir;
    - si otro chat modificó `current.json`, no fuerces ni reintentes el overwrite;
    - un conflicto en `current.json` no invalida la publicación canónica del plan.
12. Si el espejo se actualizó, vuelve a leer `data/current.json` y verifica que coincide con el plan canónico.
13. Entrega en el chat el plan completo, indica por separado el estado del archivo canónico y de `current.json`, y termina con la URL estable `?plan=<id>`. Si el espejo se actualizó, puedes indicar también que la URL raíz muestra ese plan.

## Reglas de adaptación

- Conserva todo el Markdown útil: párrafos, listas, tablas, negrita, código, bloques y enlaces.
- No inventes decisiones para añadir interactividad.
- Si solo existe una solución razonable, usa una única opción `id: 1`, `recommended: true`, `defaultOption: 1` y normalmente `allowOther: false`.
- Si existen dos alternativas reales, usa `id: 1` para la recomendada y `id: 2` para la alternativa, salvo que técnicamente recomiendes la segunda; `defaultOption` y `recommended` deben reflejar la recomendación real.
- No fuerces un número fijo de secciones.

## Concurrencia

Los archivos de `data/plans/` son la fuente de verdad y aíslan conversaciones distintas. El SHA del archivo canónico es el bloqueo optimista cuando dos procesos intentan modificar el mismo `id`.

`data/current.json` es deliberadamente compartido y solo representa el último plan en el caso normal. Si dos publicaciones parten del mismo `currentBaselineSha`, como máximo una debe actualizar el espejo. La otra conserva intacto su archivo canónico y su URL estable.

## Fallos

Si faltan permisos, conexión o validación, entrega igualmente el plan completo en el chat y explica qué parte no se publicó. No enlaces al Viewer como si contuviera un plan que no está verificado.

No abras el navegador automáticamente. Una petición de plan autoriza únicamente la publicación de su archivo canónico y, cuando corresponda, la actualización segura de `data/current.json`; no autoriza modificar el Viewer, el esquema ni documentación.
