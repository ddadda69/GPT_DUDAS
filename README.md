# GPT_DUDAS · Decision Viewer

Visor estático para presentar planes, alternativas y preguntas de decisión a partir de un único archivo JSON editable.

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
2. El visor consulta directamente la GitHub Contents API para leer `data/current.json` de la rama `main`.
3. Cuando haya un nuevo plan o consulta, normalmente solo se modifica `data/current.json`.
4. El botón **Recargar** vuelve a consultar GitHub y muestra el SHA recibido, evitando depender del despliegue de Pages para cada cambio de contenido.
5. El usuario selecciona opciones, añade notas o edita una respuesta y pulsa **Copiar para ChatGPT**.

## Archivos

- `index.html`: carcasa permanente del visor.
- `app/viewer.js`: renderizado, edición, recarga desde GitHub y generación de la respuesta.
- `app/styles.css`: diseño compacto y a ancho completo.
- `data/current.json`: contenido activo. Es el archivo que debe cambiar con cada nuevo plan.
- `data/example.json`: plantilla genérica de referencia; no debe contener información específica de una consulta real.
- `data/schema.json`: JSON Schema Draft 2020-12 que define formalmente los campos y tipos admitidos por el formato.
- `VISUALIZADOR.html`: alias de compatibilidad que redirige al `index.html`.

`data/current.json` y `data/example.json` incluyen `"$schema": "./schema.json"` para que editores y herramientas compatibles puedan validar y autocompletar el formato.

## Contrato JSON

El contrato formal está en `data/schema.json`. La estructura raíz requiere:

- `id`: identificador estable del plan.
- `version`: entero >= 1.
- `title`: título visible.
- `sections`: una o más secciones.
- `description`: opcional.

Cada sección requiere `id`, `title` y `type`. Los tipos soportados son `single`, `multiple`, `text` y `boolean`.

Las opciones de `single` y `multiple` requieren `id` y `text`, y pueden usar `recommended` y `selected`. Los IDs de opción pueden ser enteros o cadenas no vacías.

El schema es estricto: rechaza campos desconocidos mediante `additionalProperties` / `unevaluatedProperties`. Si se amplía el visor con nuevos campos, debe actualizarse también `data/schema.json` y `data/example.json`.

## Tipos de sección

### `single`
Una sola opción. Admite `defaultOption`, `options`, `allowOther`, `defaultOther` y `allowNote`.

### `multiple`
Varias opciones compatibles. Admite `defaultOptions`, `options`, `allowOther`, `defaultOther` y `allowNote`.

### `text`
Respuesta libre mediante textarea. Admite `rows`, `placeholder` y `defaultValue`.

### `boolean`
Decisión binaria. Admite `default`, `trueLabel` y `falseLabel`.

Todas las secciones pueden usar `description`, `allowNote`, `noteLabel` y `notePlaceholder` cuando corresponda.

## Regla de copia

Las opciones predefinidas se copian solo por su número/ID. Si el usuario edita el texto de una opción, la salida la marca como `modificada` e incluye el nuevo texto. La opción `Otra` siempre incluye el texto escrito. Las notas se incluyen únicamente cuando tienen contenido.

Ejemplo:

```text
Plan: consulta-actual · v3

1. Arquitectura
Respuesta: 2
Nota: Mantener compatibilidad con la versión anterior.

2. Interfaz
Respuesta: 1 (modificada) - Usar esta alternativa pero sin añadir un botón nuevo.
```

## Caché y GitHub Pages

Los cambios en `index.html`, `app/viewer.js` o `app/styles.css` sí necesitan un nuevo despliegue de GitHub Pages. Una vez estable el visor, los cambios habituales se realizan solo en `data/current.json`, que se consulta directamente desde GitHub y no necesita esperar al despliegue de Pages.
