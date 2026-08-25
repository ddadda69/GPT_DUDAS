# GPT_DUDAS · Plan Viewer

Plan Viewer presenta planes de ChatGPT con el mismo contenido que tendría una respuesta normal y añade controles para decidir, editar y dejar notas.

## Principios

- El plan completo siempre existe en la conversación; el Viewer es una representación adicional.
- El Viewer se adapta al plan, no al revés.
- No se inventan alternativas para crear interactividad.
- Cada plan tiene un archivo canónico independiente: `data/plans/<id>.json`.
- `data/current.json` es únicamente el espejo del último plan publicado cuando no existe concurrencia y permite abrir la URL raíz sin parámetros.

## URLs

- Último plan: `https://ddadda69.github.io/GPT_DUDAS/`
- Plan estable: `https://ddadda69.github.io/GPT_DUDAS/?plan=<id>`

El parámetro `plan` solo admite letras, números, `.`, `_` y `-`, con un máximo de 128 caracteres. El `id` interno del JSON debe coincidir exactamente con el nombre `<id>.json`.

## Contrato actual

El contrato formal está en `data/schema.json`. No se mantienen variantes antiguas ni un campo `type` redundante.

Cada sección representa directamente una decisión y contiene una o dos opciones como máximo:

```json
{
  "id": "arquitectura",
  "title": "1. Elegir arquitectura",
  "defaultOption": 1,
  "options": [
    {
      "id": 1,
      "recommended": true,
      "text": "Contenido **completo** de la opción recomendada."
    },
    {
      "id": 2,
      "text": "Segunda alternativa, solo si cambia realmente la implementación."
    }
  ],
  "allowOther": true,
  "allowNote": true
}
```

Reglas adicionales:

- `$schema` debe ser exactamente `https://ddadda69.github.io/GPT_DUDAS/data/schema.json`.
- Las opciones se numeran exactamente `1` y, si existe, `2`.
- Debe haber exactamente una opción `recommended: true` y debe coincidir con `defaultOption`.
- **No implementar**, **Editar** y **Nota** son controles del Viewer y no opciones JSON.
- `allowOther` habilita una alternativa redactada por el usuario.

## Publicación y concurrencia

1. El agente captura el SHA inicial de `data/current.json`.
2. Crea o actualiza `data/plans/<id>.json` usando control optimista de SHA.
3. Verifica el archivo canónico remoto.
4. Intenta reflejar el mismo JSON en `data/current.json` usando el SHA capturado al principio.
5. Si otro chat cambió `current.json`, no lo sobrescribe; el archivo canónico y la URL con `?plan=<id>` siguen siendo válidos.

`data/current.json` nunca se usa para descubrir qué plan existente debe actualizarse.

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
│   ├── schema.json
│   └── plans/
│       └── <id>.json
├── skill-backups/
│   └── plan-viewer/
│       ├── RESTORE.md
│       └── skill/
└── README.md
```

## Seguridad y robustez

- El Viewer carga el JSON mediante la GitHub Contents API con `cache: no-store` y cache-busting.
- El JSON se valida de nuevo en el navegador antes de renderizarse.
- Markdown se procesa con versiones fijadas de `marked` y `DOMPurify`.
- Si cualquiera de las dependencias de Markdown no está disponible, el Viewer degrada a texto plano; nunca renderiza HTML sin sanear.
- `index.html` aplica una Content Security Policy restrictiva.
- El enlace **Ver JSON** apunta al archivo realmente cargado.
- Si la GitHub API alcanza su límite temporal, el Viewer muestra un diagnóstico específico.

## Desarrollo

La copia restaurable de la habilidad está en `skill-backups/plan-viewer/skill/`. El esquema y el ejemplo de esa copia deben mantenerse byte a byte iguales a `data/schema.json` y `data/example.json`.

El validador `scripts/validate_plan.py` no necesita dependencias externas y comprueba, además del contrato básico, IDs de sección únicos, numeración consecutiva de opciones y coherencia entre `recommended` y `defaultOption`.
