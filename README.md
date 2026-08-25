# GPT_DUDAS · Plan Viewer

Visor estático para presentar planes de ChatGPT con el mismo contenido que tendría una respuesta normal, añadiendo controles interactivos para decidir qué implementar, editar cada propuesta y dejar notas.

## Idea principal

El visor **no debe convertir un plan normal en un cuestionario artificial**.

Si ChatGPT, respondiendo normalmente, propondría una sola solución para un punto, el JSON del plan debe contener **una sola opción** con todo el contenido de ese punto. El visor añade automáticamente debajo la opción fija **No implementar** y el campo **Nota**.

Solo se añaden dos o más opciones cuando existe una decisión de implementación real y las alternativas cambiarían de forma relevante la solución.

El texto de cada opción se escribe en Markdown y debe conservar la riqueza de una respuesta normal: párrafos, listas, **negrita**, `código inline`, bloques de código, tablas, enlaces y demás elementos soportados.

## Planes aislados por ID

El Viewer admite varios chats o agentes publicando a la vez sin compartir un único archivo mutable.

- Cada plan normal se guarda en `data/plans/<id>.json`.
- El `id` también es el nombre del archivo y solo admite letras, números, `.`, `_` y `-`, con un máximo de 128 caracteres.
- La URL estable de un plan es `https://ddadda69.github.io/GPT_DUDAS/?plan=<id>`.
- El Viewer valida que el `id` contenido en el JSON coincida exactamente con el solicitado en la URL.
- `data/current.json` se conserva únicamente como compatibilidad: abrir el Viewer sin `?plan=` sigue cargándolo.
- No existe un índice global de sesiones que todos los chats tengan que modificar.

Esto permite que dos chats creen o actualicen planes diferentes simultáneamente. Para actualizar el mismo plan, el publicador debe leer antes su SHA y usarlo en la escritura; si el archivo cambió mientras tanto, la actualización se considera un conflicto y no debe sobrescribirse.

## Comportamiento de cada punto `single`

1. Se muestra el título del punto.
2. Se muestra cada propuesta definida en `options` renderizada como Markdown.
3. Cada propuesta tiene botón **Editar**. El editor trabaja directamente sobre el Markdown y vuelve a renderizarlo al guardar.
4. El visor añade automáticamente una opción fija **No implementar**. No se incluye manualmente en el JSON.
5. Debajo aparece siempre el campo **Nota**, salvo que `allowNote` sea `false`.

Cuando una sección solo tiene una propuesta, no se muestra una etiqueta redundante tipo “Opción 1”; se ve directamente el contenido, para que visualmente se parezca a la respuesta que ChatGPT habría dado en el chat.

Si una sección sí tiene varias alternativas reales, el visor las identifica como **Opción 1**, **Opción 2**, etc., y puede marcar la recomendada.

## Estilo

La interfaz usa un tema oscuro inspirado en el aspecto del chat de ChatGPT. El Markdown se renderiza con `marked` y se sanea con `DOMPurify`.

## Estructura

```text
GPT_DUDAS/
├── index.html
├── app/
│   ├── viewer.js
│   └── styles.css
├── data/
│   ├── current.json          # fallback legacy
│   ├── example.json
│   ├── schema.json
│   └── plans/
│       └── <id>.json         # publicación normal
├── skill-backups/
│   └── plan-viewer/
└── README.md
```

## Flujo de uso

1. GitHub Pages publica `index.html` y los archivos de `app/`.
2. Para un plan nuevo se genera un `id` estable y seguro, se comprueba que `data/plans/<id>.json` no exista y se crea con `version: 1`.
3. Para actualizar un plan existente se lee `data/plans/<id>.json`, se conserva `id`, se incrementa `version` y se escribe usando el SHA leído.
4. El Viewer recibe ese mismo `id` mediante `?plan=<id>` y consulta directamente la GitHub Contents API en `main`.
5. **Recargar** vuelve a consultar GitHub y muestra el SHA recibido.
6. El usuario elige implementar una propuesta o **No implementar**, puede editar el contenido y añadir una nota.
7. **Generar respuesta** / **Copiar para ChatGPT** produce un resumen de las decisiones para continuar la conversación.

## Identidad, versiones y concurrencia

Para planes publicados en `data/plans/` se aplican estas reglas:

- El nombre del archivo debe ser exactamente `<id>.json`.
- Un plan nuevo empieza en `version: 1`.
- Una actualización conserva el mismo `id` e incrementa exactamente en uno la versión remota vigente.
- Nunca se deduce un plan existente mirando `data/current.json`.
- Si no existe un identificador fiable para continuar un plan, se crea uno nuevo en lugar de adivinar.
- Una actualización requiere el SHA obtenido en la lectura inmediatamente anterior. Un conflicto detiene la publicación; no se hace un overwrite ciego.

## Contrato JSON

El contrato formal está en `data/schema.json`.

Para planes normales, la estructura recomendada de cada punto es:

```json
{
  "id": "punto-1",
  "title": "1. Título del punto",
  "type": "single",
  "defaultOption": 1,
  "options": [
    {
      "id": 1,
      "recommended": true,
      "text": "Contenido **completo** del punto en Markdown."
    }
  ],
  "allowOther": false,
  "allowNote": true
}
```

No añadas una segunda opción solo para que haya algo que elegir. Si ChatGPT no la habría propuesto en una respuesta normal, tampoco debe aparecer en el Viewer.

La opción **No implementar** pertenece al visor y no al JSON.

## Otros tipos

El schema mantiene compatibilidad con `multiple`, `text` y `boolean`, aunque para planes de implementación la forma preferida es `single` por punto.

`allowOther` sigue existiendo por compatibilidad, pero en los planes normales debería ser `false` salvo que exista una razón concreta para permitir una alternativa escrita completamente por el usuario.

## Caché y GitHub Pages

Los JSON de `data/plans/` y `data/current.json` se leen directamente desde la API de GitHub con `cache: no-store` y un parámetro de cache-busting, por lo que suelen estar disponibles inmediatamente al recargar.

Los cambios en `index.html`, `app/viewer.js` o `app/styles.css` necesitan que GitHub Pages publique el nuevo commit; por eso pueden tardar algo más en verse.
