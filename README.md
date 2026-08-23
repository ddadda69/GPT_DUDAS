# GPT_DUDAS · Plan Viewer

Visor estático para presentar planes de ChatGPT con el mismo contenido que tendría una respuesta normal, añadiendo controles interactivos para decidir qué implementar, editar cada propuesta y dejar notas.

## Idea principal

El visor **no debe convertir un plan normal en un cuestionario artificial**.

Si ChatGPT, respondiendo normalmente, propondría una sola solución para un punto, `data/current.json` debe contener **una sola opción** con todo el contenido de ese punto. El visor añade automáticamente debajo la opción fija **No implementar** y el campo **Nota**.

Solo se añaden dos o más opciones cuando existe una decisión de implementación real y las alternativas cambiarían de forma relevante la solución.

El texto de cada opción se escribe en Markdown y debe conservar la riqueza de una respuesta normal: párrafos, listas, **negrita**, `código inline`, bloques de código, tablas, enlaces y demás elementos soportados.

## Comportamiento de cada punto `single`

1. Se muestra el título del punto.
2. Se muestra cada propuesta definida en `options` renderizada como Markdown.
3. Cada propuesta tiene botón **Editar**. El editor trabaja directamente sobre el Markdown y vuelve a renderizarlo al guardar.
4. El visor añade automáticamente una opción fija **No implementar**. No se incluye manualmente en el JSON.
5. Debajo aparece siempre el campo **Nota**, salvo que `allowNote` sea `false`.

Cuando una sección solo tiene una propuesta, no se muestra una etiqueta redundante tipo “Opción 1”; se ve directamente el contenido, para que visualmente se parezca a la respuesta que ChatGPT habría dado en el chat.

Si una sección sí tiene varias alternativas reales, el visor las identifica como **Opción 1**, **Opción 2**, etc., y puede marcar la recomendada.

## Estilo

La interfaz usa un tema oscuro inspirado en el aspecto del chat de ChatGPT:

- fondo `#212121`;
- texto claro;
- anchura de lectura limitada;
- separadores discretos;
- código inline con fondo gris;
- bloques de código oscuros;
- listas, tablas, enlaces y citas con estilos Markdown coherentes.

El Markdown se renderiza con `marked` y se sanea con `DOMPurify`.

## Estructura

```text
GPT_DUDAS/
├── index.html
├── app/
│   ├── viewer.js
│   └── styles.css
├── data/
│   ├── current.json
│   ├── example.json
│   └── schema.json
└── README.md
```

## Flujo de uso

1. GitHub Pages publica `index.html` y los archivos de `app/`.
2. El visor consulta directamente la GitHub Contents API para leer `data/current.json` de `main`.
3. Para cada nuevo plan normalmente solo se sustituye `data/current.json`.
4. **Recargar** vuelve a consultar GitHub y muestra el SHA recibido.
5. El usuario elige implementar una propuesta o **No implementar**, puede editar el contenido y añadir una nota.
6. **Generar respuesta** / **Copiar para ChatGPT** produce un resumen de las decisiones para continuar la conversación.

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

Los cambios en `data/current.json` se leen directamente desde la API de GitHub y suelen estar disponibles al recargar inmediatamente.

Los cambios en `index.html`, `app/viewer.js` o `app/styles.css` necesitan que GitHub Pages publique el nuevo commit; por eso pueden tardar algo más en verse que un simple cambio de `current.json`.
