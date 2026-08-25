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
- Publicación canónica: `data/plans/<id>.json`.
- URL estable de un plan: `https://ddadda69.github.io/GPT_DUDAS/?plan=<id>`.
- Espejo de conveniencia: `data/current.json`. La URL sin `?plan=` carga este
  archivo y debe mostrar normalmente el último plan publicado correctamente.

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

Cada plan vive de forma canónica en su propio archivo. `data/current.json` es
solo un espejo compartido para abrir el último plan sin parámetros; nunca se usa
para decidir qué plan existente debe actualizarse.

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

1. Antes de preparar el plan, cuando GitHub esté disponible, lee
   `data/current.json` y conserva su SHA como `currentBaselineSha`. Esta lectura
   es el bloqueo optimista del espejo: no vuelvas a sustituir ese SHA por otro
   justo antes de escribir `current.json`.
2. Investiga el contexto necesario y redacta el plan completo como lo entregarías
   normalmente en la conversación.
3. Convierte el contenido al esquema del Viewer sin recortarlo ni inventar
   decisiones.
4. Determina si es un plan nuevo o una actualización:
   - nuevo: genera `id`, confirma que `data/plans/<id>.json` no existe y usa
     `version: 1`;
   - existente: lee exactamente `data/plans/<id>.json`, verifica su `id`, conserva
     ese `id` y usa `version remota + 1`.
5. Usa en `$schema` preferentemente la URL absoluta
   `https://ddadda69.github.io/GPT_DUDAS/data/schema.json`, para que el JSON sea
   portable aunque esté dentro de `data/plans/`.
6. Guarda el borrador JSON en una ubicación temporal y ejecútalo contra
   `scripts/validate_plan.py`. Si conoces el `id`, usa también
   `--expected-id <id>`. Usa el Python disponible en el entorno.
7. Si Python no está disponible, valida manualmente antes de publicar, como
   mínimo: campos obligatorios, propiedades permitidas, tipos, `id` y patrón,
   `version >= 1`, secciones no vacías, IDs de opciones, defaults existentes,
   coincidencia exacta entre `<id>.json` y el `id` interno y todas las reglas del
   esquema remoto.
8. Antes de escribir el archivo canónico en GitHub:
   - verifica que la cuenta autenticada sea exactamente `ddadda69`;
   - para un plan nuevo confirma de nuevo que el archivo no existe;
   - para una actualización vuelve a leer exactamente el archivo objetivo y usa
     el SHA recibido en esa lectura.
9. Publica primero y únicamente la versión canónica del plan:
   - nuevo: crea `data/plans/<id>.json`; la operación debe fallar si ya existe;
   - existente: reemplaza `data/plans/<id>.json` usando exactamente el SHA leído;
   - no fuerces ningún SHA ni hagas overwrite ciego.
10. Vuelve a leer `data/plans/<id>.json` y verifica `id`, `version`, título,
    número de secciones y que el contenido remoto corresponda a la versión recién
    publicada. Si esta verificación falla, no actualices `current.json`.
11. Tras verificar la publicación canónica, intenta reflejar exactamente ese
    mismo JSON en `data/current.json` usando `currentBaselineSha`:
    - no vuelvas a leer `current.json` para obtener un SHA más nuevo antes de esta
      escritura, porque eso ocultaría una actualización concurrente;
    - si el SHA sigue vigente, reemplaza `data/current.json` con el mismo JSON;
    - si GitHub rechaza la escritura porque `current.json` cambió desde la lectura
      inicial, no fuerces ni reintentes el overwrite: conserva el otro `current` y
      considera la publicación del plan igualmente correcta;
    - después de una escritura correcta, vuelve a leer `data/current.json` y
      comprueba que `id`, `version` y contenido coincidan con el plan publicado.
12. Responde con el plan completo y autosuficiente. Indica por separado si la
    publicación canónica se verificó y si `current.json` quedó actualizado. Termina
    con la URL estable `https://ddadda69.github.io/GPT_DUDAS/?plan=<id>`; puedes
    mencionar también que la URL raíz mostrará ese plan si el espejo se actualizó.

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

Los archivos de `data/plans/` son la verdad canónica y evitan que conversaciones
distintas se pisen. El único conflicto crítico es que dos procesos intenten
actualizar el mismo `id`; en ese caso el SHA del archivo del plan es el bloqueo
optimista y el cambio remoto nunca se sobrescribe a la fuerza.

`data/current.json` es deliberadamente compartido y no canónico. En el caso
normal, sin concurrencia, se actualiza tras cada publicación correcta y la URL
raíz muestra el último plan. Si dos chats parten del mismo `currentBaselineSha`,
solo uno podrá actualizar el espejo; el otro debe conservar su plan aislado y no
pisar el `current` ajeno. Por eso, bajo concurrencia, la URL con `?plan=<id>` es
siempre la referencia fiable.

## Fallos y presentación

Si faltan conexión, permisos o validación, entrega igualmente el plan completo
en el chat, pero deja claro que el Viewer no se actualizó. Si el plan aislado se
publicó pero el espejo `current.json` tuvo un conflicto, no presentes eso como un
fallo del plan: indica que el enlace estable funciona y que la URL raíz puede
mostrar otro plan concurrente.

No abras el navegador automáticamente. Ábrelo únicamente si el usuario lo pide
de forma explícita. Una solicitud de plan no autoriza cambios en el código del
Viewer, el esquema u otros archivos del repositorio.