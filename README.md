# GPT_DUDAS · Plan Viewer

Visor estático para presentar planes de ChatGPT con el mismo contenido que tendría una respuesta normal, añadiendo controles interactivos para decidir qué implementar, editar cada propuesta y dejar notas.

## Idea principal

El visor **no debe convertir un plan normal en un cuestionario artificial**.

Si ChatGPT, respondiendo normalmente, propondría una sola solución para un punto, el JSON del plan debe contener **una sola opción** con todo el contenido de ese punto. El visor añade automáticamente debajo la opción fija **No implementar** y el campo **Nota**.

Solo se añaden dos o más opciones cuando existe una decisión de implementación real y las alternativas cambiarían de forma relevante la solución.

El texto de cada opción se escribe en Markdown y debe conservar la riqueza de una respuesta normal: párrafos, listas, **negrita**, `código inline`, bloques de código, tablas, enlaces y demás elementos soportados.

## Planes aislados por ID

El Viewer admite varios chats o agentes publicando a la vez sin usar `current.json` como almacenamiento canónico.

- Cada plan normal se guarda en `data/plans/<id>.json`.
- El `id` también es el nombre del archivo y solo admite letras, números, `.`, `_` y `-`, con un máximo de 128 caracteres.
- La URL estable de un plan es `https://ddadda69.github.io/GPT_DUDAS/?plan=<id>`.
- El Viewer valida que el `id` contenido en el JSON coincida exactamente con el solicitado en la URL.
- `data/current.json` es un **espejo de conveniencia** del último plan publicado correctamente en el caso normal; abrir el Viewer sin `?plan=` lo carga.
- No existe un índice global de sesiones que todos los chats tengan que modificar.

Así, dos chats pueden conservar planes distintos sin interferirse. Los archivos de `data/plans/` son la fuente de verdad; `current.json` solo facilita abrir rápidamente el último plan sin parámetros.

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
│   ├── current.json          # espejo del último plan, no canónico
│   ├── example.json
│   ├── schema.json
│   └── plans/
│       └── <id>.json         # publicación canónica
├── skill-backups/
│   └── plan-viewer/
└── README.md
```

## Flujo de uso

1. GitHub Pages publica `index.html` y los archivos de `app/`.
2. Al iniciar una publicación, el agente lee `data/current.json` y conserva su SHA como bloqueo optimista del espejo.
3. Para un plan nuevo se genera un `id` estable y seguro, se comprueba que `data/plans/<id>.json` no exista y se crea con `version: 1`.
4. Para actualizar un plan existente se lee `data/plans/<id>.json`, se conserva `id`, se incrementa `version` y se escribe usando el SHA leído.
5. Tras verificar el archivo canónico, el mismo JSON se copia a `data/current.json` usando el SHA guardado al principio.
6. Si `current.json` cambió entretanto por otro chat, la escritura del espejo falla y no se fuerza; el plan aislado sigue publicado correctamente.
7. El Viewer recibe el `id` mediante `?plan=<id>` para cargar el archivo estable, o sin parámetros carga `current.json`.
8. **Recargar** vuelve a consultar GitHub y muestra el SHA recibido.
9. El usuario elige implementar una propuesta o **No implementar**, puede editar el contenido y añadir una nota.
10. **Generar respuesta** / **Copiar para ChatGPT** produce un resumen de las decisiones para continuar la conversación.

## Identidad, versiones y concurrencia

Para planes publicados en `data/plans/` se aplican estas reglas:

- El nombre del archivo debe ser exactamente `<id>.json`.
- Un plan nuevo empieza en `version: 1`.
- Una actualización conserva el mismo `id` e incrementa exactamente en uno la versión remota vigente.
- Nunca se deduce un plan existente mirando `data/current.json`.
- Si no existe un identificador fiable para continuar un plan, se crea uno nuevo en lugar de adivinar.
- Una actualización requiere el SHA obtenido en la lectura inmediatamente anterior. Un conflicto detiene la publicación; no se hace un overwrite ciego.

`data/current.json` tiene una regla distinta: es un espejo compartido. Su SHA se captura **antes de preparar el plan** y se usa después para actualizarlo. Si otro chat lo modificó mientras tanto, GitHub rechaza la escritura y no se reintenta con un SHA más nuevo. En ausencia de concurrencia, la URL raíz muestra siempre el último plan publicado; bajo concurrencia, la URL estable con `?plan=<id>` es la referencia correcta.

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