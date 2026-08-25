---
name: plan-viewer
description: "Crea planes, propuestas de implementación y refactors complejos, entrega el contenido completo en el chat y publica una copia interactiva compatible con GPT_DUDAS Plan Viewer. Usar cuando el usuario pida un plan, una propuesta de implementación, un refactor importante o varios cambios complejos; no usar para listas breves, informes de estado ni tareas simples que deban ejecutarse directamente."
---

# Plan Viewer

Redacta primero la respuesta que sería más útil en el chat. Después adapta ese
mismo contenido al Viewer. El Viewer debe adaptarse a la respuesta normal, no la
respuesta al Viewer.

## Fuentes canónicas

- Repositorio: `ddadda69/GPT_DUDAS`.
- Rama de publicación: `main`.
- Esquema remoto autoritativo: `data/schema.json`.
- Publicación normal: `data/plans/<id>.json`.
- URL de un plan: `https://ddadda69.github.io/GPT_DUDAS/?plan=<id>`.
- Compatibilidad legacy: `data/current.json` y la URL sin `?plan=`. No uses
  `data/current.json` para publicaciones normales nuevas.

Antes de generar el JSON, lee por completo
[`references/schema.json`](references/schema.json). Lee también
[`references/example.json`](references/example.json) cuando necesites comprobar
el estilo o la estructura de una propuesta.

Cuando GitHub esté disponible, consulta siempre `data/schema.json` en `main`
antes de publicar. Consulta también `data/example.json` si necesitas referencia
de estructura. La copia remota del esquema es la autoridad. Si el esquema remoto
ha cambiado de manera que la habilidad no pueda validarlo con seguridad, no
publiques y explica que la habilidad debe actualizarse.

## Identidad de cada plan

Cada plan publicado normalmente vive en su propio archivo. No compartas un
`current.json`, un índice global ni un slot numerado entre conversaciones.

El `id`:

- debe ser estable durante toda la vida del plan;
- debe coincidir exactamente con el nombre `data/plans/<id>.json`;
- debe cumplir `^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$`;
- para un plan nuevo, genera un valor suficientemente único, preferiblemente
  `<slug-tema>-YYYYMMDD-HHMMSS-<sufijo-corto>`;
- antes de crear un plan nuevo, comprueba que `data/plans/<id>.json` no existe;
  si existe, genera otro `id`, nunca lo reemplaces;
- para continuar un plan existente, usa únicamente un `id` fiable ya presente
  en la conversación, en la URL previamente publicada o indicado por el usuario;
  no adivines el plan mirando `data/current.json` ni buscando títulos parecidos.

Si no puedes determinar con seguridad qué plan se está actualizando, crea un
plan nuevo en lugar de correr el riesgo de sobrescribir otro.

## Versiones

- Un plan nuevo empieza en `version: 1`.
- Para actualizar un plan existente, lee primero su JSON remoto, comprueba que el
  `id` interno coincide con el nombre solicitado y toma su `version` actual.
- La nueva versión debe ser exactamente `version remota + 1`.
- Nunca reduzcas, reutilices ni saltes una versión para ocultar un conflicto.

## Flujo

1. Investiga el contexto necesario y redacta el plan completo como lo entregarías
   normalmente en la conversación.
2. Convierte el contenido al esquema del Viewer sin recortarlo ni inventar
   decisiones.
3. Determina si es un plan nuevo o una actualización:
   - nuevo: genera `id`, confirma que `data/plans/<id>.json` no existe y usa
     `version: 1`;
   - existente: lee exactamente `data/plans/<id>.json`, verifica su `id`, conserva
     ese `id` y usa `version remota + 1`.
4. Usa en `$schema` preferentemente la URL absoluta
   `https://ddadda69.github.io/GPT_DUDAS/data/schema.json`, para que el JSON sea
   portable aunque esté dentro de `data/plans/`.
5. Guarda el borrador JSON en una ubicación temporal y ejecútalo contra
   `scripts/validate_plan.py`. Si conoces el `id`, usa también
   `--expected-id <id>`. Usa el Python disponible en el entorno.
6. Si Python no está disponible, valida manualmente antes de publicar, como
   mínimo: campos obligatorios, propiedades permitidas, tipos, `id` y patrón,
   `version >= 1`, secciones no vacías, IDs de opciones, defaults existentes,
   coincidencia exacta entre `<id>.json` y el `id` interno y todas las reglas del
   esquema remoto.
7. Antes de cualquier escritura en GitHub:
   - verifica que la cuenta autenticada sea exactamente `ddadda69`;
   - vuelve a leer el archivo objetivo o confirma su inexistencia inmediatamente
     antes de escribir;
   - para una actualización, conserva el SHA recibido en esa lectura.
8. Publica únicamente el archivo del plan:
   - nuevo: crea `data/plans/<id>.json`; la operación debe fallar si ya existe;
   - existente: reemplaza `data/plans/<id>.json` usando exactamente el SHA leído;
   - no modifiques `data/current.json`, el Viewer, el esquema, documentación ni
     otros archivos durante una publicación normal;
   - deja que la interfaz de permisos solicite cualquier aprobación necesaria.
9. Si GitHub rechaza la escritura porque el archivo cambió, no hagas overwrite,
   no fuerces el SHA y no reconstruyas silenciosamente sobre la nueva versión.
   Vuelve a leer solo para confirmar el conflicto e informa de que existe una
   actualización concurrente.
10. Tras una escritura correcta, vuelve a leer `data/plans/<id>.json` y comprueba
    `id`, `version`, título y número de secciones. Verifica también que el SHA
    remoto sea el de la versión recién publicada.
11. Responde con el plan completo y autosuficiente, indica si la publicación se
    verificó y termina con la URL exacta
    `https://ddadda69.github.io/GPT_DUDAS/?plan=<id>`.

## Reglas de adaptación

- Conserva Markdown completo: párrafos, listas, tablas, negrita, `código` y
  bloques de código.
- No inventes alternativas para añadir interactividad.
- Si solo propondrías una solución, crea una sección `single` con una opción
  completa, `id: 1`, `recommended: true`, `defaultOption: 1`,
  `allowOther: false` y `allowNote: true`.
- Crea varias opciones únicamente cuando sean alternativas reales que cambien
  significativamente la implementación. Cada opción debe ser comprensible y
  completa por sí misma.
- Usa secciones `multiple`, `text` o `boolean` solo cuando representen de forma
  natural la decisión o la información solicitada.
- No añadas al JSON controles que el Viewer incorpora automáticamente, incluidos
  **Editar**, **No implementar** y **Nota**.
- No fuerces el plan a tener un número fijo de secciones.

## Concurrencia y varios chats

Dos conversaciones distintas pueden publicar a la vez porque cada plan tiene su
propio archivo. No introduzcas un fichero índice mutable para coordinar sesiones.

El único caso de conflicto real es que dos procesos intenten actualizar el mismo
`id`. En ese caso el SHA de GitHub es el bloqueo optimista: si el SHA ya no
coincide, detén la publicación y conserva ambos trabajos; nunca sobrescribas el
cambio remoto.

## Fallos y presentación

Si faltan conexión, permisos o validación, entrega igualmente el plan completo
en el chat, pero deja claro que el Viewer no se actualizó. No enlaces al Viewer
como si contuviera el plan nuevo.

No abras el navegador automáticamente. Ábrelo únicamente si el usuario lo pide
de forma explícita. Una solicitud de plan no autoriza cambios en el código del
Viewer, el esquema u otros archivos del repositorio.
