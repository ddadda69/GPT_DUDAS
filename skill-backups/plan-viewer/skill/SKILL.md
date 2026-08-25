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
- Archivo publicado: `data/current.json`.
- URL final: `https://ddadda69.github.io/GPT_DUDAS/`.

Antes de generar el JSON, lee por completo
[`references/schema.json`](references/schema.json). Lee también
[`references/example.json`](references/example.json) cuando necesites comprobar
el estilo o la estructura de una propuesta.

Cuando GitHub esté disponible, consulta `data/schema.json`,
`data/example.json` y `data/current.json` en la rama `main` antes de publicar.
La copia remota es la autoridad. Si el esquema remoto ha cambiado de manera que
la habilidad no pueda validarlo con seguridad, no publiques y explica que la
habilidad debe actualizarse.

## Flujo

1. Investiga el contexto necesario y redacta el plan completo como lo entregarías
   normalmente en la conversación.
2. Convierte el contenido al esquema del Viewer sin recortarlo ni inventar
   decisiones.
3. Compara con `data/current.json`:
   - si actualiza el mismo plan, conserva `id` e incrementa `version`;
   - si es un plan nuevo, crea un `id` descriptivo y usa `version: 1`.
4. Guarda el borrador JSON en una ubicación temporal y ejecútalo contra
   `scripts/validate_plan.py`. Usa el Python disponible en el entorno. Si no hay
   Python, valida manualmente todos los requisitos del esquema antes de publicar.
5. Publica mediante la conexión de GitHub disponible:
   - verifica que la cuenta autenticada sea `ddadda69`;
   - obtiene primero el SHA actual de `data/current.json`;
   - reemplaza únicamente `data/current.json` en `main`;
   - no modifica el código del Viewer ni ningún otro archivo;
   - deja que la interfaz de permisos solicite cualquier aprobación necesaria.
6. Vuelve a leer `data/current.json` y comprueba `id`, `version`, título y número
   de secciones. Haz como máximo un reintento ante un fallo transitorio. Si otra
   actualización cambió el archivo entre lecturas, no la sobrescribas: informa
   del conflicto.
7. Responde con el plan completo y autosuficiente, indica si la publicación se
   verificó y termina con la URL del Viewer.

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

## Fallos y presentación

Si faltan conexión, permisos o validación, entrega igualmente el plan completo
en el chat, pero deja claro que el Viewer no se actualizó. No enlaces al Viewer
como si contuviera el plan nuevo.

No abras el navegador automáticamente. Ábrelo únicamente si el usuario lo pide
de forma explícita. Una solicitud de plan no autoriza otros cambios en GitHub ni
modificaciones del Viewer.

